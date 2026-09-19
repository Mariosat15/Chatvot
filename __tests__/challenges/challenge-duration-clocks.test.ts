import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE TWO LENGTHS ON A GAME CHALLENGE ARE STATEMENTS, NOT CONTROLS.
 *
 * Owner instruction, 14 September 2026: "How long the Challenge runs and how long the game runs
 * must be shown in a clock like we have the countdown in competition page, not as an option, as
 * it will respect what the game providers specify in admin."
 *
 * WHY IT IS NOT COSMETIC, which is the thing a summary will get wrong. A title carries an
 * operator-set challenge length and a round ceiling, and `round.service.ts` refuses an attempt
 * that cannot finish inside the window. So a player free to type ten minutes for a game whose
 * round is longer buys a challenge in which neither side can start a round - R73's shape, with
 * the refusal arriving after the money moved rather than at the point of choosing.
 *
 * TRADING IS DELIBERATELY UNTOUCHED, and its input and chips are asserted still present. A
 * trading challenge has no title to ask, so the window genuinely is the player's, and locking it
 * "for consistency" would take away a control nobody complained about.
 */

const ROOT = process.cwd();
const CLOCK = join(
  ROOT,
  "components",
  "challenges",
  "create",
  "ChallengeDurationClock.tsx",
);
const BATTLE = join(
  ROOT,
  "components",
  "challenges",
  "create",
  "ChallengeBattleSettings.tsx",
);
const FIELDS = join(
  ROOT,
  "components",
  "challenges",
  "ChallengeSettingsFields.tsx",
);
const PANEL = join(ROOT, "components", "competitions", "CountdownPanel.tsx");

