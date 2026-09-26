"""Fetches a profile's posts through Apify.

Apify scrapes from its own infrastructure without any Instagram login, so
the user's Meta account is never involved. Only the free plan is needed.
"""

import os
import statistics
import time

import requests

API = "https://api.apify.com/v2"
ACTOR = os.environ.get("APIFY_ACTOR", "apify~instagram-scraper")
VIDEO_TYPES = {"video", "graphvideo", "reel", "clips", "igtv"}
CAROUSEL_TYPES = {"sidebar", "graphsidebar", "carousel", "carousel_container"}


class FetchError(Exception):
    pass


def _check(r: requests.Response):
    if r.status_code == 401:
        raise FetchError("Token Apify non valido. Aggiornalo nelle impostazioni.")
    if r.status_code == 402:
        raise FetchError("Crediti Apify gratuiti esauriti per questo mese.")
    if r.status_code >= 400:
        raise FetchError(f"Apify ha risposto {r.status_code}: {r.text[:200]}")
    return r.json()


def fetch_posts(token: str, username: str, limit: int, on_tick=None) -> list:
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {token}"
    run = _check(s.post(f"{API}/acts/{ACTOR}/runs", json={
        "directUrls": [f"https://www.instagram.com/{username}/"],
        "resultsType": "posts",
        "resultsLimit": limit,
        "addParentData": False,
    }, timeout=60))["data"]

    deadline = time.time() + 90 * 60
    while run["status"] in ("READY", "RUNNING"):
        if time.time() > deadline:
            raise FetchError("Apify ci sta mettendo troppo (oltre 90 minuti).")
        time.sleep(15)
        run = _check(s.get(f"{API}/actor-runs/{run['id']}", timeout=60))["data"]
        if on_tick:
            on_tick()
    if run["status"] != "SUCCEEDED":
        raise FetchError(f"Apify: esecuzione {run['status'].lower()} ({run.get('statusMessage') or 'nessun dettaglio'})")

    items, offset = [], 0
    while True:
        page = s.get(f"{API}/datasets/{run['defaultDatasetId']}/items",
                     params={"clean": "true", "offset": offset, "limit": 500}, timeout=120)
        if page.status_code >= 400:
            _check(page)
        batch = page.json()
        items += batch
        if len(batch) < 500:
            break
        offset += 500
    errors = [i for i in items if i.get("error")]
    items = [i for i in items if not i.get("error")]
    if not items and errors:
        raise FetchError(f"Apify: {errors[0].get('errorDescription') or errors[0]['error']}")
    return items


def _num(v):
    return v if isinstance(v, (int, float)) and v >= 0 else None


def _is_video(item: dict) -> bool:
    t = str(item.get("type") or item.get("mediaType") or "").lower()
    return t in VIDEO_TYPES or str(item.get("productType") or "").lower() in VIDEO_TYPES or bool(item.get("videoUrl"))


def normalize(item: dict) -> dict | None:
    """Apify item -> our post, or None for reels/videos/unusable items."""
    kind = str(item.get("type") or item.get("mediaType") or "").lower()
    children = item.get("childPosts") or []
    is_carousel = kind in CAROUSEL_TYPES or len(children) > 1 or len(item.get("images") or []) > 1
    if not is_carousel and _is_video(item):
        return None

    slides = []
    if is_carousel:
        if children:
            slides = [c.get("displayUrl") for c in children if not _is_video(c)]
        else:
            slides = list(item.get("images") or [])
    elif item.get("displayUrl"):
        slides = [item["displayUrl"]]
    slides = [u for u in slides if u]
    if not slides:
        return None

    code = item.get("shortCode") or item.get("shortcode")
    return {
        "id": str(item.get("id") or code),
        "shortCode": code,
        "url": item.get("url") or (f"https://www.instagram.com/p/{code}/" if code else None),
        "kind": "carousel" if len(slides) > 1 or is_carousel else "single",
        "takenAt": item.get("timestamp"),
        "likes": _num(item.get("likesCount")),
        "comments": _num(item.get("commentsCount")),
        "slideUrls": slides,
        "owner": item.get("ownerUsername"),
        "ownerName": item.get("ownerFullName"),
    }


def rank(posts: list) -> list:
    """Popularity = likes + 3 x comments. Hidden likes are estimated from the
    profile's own like/comment ratio so those posts still rank fairly."""
    ratios = [p["likes"] / p["comments"] for p in posts if p["likes"] and p["comments"]]
    ratio = statistics.median(ratios) if ratios else 30.0
    for p in posts:
        likes = p["likes"]
        p["likesHidden"] = likes is None
        if likes is None:
            likes = (p["comments"] or 0) * ratio
        p["score"] = round(likes + 3 * (p["comments"] or 0))
    posts.sort(key=lambda p: -p["score"])
    for i, p in enumerate(posts, 1):
        p["rank"] = i
    return posts
