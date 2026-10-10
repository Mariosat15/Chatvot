// Rebuilds the Volt Velocity race client from the original vendor package plus our patches.
//
//   node tools/games/rebuild-velocity-client.mjs [--zip <path>] [--tree <dir>] [--fresh] [--no-pack]
//
// 1. Unpacks the asset-complete vendor zip into --tree (default %TEMP%/vvfull) unless it is there.
// 2. Copies every velocity-server/src/*.js over the vendor src/ (so the client simulates exactly
//    what the race server simulates), then velocity-server/client-patches/*.js and root/.
// 3. Runs the lighten tool, installs the pinned build tools, builds, runs the vendor tests.
// 4. Gzips the single-file build to games-service/vendor/ and runs the asset packer.
//
// Reason: the vendor tree lives outside this repository, so the only reproducible record of
// "what we ship" is this script plus the patch folders. Every step is idempotent.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { applyRoadTransforms } from "./velocity-road-transforms.mjs";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const zip = opt("--zip", path.join(os.homedir(), "Desktop/games/Volt-Velocity-0.21-Complete.zip"));
const root = opt("--tree", path.join(os.tmpdir(), "vvfull"));
const tree = path.join(root, "volt-velocity-3d");
const patches = path.join(repo, "velocity-server/client-patches");

// The one vendor test that pins behaviour the owner deliberately changed (a new weapon replaces
// the held one). Any other failure stops the rebuild.
const EXPECTED_VENDOR_FAILURES = ["one carried item, immediate repair and energy, no overwriting"];

const run = (cmd, cmdArgs, cwd = tree) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" });

if (args.includes("--fresh") && fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
if (!fs.existsSync(path.join(tree, "assets"))) {
  if (!fs.existsSync(zip)) throw new Error(`Vendor package not found: ${zip} (pass --zip)`);
  fs.mkdirSync(root, { recursive: true });
  console.log(`📦 Unpacking ${zip}`);
  run("tar", ["-xf", zip, "-C", root], root);
}

const copyDir = (from, to) => fs.cpSync(from, to, { recursive: true, force: true });
for (const f of fs.readdirSync(path.join(repo, "velocity-server/src")).filter((n) => n.endsWith(".js")))
  fs.copyFileSync(path.join(repo, "velocity-server/src", f), path.join(tree, "src", f));
for (const f of fs.readdirSync(patches).filter((n) => n.endsWith(".js")))
  fs.copyFileSync(path.join(patches, f), path.join(tree, "src", f));
copyDir(path.join(patches, "root"), tree);
fs.renameSync(path.join(tree, "landscape-manifest.json"), path.join(tree, "assets/landscape/manifest.json"));
const widened = await applyRoadTransforms({ repo, zip, tree });
console.log(`🔄 Patches applied (${widened} vendor files widened for the road)`);

run("node", ["tools/chartvolt-lighten.mjs"]);
if (!fs.existsSync(path.join(tree, "node_modules/esbuild")))
  run("npm", ["i", "--no-save", "three@0.186.1", "esbuild@0.25.12"]);
run("node", ["tools/build.mjs"]);

const testFiles = fs.readdirSync(path.join(tree, "tests")).filter((n) => /\.test\.m?js$/.test(n)).map((n) => `tests/${n}`);
let report = "";
try {
  report = execFileSync("node", ["--test", "--test-reporter=tap", ...testFiles], { cwd: tree, encoding: "utf8" });
} catch (error) {
  report = String(error.stdout ?? "");
}
const failed = [...report.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
const unexpected = failed.filter((name) => !EXPECTED_VENDOR_FAILURES.includes(name));
const passed = (report.match(/^# pass (\d+)/m) ?? [])[1];
console.log(`📊 Vendor tests: ${passed} passed, ${failed.length} failed (${failed.length - unexpected.length} expected)`);
if (unexpected.length) throw new Error(`Unexpected vendor test failures:\n  ${unexpected.join("\n  ")}`);

const built = path.join(tree, "dist/Volt-Velocity-3D.html");
const out = path.join(repo, "games-service/vendor/volt-velocity-client.html.gz");
fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(built), { level: 9 }));
console.log(`📊 ${(fs.statSync(built).size / 1048576).toFixed(1)} MB built -> ${(fs.statSync(out).size / 1048576).toFixed(1)} MB gz`);
if (!args.includes("--no-pack")) run("npx", ["tsx", "tools/games/pack-velocity-client.ts"], repo);
console.log("✅ Client rebuilt");
