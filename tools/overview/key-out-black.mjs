/**
 * Turn the Suggested-for-You plates (neon art drawn on an opaque black canvas)
 * into genuinely transparent PNGs, cropped to the artwork.
 *
 * Reason: `mix-blend-screen` only hides black over a dark page and leaves the
 * padding in the layout box, which is why the badges rendered tiny and the
 * plates showed black edges. Un-screening (alpha = brightest channel, colour
 * divided back out) composites identically over black and cleanly over anything.
 *
 *   node tools/overview/key-out-black.mjs
 */
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public/assets/neon/overview");
const JOBS = [
  ["suggested/icon-clock.jpg", "suggested/icon-clock-clear.png"],
  ["suggested/icon-users.jpg", "suggested/icon-users-clear.png"],
  ["items/icon-star.jpg", "suggested/icon-star-clear.png"],
  // Owner's high-resolution replacements (3 Oct 2026). Kept at full source
  // resolution so the browser only ever downscales them - never blurry.
  ["suggested/src-badge-private.jpg", "suggested/badge-private-hr.png"],
  ["suggested/src-badge-public.jpg", "suggested/badge-public-hr.png"],
  ["suggested/src-badge-gm.png", "suggested/badge-gm-hr.png"],
  // Reason: the Join source carries a wide low-brightness glow that read as fog
  // around the button (owner, 3 Oct 2026); `haze` keys that faint layer out.
  ["suggested/src-join.jpg", "suggested/btn-join-hr.png", null, { haze: 70 }],
  ["suggested/src-prize-icon.jpg", "suggested/prize-icon-hr.png"],
  ["compete/src-view-leaderboard.png", "compete/btn-view-leaderboard-hr.png"],
  ["compete/src-challenge.png", "compete/btn-challenge-hr.png"],
  ["compete/src-matching-cards.png", "compete/btn-matching-cards-hr.png"],
];
/** Below this brightness a pixel is JPEG noise on the black canvas, not art. */
const NOISE_FLOOR = 14;
/** Alpha a pixel needs to count as artwork when cropping. */
const CROP_ALPHA = 28;
const PAD = 6;

async function keyOut(src, dest, region, opts = {}) {
  const haze = opts.haze ?? NOISE_FLOOR;
  let image = sharp(path.join(ROOT, src)).removeAlpha();
  if (region) {
    // The plate's frame lines are bright, so the region is cut from the
    // already-trimmed artwork bounds of the source, not from the raw canvas.
    const { info: full } = await sharp(path.join(ROOT, src))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bounds = await artworkBounds(src, full.width, full.height);
    const left = bounds.left + Math.round(bounds.width * region.x0);
    const top = bounds.top + Math.round(bounds.height * region.y0);
    image = image.extract({
      left,
      top,
      width: bounds.left + Math.round(bounds.width * region.x1) - left,
      height: bounds.top + Math.round(bounds.height * region.y1) - top,
    });
  }
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const cropAlpha = region?.cropAlpha ?? CROP_ALPHA;
  const out = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let i = 0, p = 0; i < data.length; i += 3, p += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const peak = Math.max(r, g, b);
    // Above the haze floor, alpha is rescaled so bright art keeps full opacity
    // while the faint glow below it fades to nothing; colour still un-screens by peak.
    const a =
      peak <= haze
        ? 0
        : haze === NOISE_FLOOR
          ? peak
          : Math.round(((peak - haze) * 255) / (255 - haze));
    if (a > 0) {
      out[p] = Math.min(255, Math.round((r * 255) / peak));
      out[p + 1] = Math.min(255, Math.round((g * 255) / peak));
      out[p + 2] = Math.min(255, Math.round((b * 255) / peak));
      out[p + 3] = a;
    }
    if (a >= cropAlpha) {
      const x = (i / 3) % width;
      const y = Math.floor(i / 3 / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`${src}: no artwork found`);

  const left = Math.max(0, minX - PAD);
  const top = Math.max(0, minY - PAD);
  const w = Math.min(width, maxX + PAD + 1) - left;
  const h = Math.min(height, maxY + PAD + 1) - top;
  await sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: w, height: h })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, dest));
  console.log(`📊 ${dest}: ${w}x${h} (from ${width}x${height})`);
}

/** Bounding box of the artwork on a plate's black canvas (the full-plate trim). */
async function artworkBounds(src, width, height) {
  const { data } = await sharp(path.join(ROOT, src))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < data.length; i += 3) {
    if (Math.max(data[i], data[i + 1], data[i + 2]) < CROP_ALPHA) continue;
    const x = (i / 3) % width;
    const y = Math.floor(i / 3 / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const left = Math.max(0, minX - PAD);
  const top = Math.max(0, minY - PAD);
  return {
    left,
    top,
    width: Math.min(width, maxX + PAD + 1) - left,
    height: Math.min(height, maxY + PAD + 1) - top,
  };
}

for (const [src, dest, region, opts] of JOBS) await keyOut(src, dest, region, opts);
