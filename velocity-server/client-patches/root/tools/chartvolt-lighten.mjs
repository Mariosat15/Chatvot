// ChartVolt patch (28 Sep 2026): make the single-file build lighter.
// 1. Six 4K rock textures -> 2K copies (the runtime already caps textures per quality setting).
// 2. Soundtrack ships MP3 only (every browser decodes it); the OGG copies were a second copy of the same music.
// The 4K and OGG source files stay on disk untouched - only the imports change - so this is reversible.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

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
console.log("lighten patch applied");
