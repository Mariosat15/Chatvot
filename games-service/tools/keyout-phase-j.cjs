/**
 * Phase J FX: convert generated PNGs (black plate) → WebP with near-black keyed out.
 * Run from repo: node games-service/tools/keyout-phase-j.cjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-cybes-Desktop-TradingApp-Chartvolt",
  "assets",
);
const DEST = path.join(__dirname, "..", "public", "play");

const FILES = [
  "fx-trail-glow.png",
  "fx-join-spark.png",
  "fx-cell-ripple.png",
  "fx-undo-ghost.png",
  "fx-terminal-wake.png",
  "fx-board-charge.png",
  "fx-result-corona.png",
  "fx-spark-bead.png",
];

/** Threshold: if R,G,B all below this, alpha → 0. Soft ramp above. */
const BLACK = 28;
const SOFT = 48;

async function keyout(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const lum = Math.max(r, g, b);
    if (lum <= BLACK) {
      out[i + 3] = 0;
    } else if (lum < SOFT) {
      out[i + 3] = Math.round(((lum - BLACK) / (SOFT - BLACK)) * out[i + 3]);
    }
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(outputPath);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing assets folder:", SRC);
    process.exit(1);
  }
  for (const name of FILES) {
    const src = path.join(SRC, name);
    if (!fs.existsSync(src)) {
      console.warn("skip missing", name);
      continue;
    }
    const dest = path.join(DEST, name.replace(/\.png$/i, ".webp"));
    await keyout(src, dest);
    const st = fs.statSync(dest);
    console.log("wrote", path.basename(dest), st.size, "bytes");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
