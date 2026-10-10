"""
Key near-black backgrounds to alpha for Overview neon assets.
Preserves soft neon glow by ramping alpha near the threshold.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(
    r"C:\Users\cybes\.cursor\projects\c-Users-cybes-Desktop-TradingApp-Chartvolt\assets"
)
OUT_DIR = Path(
    r"c:\Users\cybes\Desktop\TradingApp\Chartvolt\public\assets\neon\overview"
)


def key_black(src: Path, dest: Path, threshold: int = 28, soft: int = 22) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3.0
            # Near-black → transparent; soft ramp keeps glow halo.
            if lum <= threshold:
                px[x, y] = (r, g, b, 0)
            elif lum < threshold + soft:
                # Reason: hard cut clips the bloom; fade alpha with luminance.
                fade = int(a * (lum - threshold) / soft)
                px[x, y] = (r, g, b, fade)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG")
    print(f"OK {dest.name} {im.size}")


def main() -> None:
    jobs = [
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_93ad6cfc-461c-4ca0-914a-c124ee43d7cc-866967c5-21ae-46ef-b59b-f55b99e91ce3.png",
            OUT_DIR / "items" / "icon-activity-calendar.png",
            24,
            20,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__09_57_28_AM-5-b120884c-0c56-4f2f-bc71-8fe750eb33cf.png",
            OUT_DIR / "items" / "icon-trophy-glass.png",
            22,
            18,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__12_31_53_PM-5-e3115b76-b9d0-4b1f-9c6f-a378abb8abc1.jpg",
            OUT_DIR / "compete" / "icon-swords.png",
            26,
            22,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__12_31_55_PM-7-5a50e977-f206-4e16-aceb-5c0326d89aa3.png",
            OUT_DIR / "compete" / "icon-crown.png",
            24,
            20,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__12_31_54_PM-6-fbef25bd-2504-4c34-99f0-e7707ab86a8e.jpg",
            OUT_DIR / "compete" / "avatar-ring.png",
            22,
            18,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__12_31_52_PM-4-0e876822-a7ca-456f-8ff8-e71a6854af9c.png",
            OUT_DIR / "compete" / "btn-matching-cards.png",
            18,
            16,
        ),
        (
            "c__Users_cybes_AppData_Roaming_Cursor_User_workspaceStorage_db4b8b4c70f718af795c12995150af5a_images_ChatGPT_Image_Sep_29__2026__12_31_51_PM-3-4aa9cdfe-0cd1-4fda-97cc-a69d2168e5aa.png",
            OUT_DIR / "compete" / "btn-challenge.png",
            18,
            16,
        ),
    ]
    for name, dest, thr, soft in jobs:
        src = ASSETS / name
        if not src.exists():
            raise SystemExit(f"missing {src}")
        key_black(src, dest, threshold=thr, soft=soft)


if __name__ == "__main__":
    main()
