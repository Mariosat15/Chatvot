/**
 * The trading competition form, on the shared wizard shell - and the market refusal that
 * should have gone on 4 September 2026.
 *
 * WHY THIS IS ITS OWN FILE. The owner asked for the trading form to move onto the shell in a
 * SEPARATE commit, "so it can be reverted on its own without losing the game wizard's new
 * look". A test file that can be deleted in the same revert is part of that: assertions about
 * trading's chrome living inside `game-contest-wizard.test.ts` would make the revert a partial
 * edit to a file that has to survive.
 *
 * TWO SEPARATE CLAIMS ARE PINNED. First, that the rail, the Quick Preview card and the
 * two-column frame are now the shell's rather than this file's copies of them - the chrome
 * came OUT of here, so a second copy left behind is the "one rule, two copies" shape that four
 * money defects in this codebase already have. Second, that creating a competition is no longer
 * refused because the forex market is shut, which is the owner's 4 September decision applied
 * to the screen the operator actually uses.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ADMIN = join(__dirname, "..", "..", "apps", "admin");

const FORM = join(ADMIN, "components/admin/CompetitionCreatorForm.tsx");
const SHELL = join(ADMIN, "components/admin/wizard/WizardShell.tsx");

/**
 * Source with comments stripped.
 *
 * // Reason: this file now carries a comment block explaining exactly why there is no
 * market-hours refusal in it, naming the refusal. A test that reads prose passes a file whose
 * only mention of the right thing is in a comment, and fails a correct file for discussing the
 * mistake - both directions have bitten this suite before.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The submit handler alone, which is where a refusal would live. */
function submitHandler(source: string): string {
  const start = source.indexOf("const handleSubmit");
  const end = source.indexOf("const steps");
  const slice = source.slice(start, end);
  // A slice that found nothing passes every assertion below, so prove it found the handler.
  expect(start).toBeGreaterThan(-1);
  expect(slice).toContain("setSubmitted(true)");
  return slice;
}

// =======================================================================================
// One shell, two wizards
// =======================================================================================

describe("the trading form renders the shared shell", () => {
  it("imports the shell and uses all four pieces", () => {
    const source = code(FORM);

    expect(source).toMatch(/from "@\/components\/admin\/wizard\/WizardShell"/);
    for (const element of [
      "<WizardShell",
      "<WizardStepRail",
      "<WizardPreview",
      "<WizardStepCard",
    ]) {
      expect(source).toContain(element);
    }
  });

  it("has no chrome of its own, which is the half that matters", () => {
    /*
      Importing the shell is trivially satisfied by a file that also hand-rolls the panel it
      used to own - and here that is not hypothetical, because the hand-rolled version was in
      this file until this commit. The two headings are the shell's; finding either here means
      a copy survived the move.
    */
    const source = code(FORM);

    expect(source).not.toContain("Creation Progress");
    expect(source).not.toContain("Quick Preview");

    // And the definitions are in the shell, or the two assertions above are satisfied by a
    // form with no sidebar at all.
    const shell = code(SHELL);
    expect(shell).toContain("Creation Progress");
    expect(shell).toContain("Quick Preview");
  });

  it("drives the rail and every step header from one list", () => {
    /*
      Seven hand-written accented headers is how a reordered wizard renders one step's body
      under another step's heading. The rail and the cards now read the same array, so the
      count of cards must match the count of steps in it.
    */
    const source = code(FORM);

    expect(source).toMatch(/steps=\{steps\}/);

    const cards = source.match(/<WizardStepCard step=\{steps\[\d\]\}/g) ?? [];

    // Counted inside the array's own slice, not over the file: `accent` is the shell's prop
    // and appears once per step definition, so this is the number of steps the rail draws.
    const list = source.slice(
      source.indexOf("const steps: readonly WizardStep[]"),
      source.indexOf("if (success)"),
    );
    expect(list.length).toBeGreaterThan(400);
    const definitions = list.match(/accent:/g) ?? [];

    expect(cards).toHaveLength(7);
    expect(definitions).toHaveLength(7);

    // Each card reads its OWN index. A copy-paste leaving two cards on `steps[0]` renders the
    // same heading twice, which reviews as correct and is exactly the mistake being prevented.
    expect(new Set(cards).size).toBe(7);
  });

  it("keeps the market card out of the shell", () => {
    /*
      The card itself is legitimate and trading's alone: whether the forex market is open is a
      real fact about a trading contest and means nothing to a puzzle. It stays in this file,
      passed into the shell's sidebar slot, so the shell carries no trading-shaped default.
    */
    expect(code(FORM)).toContain("marketStatus");
    expect(code(SHELL)).not.toContain("marketStatus");
    expect(code(SHELL)).not.toContain("market-status");
  });
});

// =======================================================================================
// The 4 September decision, applied to the screen
// =======================================================================================

describe("creating a competition is not refused because the market is shut", () => {
  it("has no market gate in the submit handler", () => {
    /*
      THE DEFECT IN ONE ASSERTION. The handler returned early on `!marketStatus.isOpen`, so an
      operator scheduling Monday's competition on a Saturday was refused outright. The owner
      removed the server-side twin on 4 September 2026 - `assertForexMarketOpenForCreate` was
      deleted with it - on the grounds that creating a contest is SCHEDULING it, not playing
      it, and order placement still refuses trades against a closed market.

      Asserted over the handler rather than the file, because the sidebar card legitimately
      reads `marketStatus` to REPORT the state. Reporting is the useful half; the refusal never
      was.
    */
    const handler = submitHandler(code(FORM));

    expect(handler).not.toContain("marketStatus");
  });

  it("does not tell the operator that creation is blocked", () => {
    /*
      The wording is the second half of the same defect and would outlive the code. A card
      saying "Competition creation is BLOCKED" beside a form that now submits happily is worse
      than the refusal was: an operator reads it, believes it, and waits until Sunday.
    */
    const source = code(FORM);

    expect(source).not.toMatch(/creation is BLOCKED/i);
    expect(source).not.toMatch(/Cannot create competition/i);
  });

  it("still reports the market state and still warns about the window", () => {
    /*
      The positive half, and it is not decoration. A contest whose window straddles the weekend
      close is a real problem the operator wants flagged - `/api/market-status` already returns
      those warnings against the chosen dates. Removing the refusal must not remove the
      information, or the change trades one wrong screen for a blind one.
    */
    const source = code(FORM);

    expect(source).toContain("/api/market-status");
    expect(source).toMatch(/Forex Market/);

    /*
      BOTH HALVES OF THE WARNINGS, because a bare `marketStatus.warnings` match is a weak
      assertion and a probe proved it: replacing the render CONDITION with `false` left the
      suite green, since the `.slice(...).map(...)` below still mentions the field. So the gate
      and the render are asserted separately - one probe per half.
    */
    expect(source).toMatch(/marketStatus\.warnings\.length/);
    expect(source).toMatch(/marketStatus\.warnings\.slice\([^)]*\)\s*\.map/);
  });

  it("leaves the submit button gated on the form's own rules only", () => {
    /*
      A refusal removed from the handler and left on the button is the same defect wearing a
      disabled attribute - and worse, because a disabled button names no reason at all.
    */
    const source = code(FORM);
    const submit = source.slice(source.indexOf('type="submit"'));

    expect(submit.length).toBeGreaterThan(100);

    const disabled = submit.slice(
      submit.indexOf("disabled="),
      submit.indexOf("className="),
    );
    expect(disabled.length).toBeGreaterThan(20);
    expect(disabled).not.toContain("marketStatus");
  });
});
