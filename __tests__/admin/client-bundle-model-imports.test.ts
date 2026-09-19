/**
 * No `"use client"` file in EITHER app may reach the raw MongoDB driver.
 *
 * WHY THIS EXISTS, and it is not a style rule. On 9 September 2026 `GameScoringDialog.tsx`
 * imported `SCORE_UNIT_MAX_LENGTH` - one number - from `game-scoring-rules.service.ts`, whose
 * first line is `@/database/mongoose`, whose second line is `import { MongoClient } from
 * "mongodb"`. Turbopack traced the driver into the Client Component Browser bundle, where
 * `fs`, `net`, `tls`, `dns` and `child_process` do not exist, and **`next build` failed with
 * 17 errors**. The admin app then had no `.next` directory, so PM2 crash-looped it on the
 * server. A one-line import took the admin panel down in production.
 *
 * THE REASON NO EXISTING GUARD CAUGHT IT is worth stating, because two look as though they
 * should have. `check:mirrors` compares models between the apps and has no opinion about who
 * imports them. ESLint invariant 2 bans model imports from `lib/games/*`, which is the game
 * layer and not the component tree. And the typecheck is **structurally blind to this whole
 * class**: the import is valid TypeScript - the value exists, its type is `number` - and
 * nothing about a module's suitability for a browser bundle is expressible in the type
 * system. It is only ever caught by a full production build, which is to say by deploying.
 *
 * WHAT IT ASSERTS IS NARROWER THAN "NO MODELS", AND THE FIRST DRAFT GOT THIS WRONG. Written
 * as "no client file reaches a Mongoose model" it flagged five files that build perfectly
 * well, which is the kind of guard the first person it inconveniences deletes. The real line
 * is between two packages that read as one thing:
 *
 * - **`mongoose` has a browser build** and a bundler resolves it, so it is harmless in a
 *   client bundle. This is why `SymbolsSection.tsx`, `CompanyDetailsSection.tsx` and
 *   `InvoiceTemplateSection.tsx` can value-import `DEFAULT_FOREX_PAIRS`, `EU_COUNTRIES` and
 *   `COUNTRY_NAMES` out of model files and always have.
 * - **`mongodb`, the driver underneath it, does not.** It reaches for Node builtins at module
 *   scope. `apps/admin/database/mongoose.ts` imports it directly for `MongoClient`, which is
 *   what makes that one module the tripwire for the whole class.
 *
 * So a model import is *fragile* rather than broken - it breaks on the day somebody adds a
 * driver import to that model - and this test deliberately does not forbid it. Forbidding
 * what actually fails is what keeps the guard believed.
 *
 * FIVE RULES THIS ENCODES, each of which would otherwise make it useless:
 *
 * - **The walk stops at `"use server"`.** Next.js replaces such a module with an RPC stub, so
 *   nothing beyond it enters the client bundle. `CompetitionCreatorForm.tsx` imports
 *   `createCompetition` from a server-action module that reaches the driver two links later,
 *   and it is correct. Without this exemption the guard fires on the framework's own pattern.
 * - **`import type` is erased and therefore always safe.** `round-types.ts` does exactly that
 *   with `mongoose`. So it is VALUE imports that matter.
 * - **Strip comments first.** This file, and the two modules the fix touched, all name
 *   `@/database/mongoose` in prose to explain the hazard. A test that reads prose fails in
 *   both directions: it flags a correct file for discussing the mistake, and it passes a
 *   broken one whose only mention of the safe path is a comment. Uses the shared
 *   `stripComments`, not a second copy.
 * - **Read the directory, never a list of files.** The component added next month is the
 *   whole thing being defended against, and a hard-coded list is green on the day it appears.
 * - **Judge a module by its transitive imports, never by its name or folder.**
 *   `lib/services/games/play-shape.ts` is a service by name and model-free by construction;
 *   `game-scoring-rules.service.ts` sits beside it and is not. Both are imported by client
 *   components today and only one was ever a defect.
 *
 * WHAT EXTENDING IT TO THE MAIN APP FOUND, and it is the reason a plain `import` of a type
 * is treated as a violation. `MarketStatusBanner.tsx` imported `MarketStatus` and
 * `MarketHoliday` - both `interface` exports - from `real-forex-prices.service`, which
 * reaches the driver three links on. **The main app built.** It built because the two
 * bindings are only ever used in type positions, so the bundler dropped the import and never
 * entered the graph at all.
 *
 * That reads like a false positive and is not one. The safety was **the bundler's
 * unused-import elision, not anything anyone had decided**: promote either interface to a
 * class, or import one more binding from the same module, and the player app fails exactly
 * as admin did - and nothing would have said so. So the rule this encodes is deliberately
 * checkable without type analysis: **a client component may not NAME a driver-reaching module
 * in a value-import position.** The remedy is one keyword, it is what `verbatimModuleSyntax`
 * would demand anyway, and it turns an accident into a statement. Attempting the alternative -
 * resolving each binding to decide whether it is type-only - means following re-exports and
 * `export *` through the whole graph, and a guard that elaborate is one nobody trusts.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, dirname, resolve, relative } from "path";
import { stripComments } from "../helpers/route-guard-audit";

const REPO_ROOT = resolve(__dirname, "../..");
const ADMIN_ROOT = join(REPO_ROOT, "apps", "admin");

/**
 * Both apps, because both have the hazard and only one had the outage.
 *
 * The main app is the worse of the two to lose: it carries the player traffic, and it has
 * MORE direct driver importers than admin does - `database/mongoose.ts` for `MongoClient`,
 * plus a long tail of services and actions pulling `ObjectId` straight out of the package.
 * Guarding admin alone would be the same mistake as fixing one of two duplicated copies.
 */