/**
 * Comments stripped before matching, always.
 *
 * Every file here argues in prose about the alternative it rejected - the clock explains why it
 * is not `CountdownPanel`, and names the panel's own red "ENDING SOON" state to do it. A bare
 * match reads the explanation as the offence and fails a correct file for discussing it.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function countOf(haystack: string, pattern: RegExp): number {
  return haystack.match(new RegExp(pattern, "g"))?.length ?? 0;
}

describe("the clock is the competition clock's cells, not a second set", () => {
  it("borrows both the cells and the arithmetic from the competition panel", () => {
    const code = readCode(CLOCK);
    expect(code).toMatch(/CountdownCells/);
    expect(code).toMatch(/splitDuration/);
    expect(code).toMatch(/components\/competitions\/CountdownPanel/);
  });

  it("hand-rolls no cells of its own", () => {
    // THE LOAD-BEARING ASSERTION. Importing the panel's cells is trivially satisfied by a file
    // that imports them and then lays out four boxes beside them - which is how one screen ends
    // up with two clocks that disagree about how a duration is spelled.
    const code = readCode(CLOCK);
    expect(code).not.toMatch(/grid-cols-4/);
    expect(code).not.toMatch(/caption=/);
    expect(code).not.toMatch(/"Mins"|"Secs"|"Hours"|"Days"/);
  });

  it("is NOT the countdown panel reused, because that panel warns and this one must not", () => {
    // Reason: `CountdownPanel` reads anything under an hour as ENDING SOON in red and zero as
    // "has ended". Both are right for a contest's remaining time and wrong for a fixed length -
    // a 30-minute challenge is not ending soon, it has not started.
    expect(readCode(PANEL)).toMatch(/COUNTDOWN_WARNING_MS/);
    expect(readCode(CLOCK)).not.toMatch(/COUNTDOWN_WARNING_MS|ENDING SOON/);
  });

  it("renders NOTHING for an absent or non-positive length, never a row of zeroes", () => {
    // Reason: an absent length means the title declares none, and four zeroes under "how long
    // the game runs" is an invented deadline - the same reading RoundPreflight and
    // RoundClockNote give a missing duration.
    const code = readCode(CLOCK);
    const guard = code.indexOf("seconds === undefined");
    const markup = code.indexOf("<div");
    expect(guard).toBeGreaterThan(-1);
    expect(markup).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(markup);
    expect(code).toMatch(/!Number\.isFinite\(seconds\) \|\| seconds <= 0/);
    expect(code.slice(guard, markup)).toMatch(/return null/);
  });
});

describe("how long the challenge runs", () => {
  it("is a clock for a game and a control for trading", () => {
    const code = readCode(BATTLE);
    const branch = code.indexOf('selection.type === "provider" ?');
    expect(branch).toBeGreaterThan(-1);

    const clock = code.indexOf("<ChallengeDurationClock", branch);
    const chips = code.indexOf("DURATION_CHIPS.map", branch);
    expect(clock).toBeGreaterThan(branch);
    expect(chips).toBeGreaterThan(clock);
  });

  it("keeps trading's own bounds and chips exactly as they were", () => {
    // Reason: a locked trading window is a control taken away from the one game whose length
    // really is the player's to pick, and nothing in the report asked for it.
    const code = readCode(BATTLE);
    expect(code).toMatch(/min=\{settings\?\.minDurationMinutes \|\| 15\}/);
    expect(code).toMatch(/max=\{settings\?\.maxDurationMinutes \|\| 1440\}/);
    expect(code).toMatch(/onChange\(\{ duration: mins \}\)/);
  });

  it("draws ONE clock for the window, so the game's own clock cannot be a second copy", () => {
    // Reason: the play clock is rendered by the settings form from the title's schema. A second
    // one here would state the same fact from a different source, and the two disagree the
    // moment an operator edits one of them.
    const code = readCode(BATTLE);
    expect(countOf(code, /<ChallengeDurationClock/)).toBe(1);
  });

  it("reads the length off the form rather than recomputing it", () => {
    // Reason: `chooseGame` already moves the length with the pick, resolved server-side by
    // listChallengeableTitles. Deriving it again here is a second copy of a rule the create
    // route enforces, and the two disagree in the direction that shows a figure the route
    // refuses.
    expect(readCode(BATTLE)).toMatch(/seconds=\{formData\.duration \* 60\}/);
  });
});

describe("how long the game runs", () => {
  it("is locked by the declared FORMAT, never by a field name", () => {
    // THE NO-DEVELOPER-NEEDED PROPERTY. A `field.name === "durationSeconds"` check would lock
    // one game's clock and leave the next title's as a box, which is the single failure mode of
    // the claim that a new game needs no code.
    const code = readCode(FIELDS);
    expect(code).toMatch(
      /lockPlayClock && field\.format === "duration-seconds"/,
    );
    expect(code).not.toMatch(/field\.name ===/);
    expect(code).not.toMatch(/durationSeconds/);
  });

  it("is locked on the player's create dialog", () => {
    // Reason: the prop exists, and a prop nobody passes is a control that is still editable
    // while every assertion about the form passes.
    expect(readCode(BATTLE)).toMatch(/lockPlayClock/);
  });

  it("never labels a control with the raw schema key", () => {
    // Reason: a title supplying no `title` for its play clock used to render `durationSeconds`
    // above a box holding MINUTES - an internal name and the wrong unit in one line.
    const code = readCode(FIELDS);
    expect(code).not.toMatch(/field\.title \?\? field\.name/);
    expect(code).toMatch(/function fieldLabel/);
    expect(countOf(code, /fieldLabel\(field\)/)).toBe(2);
  });

  it("labels the play clock from its format and restores word boundaries otherwise", () => {
    // BOTH ENDS OF THE SLICE ARE PROVEN, and the end matters here rather than being caution:
    // `field.format === "duration-seconds"` appears twice more further down the file, in the
    // control that renders the box. Sliced to the end of the file, a probe deleting this
    // function's own branch stayed green against the other two occurrences.
    const code = readCode(FIELDS);
    const from = code.indexOf("function fieldLabel");
    const to = code.indexOf("export default function", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);

    const label = code.slice(from, to);
    expect(label).toMatch(/field\.format === "duration-seconds"/);
    expect(label).toMatch(/\(\[a-z0-9\]\)\(\[A-Z\]\)/);
  });
});
