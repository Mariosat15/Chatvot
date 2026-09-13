/**
 * Shared machinery for asserting that every exported handler in an admin API folder sits
 * behind a section guard.
 *
 * WHY THIS IS A HELPER AND NOT COPIED INTO EACH SUITE. `ai-route-guards.test.ts` (R51) worked
 * these rules out the hard way, each one after a probe came back green against an assertion
 * that looked correct. A second suite restating them is the "one rule, two copies" shape that
 * has already produced five defects in this codebase - `referenceId`, `failedReason`,
 * `challengeId`, the Game Master `||` and the details-view link - none of which
 * `check:mirrors` can see, because it compares models. The failure here would be quiet in the
 * worst available direction: one suite's regex is loosened to accommodate a route, the other
 * keeps the strict version, and which folders are genuinely protected then depends on which
 * file a reader happens to open.
 *
 * The three rules worth carrying, because each cost a green probe to learn:
 *
 * - **Read the directory, never a list of files.** A route added next month is the whole
 *   thing being defended against, and a hard-coded list is green on the day it appears.
 * - **Count per handler, not per file.** A file whose `POST` is guarded and whose `GET` is not
 *   passes any check that merely asks whether the file mentions a guard.
 * - **Strip comments first.** These routes explain at length why the guard is there and name
 *   `guardSection` in prose, so a test that reads prose fails in both directions: it passes a
 *   file whose only mention of the guard is the paragraph describing it, and it flags a
 *   correct file for discussing the anti-pattern.
 */

import { readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Comments out, code in. Block comments first, then line comments - and the line-comment
 * pattern deliberately refuses a `//` preceded by a colon so that a `https://` inside a
 * string survives.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `route.ts` under `dir`, recursively, so a nested dynamic segment is not missed. */
export function findRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      found.push(full);
    }
  }
  return found;
}

/** Fresh each time: a `g` regex carries `lastIndex`, so a shared instance skips matches. */
export function handlerPattern(): RegExp {
  return /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
}

/**
 * The guard must be CALLED WITH A SECTION, not merely named.
 *
 * `toContain("guardSection")` stays true when the call is deleted, because the import line
 * still holds the identifier - an import is not a use, which has defeated three assertions
 * elsewhere in these suites (`canTransitionRound`, `MIN_REASON_LENGTH`, and the round
 * inspector's own `resolveRoundManually`).
 */
export function guardCallPattern(): RegExp {
  return /guardSection\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g;
}

/** The section ids a folder's routes name, in source order. */
export function guardedSections(code: string): string[] {
  return [...code.matchAll(guardCallPattern())].map((match) => match[1]);
}
