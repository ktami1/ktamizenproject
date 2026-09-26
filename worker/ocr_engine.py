"""Reads the text of one Instagram slide.

RapidOCR (PP-OCRv6 models bundled in the wheel) runs on a few image variants.
Lines found by each variant are clustered by position, and for every cluster
we keep the reading that is both confident and made of real Italian/English
words. The surviving lines are then regrouped into paragraphs.
"""

import re
import statistics
from dataclasses import dataclass, field

import cv2
import numpy as np
from rapidocr import RapidOCR
from wordfreq import zipf_frequency

LANGS = ("it", "en")
CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯豈-﫿]")
PAGE_COUNTER = re.compile(r"^\s*\d{1,2}\s*[/|\\]\s*\d{1,2}\s*$|^\s*\d{1,3}\s*$")
HANDLE = re.compile(r"^\s*@[\w.]+\s*$")
ARROWS_ONLY = re.compile(r"^[\s→←>»<«\-–—.·•|]+$")
SWIPE = re.compile(r"^\s*(swipe|scorri|next|avanti)\s*[→>»]*\s*$", re.I)
LIST_ITEM = re.compile(r"^\s*(\d{1,2}[.)]|[-•·✓✔✗✘→]|[a-z]\))\s", re.I)
WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*", re.UNICODE)


def word_zipf(w: str) -> float:
    w = w.lower().replace("’", "'")
    return max(zipf_frequency(w, lang) for lang in LANGS)


def plausibility(text: str) -> float:
    """Share of the words in `text` that exist in Italian or English (0..1)."""
    words = [w for w in WORD.findall(text) if len(w) > 1]
    if not words:
        # Numbers/symbols only: neutral, but never better than real words.
        return 0.6 if text.strip() else 0.0
    ok = sum(1 for w in words if word_zipf(w) >= 1.5)
    return ok / len(words)


def split_glued(token: str) -> str:
    """'diventicapace.' -> 'diventi capace.' when both halves are common words."""
    m = re.match(r"^(\W*)([^\W\d_]{8,})(\W*)$", token)
    if not m or word_zipf(m.group(2)) >= 1.5:
        return token
    pre, core, post = m.groups()
    best, best_score = None, 3.0
    for i in range(2, len(core) - 1):
        a, b = core[:i], core[i:]
        s = min(word_zipf(a), word_zipf(b))
        if s > best_score:
            best, best_score = f"{a} {b}", s
    return f"{pre}{best}{post}" if best else token


def fix_words(text: str) -> str:
    return " ".join(split_glued(t) for t in text.split())


@dataclass
class Line:
    text: str
    score: float
    box: tuple  # x0, y0, x1, y1 in original image pixels
    variant: str

    @property
    def h(self):
        return self.box[3] - self.box[1]

    @property
    def cy(self):
        return (self.box[1] + self.box[3]) / 2


@dataclass
class Cluster:
    box: list
    by_variant: dict = field(default_factory=dict)  # variant -> [Line]

    def add(self, line: Line):
        self.by_variant.setdefault(line.variant, []).append(line)
        b = self.box
        self.box = [min(b[0], line.box[0]), min(b[1], line.box[1]), max(b[2], line.box[2]), max(b[3], line.box[3])]

    def candidates(self):
        out = []
        for variant, lines in self.by_variant.items():
            lines = sorted(lines, key=lambda l: l.box[0])
            text = " ".join(l.text for l in lines)
            score = sum(l.score * len(l.text) for l in lines) / max(1, sum(len(l.text) for l in lines))
            out.append((variant, text, score))
        return out

    def variant_box(self, variant):
        ls = self.by_variant[variant]
        return (min(l.box[0] for l in ls), min(l.box[1] for l in ls), max(l.box[2] for l in ls), max(l.box[3] for l in ls))


def overlap(a, b) -> float:
    """Intersection over the smaller box."""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / smaller if smaller > 0 else 0.0


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", t.lower()).strip()


