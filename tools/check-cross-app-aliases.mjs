/**
 * Walks the import graph from the main app's worker jobs and reports any "@/"
 * specifier that does not also resolve under apps/admin.
 *
 * Reason: admin routes import worker jobs, so the admin build compiles main-app
 * files with "@/" pointing at apps/admin. A specifier that exists only in the
 * main app fails the admin build with a module-not-found that names a file the
 * admin app does not own.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const admin = path.join(root, "apps", "admin");

function resolveFile(base) {
  for (const c of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function specifiers(file) {
  const src = readFileSync(file, "utf8");
  const out = [];
  const re = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Reason: seed from the real boundary crossings - an admin file whose relative
// import resolves outside apps/admin. Seeding from every worker job instead
// over-approximates, because the admin build only compiles what it reaches.
function seedFiles() {
  const seeds = new Set();
  for (const file of walkDir(admin)) {
    for (const spec of specifiers(file)) {
      if (!spec.startsWith(".")) continue;
      const target = resolveFile(path.resolve(path.dirname(file), spec));
      if (target && !target.startsWith(admin + path.sep)) seeds.add(target);
    }
  }
  return [...seeds];
}

const seen = new Set();
const missing = new Map();
const entryPoints = seedFiles();
const queue = [...entryPoints];

while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);

  for (const spec of specifiers(file)) {
    if (spec.startsWith("@/")) {
      // Reason: inside the admin build "@/" means apps/admin, so the admin
      // copy is what gets compiled and its own graph is already known good.
      // Prune there. Only an absent copy is the failure, and that is exactly
      // the one error the build reports.
      if (!resolveFile(path.join(admin, spec.slice(2)))) {
        if (!missing.has(spec)) missing.set(spec, new Set());
        missing.get(spec).add(path.relative(root, file).replace(/\\/g, "/"));
      }
      continue;
    }
    if (!spec.startsWith(".")) continue;
    const target = resolveFile(path.resolve(path.dirname(file), spec));
    if (target) queue.push(target);
  }
}

console.log(
  `Entry points from apps/admin into the main app: ${entryPoints.length}`,
);
for (const e of entryPoints) {
  console.log(`  ${path.relative(root, e).replace(/\\/g, "/")}`);
}
console.log(`Walked ${seen.size} main-app files reachable from them.`);
if (missing.size === 0) {
  console.log("OK - every '@/' specifier also resolves under apps/admin.");
} else {
  for (const [spec, importers] of missing) {
    console.log(`MISSING in apps/admin: ${spec}`);
    for (const i of importers) console.log(`    imported by ${i}`);
  }
  process.exitCode = 1;
}
