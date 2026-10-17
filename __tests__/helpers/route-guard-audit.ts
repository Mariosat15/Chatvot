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

/**
 * Fresh each time: a `g` regex carries `lastIndex`, so a shared instance skips matches.
 *
 * ALL THREE EXPORT FORMS, and the two beyond `export async function` are latent rather than
 * decorative. Next.js accepts `export function GET`, `export const GET = async () => {}` and
 * the async-function form equally, so a route written either of the first two ways was
 * invisible to every assertion built on this pattern - handlers counted as zero, which the
 * consumer suites' own `toBeGreaterThan(0)` catches for a whole file, but a file mixing forms
 * would have reported a lower handler count and passed a guard-per-handler comparison while
 * leaving the unmatched handler open. Measured 16 September 2026: no admin route uses either
 * form today, so this closes a gap nothing is currently falling through, which is the only
 * time it is cheap to close.
 */
export function handlerPattern(): RegExp {
  return /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
}

/**
 * The guard must be CALLED WITH A SECTION, not merely named.
 *
 * `toContain("guardSection")` stays true when the call is deleted, because the import line
 * still holds the identifier - an import is not a use, which has defeated three assertions
 * elsewhere in these suites (`canTransitionRound`, `MIN_REASON_LENGTH`, and the round
 * inspector's own `resolveRoundManually`).
 */
/**
 * Counts section-grant calls of either shape (`guardSection` or `guardAnySection`).
 *
 * Reason: a dual-caller route uses `guardAnySection([...])`, and a count that only
 * matches the single-argument form reports those handlers as unguarded while every
 * refusal and every import still look correct.
 */
export function guardCallPattern(): RegExp {
  return /guard(?:Any)?Section\s*\(/g;
}

/** Either shape of section grant — single or any-of. Alias kept for classifyRouteAuth. */
export function anyGuardCallPattern(): RegExp {
  return /guard(?:Any)?Section\s*\(/;
}

/**
 * Section ids named by either grant shape.
 *
 * `guardSection("users")` yields `["users"]`; `guardAnySection(["financial", "users"])`
 * yields both. Used by the closed-folder suite so a dual-caller route can still prove
 * it names the screen that owns it without inventing a second folder entry.
 */
export function guardedSections(code: string): string[] {
  const single = [
    ...code.matchAll(/guardSection\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g),
  ].map((match) => match[1]);
  const anyOf = [
    ...code.matchAll(/guardAnySection\(\s*\[([^\]]+)\]\s*\)/g),
  ].flatMap((match) =>
    [...match[1].matchAll(/["'`]([a-z0-9-]+)["'`]/g)].map((inner) => inner[1]),
  );
  return [...single, ...anyOf];
}

/**
 * One slice of source per exported handler, each running to the next handler or the end.
 *
 * Reason: a file-wide position comparison cannot see an ordering defect in the SECOND handler.
 * `code.search(...)` returns the first match anywhere, so a route whose `GET` guards first and
 * whose `PATCH` reads its body before guarding passes "the guard comes before the body" while
 * being exactly the thing that assertion exists to forbid - the file-wide form of the
 * count-per-handler rule above, and it cost a green probe to find.
 */
export function handlerSlices(code: string): { method: string; body: string }[] {
  const starts = [...code.matchAll(handlerPattern())].map((match) => ({
    method: match[1],
    at: match.index ?? 0,
  }));
  return starts.map((start, index) => ({
    method: start.method,
    body: code.slice(start.at, starts[index + 1]?.at ?? code.length),
  }));
}

/**
 * Any authentication helper at all, including the ones that answer the wrong question.
 *
 * `getAdminSession` is the reason this list exists rather than a shorter one. It refuses a
 * caller with no session and never asks which grants they hold, so a route using it is
 * neither unguarded nor guarded-by-the-wrong-helper - it is a third answer the earlier
 * taxonomy had no name for, and eight files sat in that gap while the method that found five
 * previous rounds of this class walked straight past them.
 */
export function anyAuthHelperPattern(): RegExp {
  return /(guardSection|guardAnySection|requireSectionAccess|requireAnySectionAccess|getAdminSession|verifyAdminAuth|verifyAdminToken|requireAdminAuth|verifyAnyAuth|verifyGameMasterAuth|getServerSession|auth\.api\.getSession)\s*\(/;
}

/**
 * A hand-rolled JWT check, which is authentication written out longhand.
 *
 * It must be looked for SEPARATELY from the helpers above, because a route doing this calls no
 * helper and so reads as completely unguarded - while it may well verify the signature
 * correctly against the real secret and refuse a forgery. That makes it more convincing than
 * no check at all and no better at the question that matters, which is what the holder is
 * allowed to reach. `users/[userId]/conversations` was exactly this shape.
 */
export function handVerifiedTokenPattern(): RegExp {
  return /\b(verify|jwtVerify|decode)\s*\(\s*token/;
}

/**
 * A call that changes stored data.
 *
 * Reason: used with `handlerSlices` to answer whether a handler authenticates BEFORE it
 * writes. That axis is not a refinement of "is there a guard" - it is the difference between
 * a weak check and no check at all, because a helper called after the write has already let
 * the write happen. Measured 16 September 2026 across the whole admin tree: zero handlers,
 * and the same instrument run against `87d13897` reports three - `users/edit#PATCH`,
 * `users/credit#POST` and `users/delete#DELETE` - so it is proven able to fire rather than
 * merely green.
 */
export function mutatingDbCallPattern(): RegExp {
  return /\.(updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|insertOne|insertMany|bulkWrite|save)\s*\(/;
}

/** What a route file does about authorization, in the only four shapes that exist today. */
export type RouteAuthClass =
  | "section-granted"
  | "helper-no-grant"
  | "hand-verified-no-grant"
  | "no-check";

/**
 * Classify one route's source. Order matters: a section grant wins over everything, and a
 * hand-verified token is only interesting in a file that calls no helper at all.
 */
export function classifyRouteAuth(code: string): RouteAuthClass {
  // Reason: guardAnySection is a section grant over more than one id — classifying it as
  // helper-no-grant would leave every dual-caller route permanently in the debt pile.
  if (
    anyGuardCallPattern().test(code) ||
    /require(?:Any)?SectionAccess\s*\(/.test(code)
  ) {
    return "section-granted";
  }
  if (anyAuthHelperPattern().test(code)) return "helper-no-grant";
  if (handVerifiedTokenPattern().test(code)) return "hand-verified-no-grant";
  return "no-check";
}
