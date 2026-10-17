/**
 * Imports the owner's Menuitems neon icon set (5 Oct 2026) into
 * `public/assets/neon/icons/`.
 *
 *   node tools/overview/import-menuitems.mjs
 *
 * The sources are already transparent, so no black keying is needed. Each one
 * is trimmed to its artwork, centred on a square transparent canvas (so every
 * slot renders it the same size and centred), and written at 320px - at least
 * 2x the largest icon box on Overview / Wallet Analytics, so the browser only
 * ever scales down and edges stay crisp.
 */
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "External game plans/design-reference/Menuitems";
const OUT = "public/assets/neon/icons";
const SIZE = 320;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Source filename -> served slug. Kebab-case, typo in `withdrwal` corrected. */
const SLUGS = new Map([
  ["BlueCalendar.png", "calendar-blue"],
  ["BlueChart.png", "chart-bars-blue"],
  ["BlueTrophy.png", "trophy-blue"],
  ["Chart.png", "chart-growth-orange"],
  ["Chart3.png", "chart-bars-red"],
  ["Clock.png", "clock"],
  ["Games.png", "games-orange"],
  ["GreenTrophy.png", "trophy-green"],
  ["Lightbulb.png", "lightbulb"],
  ["Picture2.png", "growth-green"],
  ["PurpleTarget.png", "target-purple"],
  ["PurpleWallet.png", "wallet-purple"],
  ["Star.png", "star"],
  ["Users.png", "users"],
  ["Wallet.png", "wallet-blue"],
  ["bluebolt.png", "bolt-blue"],
  ["calendar.png", "calendar-gold"],
  ["candles.png", "candles"],
  ["credits.png", "credits"],
  ["crown.png", "crown"],
  ["cubes.png", "cubes"],
  ["deposit.png", "deposit"],
  ["fire.png", "fire"],
  ["gamepad.png", "gamepad-blue"],
  ["gift.png", "gift"],
  ["purch.png", "purchases"],
  ["purpleTrophy.png", "trophy-purple"],
  ["rocketpurple.png", "rocket"],
  ["shield.png", "shield"],
  ["starachive.png", "achievement"],
  ["starcalendar.png", "calendar-star"],
  ["swords.png", "swords"],
  ["users2.png", "users-group"],
  ["withdrwal.png", "withdrawal"],
]);

mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC)) {
  const slug = SLUGS.get(file);
  if (!slug) {
    console.warn(`⚠️ Skipping unmapped Menuitems file: ${file}`);
    continue;
  }
  const trimmed = await sharp(path.join(SRC, file))
    .ensureAlpha()
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  const side = Math.max(trimmed.info.width, trimmed.info.height);
  await sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2),
      bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2),
      right: Math.ceil((side - trimmed.info.width) / 2),
      background: CLEAR,
    })
    .resize(SIZE, SIZE, { kernel: "lanczos3" })
    .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(path.join(OUT, `${slug}.webp`));
  console.log(`📦 ${file} -> ${OUT}/${slug}.webp`);
}
