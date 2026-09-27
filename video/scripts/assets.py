"""Builds the slide images used by the promo: public/slides/*.png + slides.json (line boxes)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
OUT = ROOT.parent / "public" / "slides"
F = ROOT / "fonts"
THEMES = [((244, 239, 230), (20, 20, 20)), ((20, 20, 20), (245, 240, 232)), ((232, 222, 208), (40, 30, 25)),
          ((250, 250, 248), (10, 10, 10)), ((230, 0, 35), (255, 255, 255)), ((236, 232, 225), (60, 50, 45))]
FONTS = [("PlayfairDisplay-Italic%5Bwght%5D.ttf", 84), ("BebasNeue-Regular.ttf", 130), ("Montserrat%5Bwght%5D.ttf", 66),
         ("AbrilFatface-Regular.ttf", 84), ("Caveat%5Bwght%5D.ttf", 104)]


def slide(text, theme, font_i, size=(1080, 1350)):
    bg, fg = THEMES[theme]
    name, px = FONTS[font_i]
    im = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(str(F / name), px)
    try:
        f.set_variation_by_axes([700])
    except Exception:
        pass
    lines = text.split("\n")
    gap = int(px * 0.28)
    heights = [d.textbbox((0, 0), l, font=f)[3] - d.textbbox((0, 0), l, font=f)[1] for l in lines]
    total = sum(heights) + gap * (len(lines) - 1)
    y = (size[1] - total) / 2
    boxes = []
    for l, h in zip(lines, heights):
        bb = d.textbbox((0, 0), l, font=f)
        w = bb[2] - bb[0]
        x = (size[0] - w) / 2
        d.text((x - bb[0], y - bb[1]), l, font=f, fill=fg)
        boxes.append([x / size[0], y / size[1], w / size[0], h / size[1]])
        y += h + gap
    sm = ImageFont.truetype(str(F / "Montserrat%5Bwght%5D.ttf"), 26)
    d.text((60, size[1] - 70), "@mindset.daily", font=sm, fill=fg)
    return im, boxes


OUT.mkdir(parents=True, exist_ok=True)
meta = {"carousel": [], "thumbs": []}
carousel = [("Nessuno ti dirà\nquesta verità.", 0, 0), ("Il talento\nnon basta.", 1, 1), ("La costanza batte\nla motivazione.", 2, 2)]
for i, (t, th, fo) in enumerate(carousel):
    im, boxes = slide(t, th, fo)
    im.save(OUT / f"c{i}.png")
    meta["carousel"].append({"src": f"slides/c{i}.png", "text": t.replace("\n", " "), "lines": t.split("\n"), "boxes": boxes})

posts = [("Nessuno ti dirà\nquesta verità.", "48.2K"), ("Sii gentile\ncon te stesso.", "39.1K"), ("5 abitudini che\ncambiano tutto", "31.8K"),
         ("Stop waiting for\nthe perfect moment.", "27.4K"), ("Perché dovrei\nascoltarti?", "22.9K"), ("Più fai,\npiù diventi capace.", "19.8K"),
         ("Your only limit\nis your mind.", "16.5K"), ("Chi trova un amico\ntrova un tesoro.", "14.2K")]
for i, (t, likes) in enumerate(posts):
    im, _ = slide(t, i % len(THEMES), i % len(FONTS))
    im.thumbnail((480, 600))
    im.save(OUT / f"t{i}.png")
    meta["thumbs"].append({"src": f"slides/t{i}.png", "likes": likes})
(OUT / "slides.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print("ok")
