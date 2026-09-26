"""Worker entry point, run by GitHub Actions on every push to the data branch.

Data branch layout (every JSON file is a vault envelope):
  queue/<job>.json          request written by the web app
  jobs/<job>/status.json    live progress
  jobs/<job>/raw.json       Apify items, kept so a retry costs no credits
  jobs/<job>/result.json    posts + extracted text, ranked by popularity
  jobs/<job>/thumbs/<n>.json  small webp previews, 24 per file

Logs are public on a public repo: never print usernames or extracted text.
"""

import base64
import io
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from instagram import FetchError, fetch_posts, normalize, rank  # noqa: E402
from vault import Vault  # noqa: E402

TERMINAL = {"done", "partial", "error"}
THUMBS_PER_FILE = 24
FLUSH_EVERY_S = 180
MAX_POSTS = 1000


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


class Store:
    def __init__(self, root: Path, vault: Vault, push: bool):
        self.root, self.vault, self.push = root, vault, push

    def read(self, rel: str):
        p = self.root / rel
        if not p.exists():
            return None
        return self.vault.decrypt(json.loads(p.read_text()))

    def write(self, rel: str, obj):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.vault.encrypt(obj)))

    def commit(self, message: str):
        if not self.push:
            return
        git = ["git", "-C", str(self.root)]
        subprocess.run(git + ["add", "-A", "jobs"], check=True)
        if subprocess.run(git + ["diff", "--cached", "--quiet"]).returncode == 0:
            return
        subprocess.run(git + ["commit", "-q", "-m", message], check=True)
        for attempt in range(5):
            if subprocess.run(git + ["push", "-q"]).returncode == 0:
                return
            # The web app may have queued another job meanwhile: different files, rebase is safe.
            subprocess.run(git + ["pull", "-q", "--rebase"], check=False)
            time.sleep(2 ** attempt)
        raise RuntimeError("git push failed")


def download(url: str) -> np.ndarray:
    last = None
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=40, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200:
                img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
                if img is not None:
                    return img
                last = "immagine non leggibile"
            else:
                last = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last = type(e).__name__
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(last)


def thumbnail(img: np.ndarray) -> str:
    rgb = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    rgb.thumbnail((420, 525))
    buf = io.BytesIO()
    rgb.save(buf, "WEBP", quality=62, method=5)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


