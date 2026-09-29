"""One-shot: hide baked right-edge letters and pad top so the standing figure crops better."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "public" / "assets" / "neon" / "overview" / "hero-banner.png"


def main() -> None:
    im = Image.open(PATH).convert("RGBA")
    w, h = im.size
    print("size", w, h)

    # Soft navy wash over the far-right baked vertical text.
    cover_w = max(40, int(w * 0.12))
    fade = Image.new("RGBA", (cover_w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fade)
    for x in range(cover_w):
        a = int(255 * (x / max(1, cover_w - 1)) ** 0.7)
        draw.line([(x, 0), (x, h)], fill=(5, 11, 24, a))
    im.paste(fade, (w - cover_w, 0), fade)

    # Pad top with stretched sky so object-cover has room above the figure.
    pad_top = int(h * 0.18)
    out = Image.new("RGBA", (w, h + pad_top), (5, 11, 24, 255))
    top = im.crop((0, 0, w, 8)).resize((w, pad_top))
    out.paste(top, (0, 0))
    out.paste(im, (0, pad_top), im)
    out.convert("RGB").save(PATH, "PNG", optimize=True)
    print("saved", PATH, out.size)


if __name__ == "__main__":
    main()