const APPS = [
  { name: "main", root: REPO_ROOT, scanIn: ["components", "app"] },
  { name: "admin", root: ADMIN_ROOT, scanIn: ["components", "app"] },
] as const;

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/**
 * The one package that cannot exist in a browser bundle.
 *
 * Named as a package rather than as `@/database/mongoose` on purpose: the connection module
 * is today's only importer, but a service reaching the driver directly lands the client in
 * exactly the same place, and this has to fire on that too.
 */
function isRawDriver(specifier: string): boolean {
  return specifier === "mongodb" || specifier.startsWith("mongodb/");
}

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...listSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

/**
 * A leading directive, ignoring any comments above it.
 *
 * Reason: strips first and then compares strings rather than matching a regex over the raw
 * file. A pattern that has to skip an arbitrary run of leading comments needs a quantified
 * group containing a quantifier, which is the shape `security/detect-unsafe-regex` refuses -
 * and correctly, since these files open with 70-line block comments.
 */
function hasDirective(code: string, directive: "use client" | "use server"): boolean {
  const start = stripComments(code).trimStart();
  return start.startsWith(`"${directive}"`) || start.startsWith(`'${directive}'`);
}

/**
 * Every specifier imported for its VALUE.
 *
 * `import type ...` and `export type ...` are skipped because the compiler erases them, so
 * they never reach a bundle. An inline `import { type Foo }` still loads the module for its
 * other bindings, so those are deliberately NOT skipped.
 */
