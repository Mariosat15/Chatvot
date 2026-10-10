/**
 * R87 — every collection either app declares is either CLEARED by the reset or
 * explicitly PRESERVED, and every raw name the reset clears is real.
 *
 * WHY THIS IS STRUCTURAL AND NOT BEHAVIOURAL. The reset is a hand-maintained
 * list of collections. Nothing fails when a collection is missing from it: the
 * reset reports success, the admin screen shows a tidy per-collection count, and
 * the rows it never touched simply stay. That is how `chargebacks`,
 * `securityalerts`, `termsacceptances`, the messaging feature's `user_presence`
 * and nine others survived every reset — and it is why the guard has to compare
 * the list against the MODELS rather than against a behaviour.
 *
 * The dangerous direction is the other one: `deleteMany` against a collection
 * name that does not exist returns 0, so a typo is indistinguishable from an
 * empty collection. `"alerts"` sat in the raw list for months doing exactly
 * nothing while the real collection, `pricehealthalerts`, was never cleared.
 *
 * Both apps' model directories are read, because a collection declared only in
 * the main app is still a collection in the one database the reset runs against
 * — `apps/admin` having no copy to import is the reason those are cleared by raw
 * name, not a reason to skip them.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const MODEL_DIRS = [
  path.join(ROOT, "database/models"),
  path.join(ROOT, "apps/admin/database/models"),
];
const RESET_FILE = path.join(
  ROOT,
  "apps/admin/lib/services/user-data-reset.service.ts",
);

const resetSource = fs.readFileSync(RESET_FILE, "utf8");

// Mongoose's own pluralizer, not a hand-rolled one: the default collection name
// is whatever this function returns, so reimplementing it is a second answer to
// "what is this model's collection".
const pluralize = mongoose.pluralize() as (name: string) => string;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".model.ts")) out.push(full);
  }
  return out;
}

interface Declared {
  /** Repository-relative path with `apps/admin/` stripped, so the two apps' mirrored copies collapse. */
  importSuffix: string;
  file: string;
  collection: string;
}

/** Turns `model<IFoo>("Foo"` into `model("Foo"` so one pattern covers both spellings. */
function stripTypeArguments(code: string): string {
  return code.replace(/<[^<>]*>/g, "");
}

