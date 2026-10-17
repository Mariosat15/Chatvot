/**
 * X6.5 A3b - the LOWERCASE renameable nouns in the games surface's running prose.
 *
 * WHY THIS IS ITS OWN SUITE RATHER THAN AN ASSERTION ADDED TO A2's OR A3's. Those two guard a
 * named list of files and assert the delivery mechanism as well as the wording - `useTerms()`
 * in the wizard, a threaded pack on the detail screen. This one asserts one property over a
 * WHOLE DIRECTORY, read from disk rather than listed, so a screen added to `components/admin/
 * games/` next month is policed the day it arrives. A list of files is a guard that is green
 * on the day the thirty-first one appears.
 *
 * WHAT IT CLOSED, and why the Title Case sweep had not already: chapter 14's passes were
 * written around captions, and `literalNounHits` is deliberately scoped to Title Case because
 * the lowercase forms are also route ids (`activeTab=competitions`), stored status values
 * (`"contest"`) and locals - all on section 6's never-rename list. So every explanatory
 * paragraph on the games screens kept its own hard-coded nouns while the labels above them
 * were tokenised: an operator who renamed Competitions to "Events" got a screen whose headings
 * said Events and whose sentences underneath still explained how a competition works. 139
 * lines across 32 files, now nil.
 *
 * THE OWNER'S CASE DECISION (15 Sep 2026) is what made that affordable. A token is a Title
 * Case label and is never case-folded or singularised, so mid-sentence it reads "this
 * Competition still settles on time". Capitalised mid-sentence rather than restructured -
 * correct, cheapest, and already what A2 shipped. The alternative, a second lowercase variant
 * per token, is a second thing for an operator to get inconsistent and a second thing to
 * forget: `replace(/s$/, "")` on a configured word strips whatever they actually typed.
 *
 * The scanner is shared with A2 and A3 (`__tests__/helpers/terminology-scan.ts`).
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  ADMIN,
  code,
  literalNounHits,
  lowercaseNounHits,
  report,
  walk,
} from "../helpers/terminology-scan";

/**
 * Read from the directory, never listed.
 *
 * `components/admin/games/` is the whole provider-contest operator surface - the wizard and
 * its six step bodies, the editor, the catalogue, the round inspector, provider health, the
 * scoring and challenge-default dialogs, the play-style control. `components/admin/
 * competitions/` is the prize and settled-result panels plus the revenue breakdown. The four
 * named files are the list, the detail page and the two presentation modules, which live
 * outside both directories and carry the same prose.
 */
const SURFACE = [
  ...walk(join(ADMIN, "components/admin/games")),
  ...walk(join(ADMIN, "components/admin/competitions")),
  join(ADMIN, "components/admin/CompetitionsListSection.tsx"),
  join(ADMIN, "app/competitions/view/[id]/page.tsx"),
  join(ADMIN, "lib/admin/contest-result-presentation.ts"),
  join(ADMIN, "lib/admin/contest-analytics-presentation.ts"),
];

// =======================================================================================
// The reader reaches the surface
// =======================================================================================

describe("the scan reaches the games surface", () => {
  /*
    FIRST, because both claims below are "no match was found" and a reader that silently
    returns nothing satisfies both - the fourth cause of a green probe, a mutation with no
    observable. A renamed directory would make this suite vacuous while reporting passes, and
    `walk` returning an empty array is exactly what a rename produces.
  */
  it("finds a substantial number of files, each with content", () => {
    expect(SURFACE.length).toBeGreaterThanOrEqual(30);
    for (const file of SURFACE) {
      expect(code(file).length).toBeGreaterThan(0);
    }
  });
});

// =======================================================================================
// The assertions that can fail
// =======================================================================================

describe("no renameable noun survives as a literal on the games surface", () => {
  it("has no lowercase noun in running prose", () => {
    /*
      THE A3b GUARD. Every hit is a sentence an operator reads that names a noun they can
      rename, in a position no identifier, route segment or stored value can occupy - see
      `lowercaseNounHits` for the three-part position test and the display-signal requirement.

      It reports file and line, so a failure is actionable without re-running a scan.
    */
    expect(report(lowercaseNounHits(SURFACE))).toBe("");
  });

  it("has no Title Case noun as a JSX literal or a quoted caption", () => {
    /*
      A3's rule over A3b's wider surface. Kept as a separate assertion rather than folded in,
      because the two fail for different reasons and the remedy differs: a Title Case hit is
      almost always a caption somebody copied from the block above, a lowercase hit is a
      sentence that was never in scope until this pass.
    */
    expect(report(literalNounHits(SURFACE))).toBe("");
  });
});
