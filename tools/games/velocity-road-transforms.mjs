// Vendor-file edits for the wider ChartVolt road (velocity-server/src/road-width.js).
//
// Our own patches replace whole files. These vendor files are NOT ours, so instead of
// forking them we re-read the pristine copy out of the vendor zip on every rebuild and
// apply exact replacements. Reason: reading from the zip (not the unpacked tree) makes
// the step idempotent, and demanding an exact match count makes a vendor update that
// moves a string fail the rebuild loudly instead of silently leaving a barrier inside
// the road.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const n = (x) => String(+x.toFixed(3));

/** Builds the replacement table from the road constants, so nothing here restates them. */
export async function roadTransforms(repo) {
  const width = await import(pathToFileURL(path.join(repo, "velocity-server/src/road-width.js")).href);
  const S = width.ROAD_SCALE;
  const limit = n(width.DRIVE_LIMIT);
  const half = n(width.ROAD_HALF_WIDTH);
  // Each entry: [from, to, expected occurrences].
  return {
    // Tunnel shell, floor slab and wall/lamp offsets grow with the road.
    "src/tunnel.js": [
      ["r=shell?20.2:19", `r=shell?${n(20.2 * S)}:${n(19 * S)}`, 1],
      ["box(concrete,43,2.8,len,at(0,-3.8),q)", `box(concrete,${n(43 * S)},2.8,len,at(0,-3.8),q)`, 1],
      ["at=(x,y)=>f.p.clone().addScaledVector(f.right,x)", `at=(x,y)=>f.p.clone().addScaledVector(f.right,x*${S})`, 2],
    ],
    // Bridge deck edges. The sign*12 support sits under the road and is left alone.
    "src/architecture.js": [
      ["addScaledVector(f.right,side*16.8)", `addScaledVector(f.right,side*${n(16.8 * S)})`, 1],
      ["at=(x,y)=>f.p.clone().addScaledVector(f.right,sign*x)", `at=(x,y)=>f.p.clone().addScaledVector(f.right,sign*x*${S})`, 1],
    ],
    // Trackside boards, sector gantries and pit furniture.
    "src/motorsport-kit.js": [
      ["addScaledVector(f.right,side*19.8)", `addScaledVector(f.right,side*${n(19.8 * S)})`, 1],
      ["lateral:side*19.8", `lateral:side*${n(19.8 * S)}`, 1],
      ["at=(x,y,z=0)=>f.p.clone().addScaledVector(f.right,x)", `at=(x,y,z=0)=>f.p.clone().addScaledVector(f.right,x*${S})`, 1],
      ["addScaledVector(f.right,side*18.4)", `addScaledVector(f.right,side*${n(18.4 * S)})`, 1],
    ],
    "src/hover.js": [["addScaledVector(f.right,sign*16)", `addScaledVector(f.right,sign*${half})`, 1]],
    "src/racing-guide.js": [["Math.sign(p.lane)*18", `Math.sign(p.lane)*${n(18 * S)}`, 1]],
    // Vendor tests keep their coverage; only the pinned width moves.
    "tests/simulation.test.mjs": [
      ["Math.abs(a.lateral)<=13.3&&Math.abs(b.lateral)<=13.3", `Math.abs(a.lateral)<=${limit}&&Math.abs(b.lateral)<=${limit}`, 1],
    ],
    "tests/content.test.mjs": [["Math.abs(p.lane)<=8)", `Math.abs(p.lane)<=${n(8 * S)})`, 1]],
    "tests/upgrade21.test.mjs": [["Math.abs(s.lane)+2.5<13.3", `Math.abs(s.lane)+2.5<${limit}`, 1]],
    "tests/circuit-smoothing.test.mjs": [
      ["addScaledVector(f.right,-16)", `addScaledVector(f.right,-${half})`, 1],
      ["addScaledVector(f.right,16)", `addScaledVector(f.right,${half})`, 1],
    ],
  };
}

/** Rewrites each listed file in `tree` from its pristine zip copy. Throws on any mismatch. */
export async function applyRoadTransforms({ repo, zip, tree }) {
  const table = await roadTransforms(repo);
  for (const [rel, pairs] of Object.entries(table)) {
    let text = execFileSync("tar", ["-xOf", zip, `volt-velocity-3d/${rel}`], { encoding: "utf8", maxBuffer: 64 << 20 });
    for (const [from, to, count] of pairs) {
      const found = text.split(from).length - 1;
      if (found !== count) throw new Error(`road transform: ${rel} has ${found}× "${from}", expected ${count}`);
      text = text.split(from).join(to);
    }
    fs.writeFileSync(path.join(tree, rel), text);
  }
  return Object.keys(table).length;
}