function parseModels(file: string): Declared[] {
  const code = fs.readFileSync(file, "utf8");

  // Every `model("Name"` / `model<Iface>("Name"` registration in the file. A file
  // may register more than one — platform-financials declares two.
  const names = [
    // Reason: the type argument is stripped in a separate pass rather than matched as an
    // optional group. `(?:<[^>]*>)?` puts a `*` inside a `?`, which eslint-plugin-security
    // rejects as an unsafe regex — two passes keep every quantifier at depth one.
    ...stripTypeArguments(code).matchAll(
      /\bmodel\(\s*["']([A-Za-z0-9_]+)["']/g,
    ),
  ].map((m) => m[1]);
  const explicit = [...code.matchAll(/collection:\s*["']([^"']+)["']/g)].map(
    (m) => m[1],
  );

  const unique = [...new Set(names)];
  const relative = path.relative(ROOT, file).replace(/\\/g, "/");
  const importSuffix = relative
    .replace(/^apps\/admin\//, "")
    .replace(/\.ts$/, "");

  return unique.map((modelName, i) => ({
    file: relative,
    importSuffix,
    collection:
      unique.length === explicit.length
        // eslint-disable-next-line security/detect-object-injection -- `i` is the map index over `unique`, and the branch is only taken when the two arrays are the same length.
        ? explicit[i]
        : explicit.length === 1 && unique.length === 1
          ? explicit[0]
          : pluralize(modelName).toLowerCase(),
  }));
}

/**
 * The quoted strings of a named array literal in the reset service.
 *
 * Read from the source rather than imported: the service imports ~50 models
 * through the `@/` alias, which vitest resolves to the repository root and not
 * to the admin app (R58), so importing it would either fail or silently examine
 * the main app's copies.
 */
function arrayLiteral(name: string): string[] {
  const start = resetSource.indexOf(`const ${name}`);
  expect(start, `${name} is not declared in the reset service`).toBeGreaterThan(
    -1,
  );
  const end = resetSource.indexOf("];", start);
  expect(end, `${name} is not terminated`).toBeGreaterThan(start);
  const body = resetSource.slice(start, end);
  // Comments first, or a collection named in a `// Reason:` note counts as listed.
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...code.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

const RAW_CLEARED = arrayLiteral("ACTIVITY_RAW_COLLECTIONS");
const LEGACY = arrayLiteral("LEGACY_RAW_COLLECTIONS");
const ZEROED = arrayLiteral("ZEROED_COLLECTIONS");
const PRESERVED = arrayLiteral("PRESERVED_CONFIG_COLLECTIONS");

/** Identifiers listed in the ACTIVITY_MODELS tuples, mapped back to their import paths. */
function modelBackedSuffixes(): Set<string> {
  const start = resetSource.indexOf("const ACTIVITY_MODELS");
  const end = resetSource.indexOf("];", start);
  const body = resetSource.slice(start, end);
  const identifiers = new Set(
    [...body.matchAll(/\[\s*["'][^"']+["']\s*,\s*([A-Za-z0-9_]+)\s*\]/g)].map(
      (m) => m[1],
    ),
  );

  const suffixes = new Set<string>();
  for (const match of resetSource.matchAll(
    /import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+["']@\/([^"']+)["']/g,
  )) {
    const bound = match[1]
      ? [match[1]]
      : match[2].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()!.trim());
    if (bound.some((name) => identifiers.has(name))) suffixes.add(match[3]);
  }
  return suffixes;
}

const MODEL_BACKED = modelBackedSuffixes();

const declared = MODEL_DIRS.flatMap((dir) => walk(dir).flatMap(parseModels));
const byCollection = new Map<string, Declared[]>();
for (const entry of declared) {
  const list = byCollection.get(entry.collection) ?? [];
  list.push(entry);
  byCollection.set(entry.collection, list);
}

describe("R87 — the reset accounts for every collection that exists", () => {
  it("reads both apps' model directories", () => {
    // A slice that found nothing passes everything asked of it, so the size is
    // asserted before anything is concluded from it.
    expect(declared.length).toBeGreaterThan(100);
    expect(byCollection.size).toBeGreaterThan(100);
    expect(MODEL_BACKED.size).toBeGreaterThan(20);
    expect(RAW_CLEARED.length).toBeGreaterThan(20);
    expect(PRESERVED.length).toBeGreaterThan(20);
    expect(ZEROED.length).toBeGreaterThan(0);
  });

  it("classifies every declared collection as cleared, zeroed or preserved", () => {
    const unclassified: string[] = [];
    for (const [collection, list] of byCollection) {
      const cleared =
        RAW_CLEARED.includes(collection) ||
        list.some((d) => MODEL_BACKED.has(d.importSuffix));
      if (
        cleared ||
        ZEROED.includes(collection) ||
        PRESERVED.includes(collection)
      )
        continue;
      unclassified.push(`${collection} (${list.map((d) => d.file).join(", ")})`);
    }
    expect(
      unclassified,
      "these collections are neither cleared by the reset nor listed as deliberately preserved",
    ).toEqual([]);
  });

  it("never both clears and preserves the same collection", () => {
    // Reason: the two lists are the whole contract. A name in both means the
    // preserve comment is a lie, or the delete is — and whichever it is, the
    // test above passes either way, so it cannot be the thing that catches it.
    const both = [...PRESERVED, ...ZEROED].filter((name) =>
      RAW_CLEARED.includes(name),
    );
    expect(both, "listed as preserved or zeroed AND cleared").toEqual([]);
  });

  it("clears no raw name that matches no collection, unless it is listed as legacy", () => {
    const unknown = RAW_CLEARED.filter(
      (name) => !byCollection.has(name) && !LEGACY.includes(name),
    );
    expect(
      unknown,
      "these raw names match no declared collection, so deleteMany silently affects nothing",
    ).toEqual([]);
  });

  it("carries no legacy exemption for a collection that does exist", () => {
    // A stale exemption is the failure mode that matters here: it reads as
    // "this one is known to be dead" long after a model started declaring it,
    // and it exempts that real collection from the check above.
    const alive = LEGACY.filter((name) => byCollection.has(name));
    expect(alive, "exempted as legacy but a model declares it").toEqual([]);
  });

  it("clears the collections the owner reported as surviving a reset", () => {
    // Reason: R87's own report. Named explicitly rather than left to the
    // classification above, because the general check goes green the moment a
    // collection is added to EITHER list — including the preserve list.
    for (const collection of [
      "chargebacks",
      "securityalerts",
      "termsacceptances",
      "user_presence",
      "game_round",
      "provider_event",
      "blocked_users",
      "pricehealthalerts",
    ]) {
      expect(RAW_CLEARED, `${collection} is not cleared`).toContain(collection);
      expect(PRESERVED, `${collection} is preserved`).not.toContain(collection);
    }
  });
});