export function valueImportSpecifiers(code: string): string[] {
  const clean = stripComments(code);
  const specifiers: string[] = [];
  // Reason: the clause between the keyword and `from` is captured whole and inspected as a
  // string, rather than matched with an optional `(\s+type)?` group. That group nests a
  // quantifier inside a quantifier, which `security/detect-unsafe-regex` refuses.
  const pattern = /(?:^|\n)\s*(?:import|export)\b([^;'"]*)from\s*["']([^"']+)["']/g;
  for (const match of clean.matchAll(pattern)) {
    // `import type` / `export type` are erased by the compiler. An inline `{ type Foo }` is
    // not, because the module is still loaded for its other bindings, and the leading-`type`
    // test does not match it - the clause begins with a brace.
    if (/^\s*type\b/.test(match[1])) continue;
    specifiers.push(match[2]);
  }
  // A bare side-effect import (`import "./x"`) loads the module too.
  for (const match of clean.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * `@/` means a different directory in each app, so it is resolved against the app the
 * IMPORTER lives in - never against the app the walk started from.
 *
 * This is load-bearing rather than tidiness, and it is a real defect in the single-app
 * version of this resolver. Three admin files reach across with `@root/lib/...`; once the
 * walk is inside a main-app module, its own `@/database/mongoose` means the repository root.
 * Resolved against the admin root it happens to find a file that also imports the driver, so
 * today the verdict is right by accident - but any main-app path with no admin counterpart
 * resolves to `null`, the walk stops, and a chain is missed in silence.
 */
function appRootFor(file: string): string {
  return file.startsWith(ADMIN_ROOT) ? ADMIN_ROOT : REPO_ROOT;
}

/** Resolve to a real file on disk, honouring both tsconfigs' aliases. */
function resolveSpecifier(specifier: string, importerFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@root/lib/")) {
    base = join(REPO_ROOT, "lib", specifier.slice("@root/lib/".length));
  } else if (specifier.startsWith("@/")) {
    base = join(appRootFor(importerFile), specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(importerFile), specifier);
  } else {
    return null; // A package. The only one that matters is checked by specifier.
  }

  for (const candidate of [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...SOURCE_EXTENSIONS.map((ext) => join(base, "index" + ext)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const show = (file: string) => relative(REPO_ROOT, file).replace(/\\/g, "/");

/**
 * One read and one parse per file for the whole suite.
 *
 * Reason: the two apps hold ~400 client components between them and every one is walked
 * separately, so the same shared module is reached hundreds of times. Uncached this is
 * minutes of repeated file reads and regex work; a slow guard gets moved out of the default
 * suite, which is the same outcome as not having one.
 */
const parsed = new Map<string, { specifiers: string[]; isServerModule: boolean } | null>();

function parseFile(file: string) {
  if (parsed.has(file)) return parsed.get(file)!;
  let entry: { specifiers: string[]; isServerModule: boolean } | null;
  try {
    const code = readFileSync(file, "utf8");
    entry = {
      specifiers: valueImportSpecifiers(code),
      isServerModule: hasDirective(code, "use server"),
    };
  } catch {
    entry = null;
  }
  parsed.set(file, entry);
  return entry;
}

/**
 * Walk out from a client component until the driver is reached, returning the chain that got
 * there. Breadth-first, so the chain reported is the SHORTEST one - the longer a chain, the
 * more likely it is that the interesting link is early in it.
 */
export function findDriverChain(entry: string): string[] | null {
  const seen = new Set<string>([entry]);
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: entry, chain: [show(entry)] },
  ];

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    // Reason: not named `module` - Next.js forbids assigning that identifier, since it
    // shadows the CommonJS binding its bundler relies on.
    const current = parseFile(file);
    if (!current) continue;

    // Reason: a server-action module becomes an RPC stub, so the client bundle stops here.
    // Checked after the entry is dequeued rather than before it is queued, so that a client
    // component is never itself skipped.
    if (file !== entry && current.isServerModule) continue;

    for (const specifier of current.specifiers) {
      if (isRawDriver(specifier)) {
        return [...chain, specifier];
      }
      const next = resolveSpecifier(specifier, file);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      queue.push({ file: next, chain: [...chain, show(next)] });
    }
  }
  return null;
}

describe("client components must not reach the MongoDB driver", () => {
  for (const app of APPS) {
    describe(`${app.name} app`, () => {
      const clientComponents = app.scanIn
        .flatMap((dir) => listSourceFiles(join(app.root, dir)))
        .filter((file) => hasDirective(readFileSync(file, "utf8"), "use client"));

      it("finds the client components to check at all", () => {
        // Reason: a test examining nothing passes everything asked of it. If the scan roots
        // move or the directive pattern stops matching, the assertion below becomes vacuous
        // while still reporting green - so the population is asserted before it is used.
        // Per app, because one app's population cannot vouch for the other's.
        expect(clientComponents.length).toBeGreaterThan(20);
      });

      it("no client component reaches `mongodb`, directly or through any chain", () => {
        const offenders = clientComponents
          .map((file) => findDriverChain(file))
          .filter((chain): chain is string[] => chain !== null)
          .map((chain) => chain.join("\n      -> "));

        expect(
          offenders,
          offenders.length === 0
            ? ""
            : `A "use client" file reaches the MongoDB driver. This does not fail the ` +
                `typecheck - it fails 'next build' on unresolvable Node builtins and leaves ` +
                `the ${app.name} app with no .next directory, which PM2 then crash-loops. ` +
                `Move the shared value into a module that reaches no driver, and have the ` +
                `service import it from there.\n\n      ${offenders.join("\n\n      ")}`,
        ).toEqual([]);
      });
    });
  }

  it("treats an erased `import type` as safe, so the guard cannot fail on correct code", () => {
    // Reason: `round-types.ts` value-imports nothing but does `import type { Types } from
    // "mongoose"`, and has always built. A guard that flagged it would be deleted by the
    // first person it inconvenienced, so the exemption is pinned rather than assumed.
    expect(valueImportSpecifiers(`import type { Types } from "mongoose";`)).toEqual([]);
    expect(valueImportSpecifiers(`import { Types } from "mongoose";`)).toEqual(["mongoose"]);
    // An inline `{ type Foo }` still loads the module for its other bindings, so it counts.
    expect(valueImportSpecifiers(`import { type Types, x } from "mongoose";`)).toEqual([
      "mongoose",
    ]);
  });

  it("ignores a driver named only in a comment", () => {
    // Reason: the modules involved in this fix all name the driver in prose to explain the
    // hazard. Reading prose would flag them for discussing the mistake.
    expect(
      valueImportSpecifiers(`// import { MongoClient } from "mongodb";\nimport { y } from "./z";`),
    ).toEqual(["./z"]);
  });

  it("distinguishes `mongoose` from `mongodb`, which is the whole basis of the rule", () => {
    // Reason: the first draft of this suite forbade both and flagged five files that build.
    // `mongoose` has a browser build; the driver under it does not. Pinning the distinction
    // stops the guard being "tightened" back into one that fires on correct code.
    expect(isRawDriver("mongodb")).toBe(true);
    expect(isRawDriver("mongodb/lib/index")).toBe(true);
    expect(isRawDriver("mongoose")).toBe(false);
    expect(isRawDriver("@/database/models/company-settings.model")).toBe(false);
  });
});