class Job:
    def __init__(self, store: Store, job_id: str, req: dict, reader_factory, deadline: float):
        self.store, self.id, self.req = store, job_id, req
        self.reader_factory, self.deadline = reader_factory, deadline
        self.dir = f"jobs/{job_id}"
        prev = store.read(f"{self.dir}/status.json") or {}
        self.status = {
            "jobId": job_id,
            "username": req["username"],
            "nonce": req.get("nonce"),
            "requestedAt": req.get("requestedAt"),
            "startedAt": now(),
            "state": "fetching",
            "message": "Recupero dei post da Instagram…",
            "total": prev.get("total", 0),
            "processed": 0,
            "slides": 0,
            "runUrl": os.environ.get("RUN_URL"),
        }

    def save_status(self, **kw):
        self.status.update(kw, updatedAt=now())
        self.store.write(f"{self.dir}/status.json", self.status)

    def run(self):
        username = self.req["username"]
        print(f"::add-mask::{username}", flush=True)
        self.save_status()
        self.store.commit("worker: start")

        raw = self.store.read(f"{self.dir}/raw.json")
        if raw is None or self.req.get("refetch"):
            limit = max(1, min(int(self.req.get("maxPosts") or MAX_POSTS), MAX_POSTS))
            last = [time.time()]

            def tick():
                if time.time() - last[0] > 120:
                    last[0] = time.time()
                    self.save_status(message="Apify sta raccogliendo i post…")
                    self.store.commit("worker: progress")

            token = os.environ.get("APIFY_TOKEN", "").strip()
            if not token:
                raise FetchError("Token Apify mancante: ripeti la configurazione dalle impostazioni.")
            raw = fetch_posts(token, username, limit, tick)
            self.store.write(f"{self.dir}/raw.json", raw)
        posts = [p for p in (normalize(i) for i in raw) if p]
        if not posts:
            raise FetchError("Nessun post con immagini trovato (profilo privato, vuoto o solo reel).")
        posts = rank(posts)
        log(f"{len(raw)} items, {len(posts)} image posts")

        profile = {"username": username, "fullName": next((p["ownerName"] for p in posts if p.get("ownerName")), None)}
        # Resume: keep what a previous (interrupted) run already read.
        prev = self.store.read(f"{self.dir}/result.json") or {}
        done = {p["id"]: p for p in prev.get("posts", []) if p.get("slides") is not None}
        thumbs: dict = {}

        result = {"version": 1, "jobId": self.id, "profile": profile, "createdAt": self.status["startedAt"],
                  "state": "running", "posts": []}
        total_slides = sum(len(p["slideUrls"]) for p in posts)
        self.save_status(state="reading", total=len(posts), totalSlides=total_slides,
                         message="Lettura del testo nelle immagini…")
        self.store.commit("worker: fetched")

        reader = self.reader_factory()
        last_flush = time.time()
        out_posts = []
        for idx, post in enumerate(posts):
            if time.time() > self.deadline:
                log("time budget reached, saving partial result")
                break
            chunk, key = idx // THUMBS_PER_FILE, post["id"]
            if key in done:
                rec = {**done[key], "rank": post["rank"], "score": post["score"],
                       "likes": post["likes"], "comments": post["comments"], "likesHidden": post["likesHidden"]}
                out_posts.append(rec)
                self.status["slides"] += len(rec["slides"])
                continue

            slides, thumb = [], None
            for i, url in enumerate(post["slideUrls"]):
                try:
                    img = download(url)
                    if i == 0:
                        thumb = thumbnail(img)
                    read = reader.read(img, handle=username)
                    slides.append({"i": i + 1, "paragraphs": read["paragraphs"], "confidence": read["confidence"]})
                except Exception as e:  # one broken slide must not kill the job
                    slides.append({"i": i + 1, "paragraphs": [], "confidence": 0, "error": str(e)[:120]})
                self.status["slides"] += 1

            if thumb:
                thumbs.setdefault(chunk, {})[key] = thumb
            rec = {k: post[k] for k in ("id", "shortCode", "url", "kind", "takenAt", "likes", "likesHidden",
                                         "comments", "score", "rank")}
            rec["slides"] = slides
            rec["thumb"] = chunk if thumb else None
            out_posts.append(rec)

            if time.time() - last_flush > FLUSH_EVERY_S:
                self._flush(result, out_posts, thumbs, len(posts), final=False)
                last_flush = time.time()

        complete = len(out_posts) == len(posts)
        self._flush(result, out_posts, thumbs, len(posts), final=True, complete=complete)

    def _flush(self, result, out_posts, thumbs, total, final, complete=True):
        result["posts"] = sorted(out_posts, key=lambda p: p["rank"])
        result["updatedAt"] = now()
        # Thumbnail files are merged so a resumed job keeps earlier previews.
        for chunk, items in thumbs.items():
            rel = f"{self.dir}/thumbs/{chunk}.json"
            existing = self.store.read(rel) or {}
            if not set(items) <= set(existing):
                self.store.write(rel, {**existing, **items})
        if final:
            state = "done" if complete else "partial"
            result["state"] = state
            result["finishedAt"] = now()
            msg = "Completato" if complete else f"Tempo esaurito: letti {len(out_posts)} post su {total} (i più popolari)"
            self.save_status(state=state, processed=len(out_posts), message=msg, finishedAt=now())
        else:
            self.save_status(processed=len(out_posts))
        self.store.write(f"{self.dir}/result.json", result)
        self.store.commit("worker: done" if final else "worker: progress")
        log(f"flushed {len(out_posts)}/{total} posts")


def pending_jobs(store: Store):
    for qf in sorted((store.root / "queue").glob("*.json")):
        job_id = qf.stem
        try:
            req = store.read(f"queue/{qf.name}")
        except Exception:
            log(f"job {job_id}: cannot decrypt request (different VAULT_KEY?), skipped")
            continue
        status = store.read(f"jobs/{job_id}/status.json") if (store.root / f"jobs/{job_id}/status.json").exists() else None
        if status and status.get("nonce") == req.get("nonce") and status.get("state") in TERMINAL:
            continue
        yield job_id, req


def main():
    root = Path(os.environ.get("DATA_DIR", "data")).resolve()
    vault = Vault(os.environ.get("VAULT_KEY", ""))
    store = Store(root, vault, push=os.environ.get("NO_PUSH") != "1")
    budget_min = float(os.environ.get("TIME_BUDGET_MIN", "330"))
    deadline = time.time() + budget_min * 60

    if not os.environ.get("APIFY_TOKEN"):
        log("APIFY_TOKEN secret missing")

    reader = []

    def reader_factory():
        if not reader:
            from ocr_engine import SlideReader
            reader.append(SlideReader())
        return reader[0]

    ran = 0
    for job_id, req in pending_jobs(store):
        log(f"job {job_id}: start")
        job = Job(store, job_id, req, reader_factory, deadline)
        try:
            job.run()
            log(f"job {job_id}: {job.status['state']}")
        except Exception as e:
            traceback.print_exc() if not isinstance(e, FetchError) else None
            msg = str(e) if isinstance(e, FetchError) else f"Errore imprevisto: {type(e).__name__}"
            job.save_status(state="error", message=msg, finishedAt=now())
            store.commit("worker: error")
            log(f"job {job_id}: error")
        ran += 1
        if time.time() > deadline:
            break
    log(f"{ran} job(s) processed")


if __name__ == "__main__":
    main()
