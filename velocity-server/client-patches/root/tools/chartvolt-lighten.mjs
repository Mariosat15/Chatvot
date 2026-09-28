// ChartVolt patch (28 Sep 2026): make the single-file build lighter.
// 1. Six 4K rock textures -> 2K copies (the runtime already caps textures per quality setting).
// 2. Soundtrack ships MP3 only (every browser decodes it); the OGG copies were a second copy of the same music.
// 3-4. Step 7: lighter copies of the road, wall, night-sky, crowd and cliff textures (see below).
// The 4K, OGG and other source files stay on disk untouched - only the imports change - so this is reversible.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { reencodeGlbImages } from "./chartvolt-lighten-glb.mjs";

const require = createRequire(path.resolve("C:/Users/cybes/Desktop/TradingApp/Chartvolt/package.json"));
const sharp = require("sharp");

const dir = "assets/landscape";
const manifestFile = path.join(dir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const names = ["rock_3_diff", "rock_3_nor_gl", "rock_3_rough", "rock_face_diff", "rock_face_nor_gl", "rock_face_rough"];

for (const base of names) {
  const from = path.join(dir, `${base}_4k.webp`);
  const to = path.join(dir, `${base}_2k.webp`);
  const quality = base.includes("nor_gl") ? 90 : 82;
  await sharp(from).resize(2048, 2048, { fit: "inside" }).webp({ quality, effort: 6 }).toFile(to);
  manifest.sha256[`${base}_2k.webp`] = createHash("sha256").update(fs.readFileSync(to)).digest("hex");
  console.log(`${to}  ${(fs.statSync(from).size / 1048576).toFixed(2)} MB -> ${(fs.statSync(to).size / 1048576).toFixed(2)} MB`);
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

function replaceOnce(file, from, to) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes(to)) return;
  if (text.split(from).length !== 2) throw new Error(`${file}: expected one match for ${from}`);
  fs.writeFileSync(file, text.replace(from, to), "utf8");
}
for (const base of names) replaceOnce("src/environment.js", `landscape/${base}_4k.webp'`, `landscape/${base}_2k.webp'`);

let audio = fs.readFileSync("src/audio.js", "utf8");
for (const track of ["afterburn", "canopy", "ignition", "horizon"]) {
  audio = audio.replace(`import ${track} from '../assets/audio/${track}.ogg';\n`, "");
}
audio = audio.replace(
  "const sources=[afterburn,canopy,ignition,horizon],fallbacks=[afterburnFallback,canopyFallback,ignitionFallback,horizonFallback];",
  "/* CHARTVOLT PATCH (28 Sep 2026): MP3 only - the OGG copies doubled the bundle's music for no audible gain. */const fallbacks=[afterburnFallback,canopyFallback,ignitionFallback,horizonFallback],sources=fallbacks;",
);
if (audio.includes(".ogg'") || !audio.includes("sources=fallbacks")) throw new Error("audio.js patch did not apply");
fs.writeFileSync("src/audio.js", audio, "utf8");

// 3. Step 7 (28 Sep 2026): lighter copies of the heaviest textures. Measured before choosing:
//    colour/roughness at q80 and normal maps at q88 stay at 35-42 dB PSNR. Same resolution,
//    so the crowd atlas's pixel boxes in crowd/manifest.json stay valid.
const mb = (n) => (n / 1048576).toFixed(2);
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const qualityFor = (name) => (name.includes("nor") ? 88 : 80);
function register(dir, name) {
  const file = path.join(dir, "manifest.json");
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  m.sha256[name] = sha(path.join(dir, name));
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
}
const lighter = [
  ["src/environment.js", "assets/environment", "sky-night.webp", {}],
  ["src/environment.js", "assets/architecture", "asphalt_02_diff_2k.webp", {}],
  ["src/environment.js", "assets/architecture", "asphalt_02_nor_gl_2k.webp", {}],
  ["src/environment.js", "assets/architecture", "asphalt_02_rough_2k.webp", {}],
  ["src/environment.js", "assets/architecture", "concrete_wall_007_diff_2k.webp", {}],
  ["src/environment.js", "assets/architecture", "concrete_wall_007_nor_gl_2k.webp", {}],
  ["src/environment.js", "assets/architecture", "concrete_wall_007_rough_2k.webp", {}],
  // Reason: the crowd is alpha-tested, so the edge mask is kept lossless-grade (alphaQuality 100).
  ["src/spectators.js", "assets/crowd", "seated-spectators.png", { quality: 88, alphaQuality: 100 }],
];
for (const [src, dir, name, options] of lighter) {
  const outName = name.replace(/\.(webp|png)$/, "_cv.webp");
  const from = path.join(dir, name);
  const to = path.join(dir, outName);
  await sharp(from).webp({ quality: qualityFor(name), effort: 6, ...options }).toFile(to);
  register(dir, outName);
  replaceOnce(src, `${dir.replace("assets/", "")}/${name}'`, `${dir.replace("assets/", "")}/${outName}'`);
  console.log(`${to}  ${mb(fs.statSync(from).size)} MB -> ${mb(fs.statSync(to).size)} MB`);
}

// 4. The two scanned cliffs carry three 2K WebP textures each inside the .glb; re-encode those.
for (const base of ["rock_face_01", "rock_face_02"]) {
  const dir = "assets/scanned-cliffs";
  const from = path.join(dir, `${base}.glb`);
  const to = path.join(dir, `${base}_cv.glb`);
  await reencodeGlbImages(from, to, (name, bytes) =>
    sharp(bytes).webp({ quality: qualityFor(name), effort: 6 }).toBuffer());
  register(dir, `${base}_cv.glb`);
  replaceOnce("src/scanned-cliffs.js", `scanned-cliffs/${base}.glb'`, `scanned-cliffs/${base}_cv.glb'`);
  console.log(`${to}  ${mb(fs.statSync(from).size)} MB -> ${mb(fs.statSync(to).size)} MB`);
}
console.log("lighten patch applied");
