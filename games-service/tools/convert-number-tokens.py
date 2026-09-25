"""Convert the owner's "numbers animations" pack into the terminal token sprites.

The pack is 40 PNGs, 1254x1254 RGBA, with unhelpful ChatGPT filenames. Sorted by modification
time they run number 1..10, four files per number, in the state order below - checked by eye on a
labelled contact sheet (25 Sep 2026), not assumed from the names.

Writes public/play/num-{n}-{state}.webp at 256px, the size the old token-N.webp files were.

Usage (from games-service/):  python tools/convert-number-tokens.py "<pack directory>"
"""

import os
import sys

from PIL import Image

STATES = ("idle", "select", "connect", "error")
SIZE = 256


def main() -> None:
    pack = sys.argv[1]
    files = sorted(
        (f for f in os.listdir(pack) if f.lower().endswith(".png")),
        key=lambda f: os.path.getmtime(os.path.join(pack, f)),
    )
    if len(files) != 40:
        sys.exit(f"expected 40 PNGs, found {len(files)} - the ordering assumption no longer holds")
    out = os.path.join(os.path.dirname(__file__), "..", "public", "play")
    for index, name in enumerate(files):
        number = index // 4 + 1
        state = STATES[index % 4]
        image = Image.open(os.path.join(pack, name)).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
        image.save(os.path.join(out, f"num-{number}-{state}.webp"), "WEBP", quality=88, method=6)
    print(f"wrote {len(files)} sprites to {os.path.normpath(out)}")


if __name__ == "__main__":
    main()
