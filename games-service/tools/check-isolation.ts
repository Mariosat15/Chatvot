/**
 * Proves this service imports nothing from the ChartVolt platform.
 *
 * WHY THIS EXISTS RATHER THAN A CODE-REVIEW CONVENTION
 * ----------------------------------------------------
 * The whole value of ChartVolt Games as a reference implementation rests on it having been
 * built from the issued specification and nothing else. A single shared type would let the
 * two sides agree with each other about something the specification never actually says -
 * and it would still compile, still pass every test, and still look completely correct.
 *
 * It is the same failure as seeding a test through the raw MongoDB driver: the fixture stops
 * being bound by the rules the real thing obeys, so it proves the consumer works and is
 * structurally silent about the producer.
 *
 * There will also be pressure in the other direction as this becomes a real product - it is
 * genuinely tempting to reuse a signing helper that already exists a directory away. Hence a
 * check rather than a note.
 *
 * WHAT COUNTS AS A VIOLATION
 * --------------------------
 *   - any import escaping this directory   (`../`, `../../`, an absolute path upwards)
 *   - the platform's path alias            (`@/...`)
 *   - a `paths` mapping in tsconfig        (how `@/` would start working again)
 *
 * The tsconfig clause is the subtle one and it is the reason this file checks configuration
 * as well as code. `api-server/tsconfig.json` maps `@/*` to `../*`; if somebody copies that
 * block here "for consistency", every future accidental import silently resolves instead of
 * failing, and the guarantee is gone with nothing to see in the diff but a config tidy-up.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = join(__dirname, "..");

interface Violation {
  file: string;
  line: number;
  text: string;
  reason: string;
}

/** Every `.ts` file under the service, skipping build output and dependencies. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if (entry.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Strip comments before matching.
 *
 * Reason: this service's files explain the isolation rule in prose, and several quote the
 * forbidden forms in order to say why they are forbidden - including the file you are
 * reading. Matching raw text flags a correct file for discussing the mistake, and would
 * equally pass a broken one whose only mention of the rule is a comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function checkSource(): Violation[] {
  const violations: Violation[] = [];

  for (const file of sourceFiles(ROOT)) {
    const raw = readFileSync(file, "utf8");
    const lines = stripComments(raw).split("\n");

    lines.forEach((line, index) => {
      // Only import/require positions matter. A relative path inside a string used for
      // something else (a URL path, say) is not an import and must not be flagged.
      const specifiers = [
        ...line.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g),
        ...line.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ...line.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ];

      for (const match of specifiers) {
        const specifier = match[1];

        if (specifier.startsWith("@/")) {
          violations.push({
            file: relative(ROOT, file),
            line: index + 1,
            text: line.trim(),
            reason: `imports '${specifier}' - the platform's path alias`,
          });
          continue;
        }

        // A relative specifier has to be RESOLVED before it can be judged.
        //
        // The first version of this check flagged any specifier starting with `../`, and it was
        // wrong: `tools/test-engine.ts` importing `../src/engine/rng` climbs one level and comes
        // straight back down, never leaving the service. Two files' worth of correct code were
        // reported as violations.
        //
        // The general form is worth keeping, because the mistake is easy in both directions: a
        // guard about WHERE A PATH LANDS cannot be written as a test on how the path is spelled.
        // (The platform's own ESLint boundary has the mirror-image constraint - it matches the
        // import string and therefore cannot see through a resolved path - so the two rules
        // genuinely need opposite implementations.)
        if (specifier.startsWith(".")) {
          const resolved = resolve(dirname(file), specifier);
          const escapes =
            resolved !== ROOT && !resolved.startsWith(ROOT + sep);
          if (escapes) {
            violations.push({
              file: relative(ROOT, file),
              line: index + 1,
              text: line.trim(),
              reason: `imports '${specifier}' - resolves to ${relative(ROOT, resolved)}, outside games-service/`,
            });
          }
        }
      }
    });
  }

  return violations;
}

function checkTsconfig(): Violation[] {
  const file = join(ROOT, "tsconfig.json");
  const raw = readFileSync(file, "utf8");

  // Deliberately a text check, not a JSON parse of `compilerOptions.paths`: a commented-out
  // mapping is a re-enable waiting to happen, and the point is to notice it arriving at all.
  const withoutComments = stripComments(raw);
  if (/"paths"\s*:/.test(withoutComments)) {
    return [
      {
        file: "tsconfig.json",
        line: withoutComments.split("\n").findIndex((l) => /"paths"\s*:/.test(l)) + 1,
        text: '"paths": { ... }',
        reason:
          "a paths mapping would let '@/...' resolve into the platform. It is absent on purpose - see README",
      },
    ];
  }
  return [];
}

const violations = [...checkTsconfig(), ...checkSource()];

if (violations.length > 0) {
  console.error(
    `\n❌ ChartVolt Games is not isolated - ${violations.length} violation(s).\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    ${v.reason}\n`);
  }
  console.error(
    "This service must be built from the issued provider specification alone. Sharing code\n" +
      "with the platform makes it agree with itself and stop proving anything.\n",
  );
  process.exit(1);
}

console.log(
  `✅ ChartVolt Games is isolated: ${sourceFiles(ROOT).length} source files, no platform imports, no tsconfig paths mapping.`,
);