class SlideReader:
    UPSCALE_TO = 1440

    def __init__(self):
        self.default = RapidOCR()
        self.loose = RapidOCR(params={"Det.box_thresh": 0.4, "Det.thresh": 0.2, "Det.unclip_ratio": 1.8})

    # ---- variants -------------------------------------------------------
    def _upscaled(self, img):
        h, w = img.shape[:2]
        s = self.UPSCALE_TO / max(h, w)
        if s <= 1.05:
            return img, 1.0
        return cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC), s

    def _run(self, engine, img, scale, variant) -> list:
        r = engine(img)
        if r.boxes is None or r.txts is None:
            return []
        lines = []
        for poly, text, score in zip(r.boxes, r.txts, r.scores):
            text = (text or "").strip()
            if not text or score < 0.5 or CJK.search(text):
                continue
            xs, ys = poly[:, 0] / scale, poly[:, 1] / scale
            lines.append(Line(text, float(score), (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())), variant))
        return lines

    # ---- merge ----------------------------------------------------------
    @staticmethod
    def _cluster(lines: list) -> list:
        clusters: list = []
        for line in sorted(lines, key=lambda l: -l.score):
            best, best_ov = None, 0.5
            for c in clusters:
                ov = overlap(c.box, line.box)
                if ov > best_ov:
                    best, best_ov = c, ov
            if best is None:
                clusters.append(Cluster(list(line.box)))
                best = clusters[-1]
            best.add(line)
        return clusters

    @staticmethod
    def _pick(cluster: Cluster, n_variants: int):
        cands = cluster.candidates()
        votes = {}
        for _, text, _ in cands:
            votes[norm(text)] = votes.get(norm(text), 0) + 1
        best = None
        for variant, text, score in cands:
            fixed = fix_words(text)
            plaus = plausibility(fixed)
            support = votes[norm(text)] - 1
            q = score * (0.35 + 0.65 * plaus) + 0.04 * support
            if best is None or q > best[0]:
                best = (q, fixed, score, plaus, len(cands), variant)
        q, text, score, plaus, seen_by, variant = best
        # A line only one variant saw, with weak evidence, is most likely noise.
        if seen_by == 1 and n_variants > 1 and (score < 0.85 or plaus < 0.5):
            return None
        if q < 0.45:
            return None
        return text, q, cluster.variant_box(variant)

    def _confident(self, clusters, n_variants, img_h, handle) -> bool:
        if not clusters:
            return False
        for c in clusters:
            cands = c.candidates()
            if any(self._is_noise(t, c.box, img_h, handle) for _, t, _ in cands):
                continue
            if len(cands) < n_variants:
                return False
            if len({norm(t) for _, t, _ in cands}) > 1:
                return False
            if min(s for _, _, s in cands) < 0.9 or plausibility(cands[0][1]) < 0.85:
                return False
        return True

    # ---- public ---------------------------------------------------------
    def read(self, img, handle: str | None = None) -> dict:
        h, w = img.shape[:2]
        up, s = self._upscaled(img)
        lines = self._run(self.default, img, 1.0, "orig")
        lines += self._run(self.loose, up, s, "up")
        n_variants = 2
        if not self._confident(self._cluster(lines), 2, h, handle):
            smooth = cv2.bilateralFilter(up, 9, 75, 75)
            lines += self._run(self.loose, smooth, s, "smooth")
            n_variants = 3

        kept = []
        for c in self._cluster(lines):
            picked = self._pick(c, n_variants)
            if not picked:
                continue
            text, q, box = picked
            if self._is_noise(text, box, h, handle):
                continue
            kept.append(Line(text, q, box, "merged"))

        paragraphs = self._paragraphs(kept)
        conf = round(statistics.mean(l.score for l in kept), 3) if kept else 0.0
        return {"paragraphs": paragraphs, "confidence": min(conf, 1.0), "passes": n_variants}

    @staticmethod
    def _is_noise(text, box, img_h, handle) -> bool:
        t = text.strip()
        if HANDLE.match(t) or ARROWS_ONLY.match(t) or SWIPE.match(t):
            return True
        if handle and norm(t).lstrip("@") == handle.lower():
            return True
        edge = box[3] < img_h * 0.12 or box[1] > img_h * 0.88
        if edge and PAGE_COUNTER.match(t):
            return True
        return len(re.sub(r"\W", "", t)) == 0

    @staticmethod
    def _paragraphs(lines: list) -> list:
        if not lines:
            return []
        lines = sorted(lines, key=lambda l: (l.cy, l.box[0]))
        # Rows: lines sharing the same baseline band are read left to right.
        rows: list = []
        for l in lines:
            if rows:
                r = rows[-1]
                ry0, ry1 = min(x.box[1] for x in r), max(x.box[3] for x in r)
                ov = min(ry1, l.box[3]) - max(ry0, l.box[1])
                if ov > 0.5 * min(l.h, ry1 - ry0):
                    r.append(l)
                    continue
            rows.append([l])
        rows = [sorted(r, key=lambda x: x.box[0]) for r in rows]

        paras, cur, prev = [], [], None
        for r in rows:
            y0, y1 = min(x.box[1] for x in r), max(x.box[3] for x in r)
            hgt = y1 - y0
            x0, x1 = min(x.box[0] for x in r), max(x.box[2] for x in r)
            if prev:
                py0, py1, ph, px0, px1 = prev
                gap = y0 - py1
                size_jump = max(hgt, ph) / max(1, min(hgt, ph)) > 1.7
                no_h_overlap = min(x1, px1) - max(x0, px0) < 0
                list_item = bool(LIST_ITEM.match(r[0].text))
                if gap > 0.9 * min(hgt, ph) or size_jump or no_h_overlap or list_item:
                    paras.append(cur)
                    cur = []
            cur.append(" ".join(x.text for x in r))
            prev = (y0, y1, hgt, x0, x1)
        if cur:
            paras.append(cur)

        out = []
        for p in paras:
            text = ""
            for part in p:
                if text.endswith("-") and part[:1].islower():
                    text = text[:-1] + part
                else:
                    text = f"{text} {part}".strip()
            out.append(re.sub(r"\s+([,.;:!?])", r"\1", text))
        return out
