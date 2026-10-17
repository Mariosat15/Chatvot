/**
 * Make the Overview card's Challenge and Matching Cards art one identical size.
 *
 * Reason: owner, 3 Oct 2026 - "make these the same size". The two supplied
 * arts have different shapes (Challenge's solid pill is ~4.6:1, Matching
 * Cards' ~3.7:1), so no shared box can show both at the same height AND width.
 * This crops each to its solid pill plus an equal glow margin, then resizes
 * both to one common canvas whose ratio is the geometric mean of the two, so
 * each is stretched or squeezed by the same ~10% - well under what reads as
 * distortion on a glowing pill - and the pair render pixel-identical in size.
 *
 *   node tools/overview/fit-button-pair.mjs
 */
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/assets/neon/overview/compete");
const PAIR = [
  ["btn-challenge-v2.png", "btn-challenge-v3.png"],
  ["btn-matching-cards-hr.png", "btn-matching-cards-v3.png"],
];
/** Alpha a pixel needs to count as the solid pill rather than its glow. */
const SOLID_ALPHA = 200;
/** Glow kept around the pill, as a share of the pill's own height. */
const GLOW_SHARE = 0.1;
const OUT_WIDTH = 960;

async function cropToPill(file) {
  const img = sharp(path.join(ROOT, file)).ensureAlpha();
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > SOLID_ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const margin = Math.round((y1 - y0 + 1) * GLOW_SHARE);
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  const width = Math.min(info.width, x1 + margin + 1) - left;
  const height = Math.min(info.height, y1 + margin + 1) - top;
  return { img, region: { left, top, width, height }, ratio: width / height };
}

const crops = await Promise.all(PAIR.map(([src]) => cropToPill(src)));
const ratio = Math.sqrt(crops[0].ratio * crops[1].ratio);
const outHeight = Math.round(OUT_WIDTH / ratio);

for (let i = 0; i < PAIR.length; i++) {
  const { img, region } = crops[i];
  const dest = path.join(ROOT, PAIR[i][1]);
  await img
    .extract(region)
    .resize(OUT_WIDTH, outHeight, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`${PAIR[i][1]}  ${OUT_WIDTH}x${outHeight}  (crop ratio ${crops[i].ratio.toFixed(2)})`);
}
console.log(`shared ratio ${ratio.toFixed(3)}`);
