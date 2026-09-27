/**
 * Turns the Volt Velocity race client - one ~100 MB HTML file delivered by the game's own
 * toolchain - into a ~1 MB page plus separate asset files, and resizes the textures that were
 * shipped larger than the game uses.
 *
 *   npx tsx tools/games/pack-velocity-client.ts [path/to/client.html(.gz)]
 *
 * Input defaults to `games-service/vendor/volt-velocity-client.html.gz`, the build as delivered.
 * Output is `games-service/vendor/volt-velocity/` (`client.html`, `manifest.json`, `assets/`),
 * which is what games-service serves. Re-run it whenever a new client build arrives.
 *
 * WHY SPLIT
 * ---------
 * Every picture, sound and model was a base64 string inside one file, so: a third larger than the
 * real bytes; one byte of change re-downloads all of it; and Firefox will not cache any single
 * response over 50 MB, so its players downloaded it on every visit. Separate, content-hashed
 * files are cached individually and forever, and only a changed file is fetched again.
 *
 * WHY THIS IS SAFE WITHOUT THE SOURCE
 * -----------------------------------
 * Each asset is a quoted string literal handed to a three.js loader or an audio `url`, and every
 * one of those takes an ordinary URL. A relative `assets/<hash>.<ext>` resolves against the
 * client page's own address, so it works under the platform proxy and on a games subdomain alike.
 * The tool refuses to write anything if a data URI appears anywhere other than as a whole quoted
 * literal, because that would mean the build changed shape and the assumption needs re-checking.
 *
 * WHY THESE SIZE LIMITS
 * ---------------------
 * The client describes its own materials as "2K PBR", yet six stone maps shipped at 4096x4096
 * (about 30 MB). Textures are capped at 2048 on the short side and 4096 on the long side, so
 * those become 2048x2048 and the 8192x4096 skies become 4096x2048. A WebP already inside the
 * limits is re-encoded at the same quality only when that saves at least a quarter; otherwise it
 * is copied byte for byte. Models are already Draco/meshopt compressed and are untouched.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";

import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_INPUT = path.join(ROOT, "games-service", "vendor", "volt-velocity-client.html.gz");
const OUT_DIR = path.join(ROOT, "games-service", "vendor", "volt-velocity");
const ASSET_DIR = path.join(OUT_DIR, "assets");

const MAX_LONG_SIDE = 4096;
const MAX_SHORT_SIDE = 2048;
const WEBP_QUALITY = 90;

/** A whole quoted literal: `"data:<mime>;base64,<payload>"`. */
const LITERAL = /"data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)"/g;
const ANY_DATA_URI = /data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]{64}/g;

type Packed = { file: string; type: string; bytes: number; originalBytes: number; note: string };

function extensionFor(mime: string, bytes: Buffer): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "application/ogg" || mime === "audio/ogg") return "ogg";
  if (bytes.subarray(0, 4).toString("latin1") === "glTF") return "glb";
  if (bytes.subarray(0, 10).toString("latin1") === "#?RADIANCE") return "hdr";
  throw new Error(`Unrecognised asset (${mime}); extend extensionFor before packing this build.`);
}

async function shrinkImage(bytes: Buffer, ext: string): Promise<{ out: Buffer; note: string }> {
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const scale = Math.min(
    1,
    MAX_LONG_SIDE / Math.max(width, height),
    MAX_SHORT_SIDE / Math.min(width, height),
  );
  if (!(scale < 1)) {
    // Reason: several maps already at 2K shipped near-lossless. Re-encode at the same quality the
    // resized maps get, and keep the result only if it saves a quarter - re-encoding is lossy, so
    // a marginal saving is not worth a generation of loss.
    if (ext !== "webp") return { out: bytes, note: `${width}x${height} kept` };
    const again = await sharp(bytes).webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
    return again.length < bytes.length * 0.75
      ? { out: again, note: `${width}x${height} re-encoded` }
      : { out: bytes, note: `${width}x${height} kept` };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const pipeline = sharp(bytes).resize(w, h, { kernel: "lanczos3" });
  const out =
    ext === "png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
  return { out, note: `${width}x${height} -> ${w}x${h}` };
}

async function main(): Promise<void> {
  const input = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
  const raw = fs.readFileSync(input);
  // Reason: latin1 maps every byte to one char and back, so the page's UTF-8 text survives the
  // round trip untouched while the regexes work on the ASCII base64.
  const html = (input.endsWith(".gz") ? zlib.gunzipSync(raw) : raw).toString("latin1");

  const literals = [...html.matchAll(LITERAL)];
  const anyUris = html.match(ANY_DATA_URI)?.length ?? 0;
  if (literals.length === 0 || literals.length !== anyUris) {
    throw new Error(
      `Expected every data URI to be a whole quoted literal: ${literals.length} literals, ${anyUris} URIs.`,
    );
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(ASSET_DIR, { recursive: true });

  const packed: Packed[] = [];
  const replacements = new Map<string, string>();
  for (const match of literals) {
    const [literal, mime, payload] = match;
    if (replacements.has(literal)) continue;
    const original = Buffer.from(payload, "base64");
    const ext = extensionFor(mime, original);
    const { out, note } =
      ext === "webp" || ext === "png"
        ? await shrinkImage(original, ext)
        : { out: original, note: "copied" };
    const file = `${crypto.createHash("sha256").update(out).digest("hex").slice(0, 16)}.${ext}`;
    fs.writeFileSync(path.join(ASSET_DIR, file), out);
    replacements.set(literal, `"assets/${file}"`);
    packed.push({ file, type: mime, bytes: out.length, originalBytes: original.length, note });
  }

  const slim = html.replace(LITERAL, (literal) => replacements.get(literal) ?? literal);
  fs.writeFileSync(path.join(OUT_DIR, "client.html"), Buffer.from(slim, "latin1"));
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify({ source: path.basename(input), assets: packed }, null, 2)}\n`,
  );

  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  const before = raw.length;
  const after = slim.length + packed.reduce((sum, p) => sum + p.bytes, 0);
  for (const p of packed) console.log(`  ${p.file}  ${mb(p.originalBytes)} -> ${mb(p.bytes)}  ${p.note}`);
  console.log(`📦 ${packed.length} assets; page ${mb(slim.length)}; total ${mb(after)} (input file ${mb(before)})`);
}

main().catch((error) => {
  console.error("❌ pack-velocity-client:", error instanceof Error ? error.message : error);
  process.exit(1);
});
