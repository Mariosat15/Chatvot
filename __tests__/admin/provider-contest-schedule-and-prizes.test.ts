/**
 * X6: one contest clock, and a prize split an operator can actually reach.
 *
 * TWO DEFECTS ARE PINNED HERE, AND BOTH WERE INVISIBLE TO EVERY EXISTING TEST.
 *
 * 1. THE PRIZE SPLIT WAS UNREACHABLE. The provider wizard's third step is labelled
 *    "Timing & prizes" and its heading reads "Timing, entry and prizes", and it rendered no
 *    prize control at all. `contest-draft.ts` seeded 50/30/20 and nothing could change it, so
 *    every provider contest ever created paid those three shares. The create service has
 *    accepted and validated `prizeDistribution` since the day it was written - the operator
 *    simply had no way to send anything else. `platformFeePercentage` was the same story, hard
 *    at 10.
 *
 *    This is worse than an unbuilt feature: the step's own label asserted the setting existed,
 *    so an operator reasonably believed they had already chosen it. Same class as a provider
 *    enabled with no adapter, or six `rankingMethod` options a provider game ignores - a
 *    control that appears to work and does nothing.
 *
 * 2. THERE WERE TWO CONTEST CLOCKS. `startTime`/`endTime` and `playWindowStart`/`playWindowEnd`
 *    were four separate operator-set dates. Nothing kept them related, and the field named
 *    "end" gated nothing a player played inside: `createRound` clamps to `playWindowEnd` and
 *    the launch service refuses before `playWindowStart`. So a contest could run to 14:00 with
 *    play shutting at 13:20, and players who started earlier got a longer run at the same pot.
 *
 *    The window is now DERIVED from the contest clock, in one function, and that single
 *    function is the point - two dates that must agree is the "one rule, two copies" shape
 *    behind five defects in this codebase already, none of which `check:mirrors` can see.
 *
 * WHY THE STRUCTURAL TESTS READ SOURCE. There is no DOM here; these are `"use client"`
 * components whose rendering needs a browser environment the rest of this suite does not set
 * up. Reading the source is weaker than rendering, so each assertion below matches a
 * CONSTRUCT - a JSX element with its props, an operator - never a bare identifier, which an
 * import line or a comment would satisfy. Comments are stripped first, because these files
 * explain the anti-patterns in prose and a test that reads prose fails in both directions.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  emptyDraft,
  toRequestBody,
  toEditRequestBody,
  type ContestDraft,
} from "../../apps/admin/components/admin/games/contest-draft";
import {
  prizeTotal,
  prizeTotalIsValid,
  MIN_PRIZE_RANKS,
} from "../../apps/admin/components/admin/games/PrizeDistributionEditor";

const ADMIN = join(process.cwd(), "apps", "admin");
const WIZARD = join(ADMIN, "components/admin/games/ProviderContestWizard.tsx");
const EDITOR = join(ADMIN, "components/admin/games/ProviderContestEditor.tsx");
const DRAFT = join(ADMIN, "components/admin/games/contest-draft.ts");

/** Source with block and line comments removed. See the file header for why. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function draftWith(overrides: Partial<ContestDraft> = {}): ContestDraft {
  return {
    ...emptyDraft,
    providerKey: "chartvolt",
    gameCode: "circuit-sprint",
    name: "A contest",
    startTime: "2026-09-10T13:00",
    endTime: "2026-09-10T14:00",
    ...overrides,
  };
}

// =======================================================================================
// One clock
// =======================================================================================

describe("the contest clock is the play window", () => {
  it("derives the play window from the contest on create", () => {
    const body = toRequestBody(draftWith());

    expect(body.playWindowStart).toBe(body.startTime);
    expect(body.playWindowEnd).toBe(body.endTime);
    // Not merely equal to each other - equal to the dates the operator actually typed.
    expect(body.startTime).toBe(new Date("2026-09-10T13:00").toISOString());
    expect(body.endTime).toBe(new Date("2026-09-10T14:00").toISOString());
  });

  it("derives it on edit too, which is the half that is easy to miss", () => {
    /*
      Removing the fields from the wizard alone would have left this path wrong. The edit form
      sends the window as well, so an operator moving the end time would have left
      `playWindowEnd` at its old value and shortened play without touching any field whose
      name contains the word "play".
    */
    const body = toEditRequestBody(
      draftWith({ endTime: "2026-09-10T16:30" }),
      { entered: false },
    );

    expect(body.playWindowEnd).toBe(body.endTime);
    expect(body.playWindowEnd).toBe(new Date("2026-09-10T16:30").toISOString());
    expect(body.playWindowStart).toBe(body.startTime);
  });

  it("sends no clock at all once anyone has paid to enter", () => {
    const body = toEditRequestBody(draftWith(), { entered: true });

    // Reason it asserts absence of all four rather than just the window: the server refuses
    // the whole request naming any frozen field, so sending a start time unchanged would tell
    // an operator they had tried to move a date they never touched.
    for (const field of [
      "startTime",
      "endTime",
      "playWindowStart",
      "playWindowEnd",
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it("carries no operator-settable play window on the draft", () => {
    expect(emptyDraft).not.toHaveProperty("playWindowStart");
    expect(emptyDraft).not.toHaveProperty("playWindowEnd");
  });

  it("offers no play-window date field on either screen", () => {
    /*
      Asserted as the JSX prop rather than the bare word, and on BOTH screens. A single
      remaining field would restore the whole defect: the derivation would still run, then the
      operator's own value would overwrite it in the same payload.
    */
    for (const file of [WIZARD, EDITOR]) {
      expect(code(file)).not.toMatch(/value=\{draft\.playWindowStart\}/);
      expect(code(file)).not.toMatch(/value=\{draft\.playWindowEnd\}/);
    }
  });

  it("produces the window in exactly one place", () => {
    // The whole reason the derivation is a function. Two call sites, one definition; a third
    // literal `playWindowStart:` assignment means somebody has written the rule twice.
    const source = code(DRAFT);
    const assignments = source.match(/playWindowStart:\s*localToIso/g) ?? [];
    expect(assignments).toHaveLength(1);
    expect(source).toMatch(/playWindowStart:\s*localToIso\(draft\.startTime\)/);
    expect(source).toMatch(/playWindowEnd:\s*localToIso\(draft\.endTime\)/);
  });
});

// =======================================================================================
// A prize split the operator can reach
// =======================================================================================

describe("the prize distribution is editable", () => {
  it("sends the operator's distribution, not a constant", () => {
    const chosen = [
      { rank: 1, percentage: 70 },
      { rank: 2, percentage: 20 },
      { rank: 3, percentage: 10 },
    ];

    expect(toRequestBody(draftWith({ prizeDistribution: chosen })).prizeDistribution).toEqual(
      chosen,
    );
  });

  it("sends the operator's platform fee, not the default", () => {
    // The wizard never rendered this control, so every provider contest took 10%.
    expect(
      toRequestBody(draftWith({ platformFeePercentage: 25 })).platformFeePercentage,
    ).toBe(25);
  });

  it("renders the prize editor and the platform fee on the wizard", () => {
    const source = code(WIZARD);

    // The element with its wiring, not the identifier: the import alone would satisfy a bare
    // name match while the step rendered nothing, which is the exact defect this pins.
    expect(source).toMatch(
      /<PrizeDistributionEditor[\s\S]{0,300}?value=\{draft\.prizeDistribution\}/,
    );
    expect(source).toMatch(
      /<PrizeDistributionEditor[\s\S]{0,300}?onChange=\{\(v\) => patch\(\{ prizeDistribution: v \}\)\}/,
    );
    expect(source).toMatch(/value=\{draft\.platformFeePercentage\}/);
  });

  it("uses ONE prize editor across the wizard and the editor", () => {
    /*
      The editor already had a local `PrizeDistributionFields` that could change a percentage
      and nothing else - no add, no remove, no rank position - so an operator could reweight
      three winners but never make it five. Two components disagreeing about what a prize split
      IS was the problem, so a second definition anywhere is a regression, not a duplication to
      tidy up later.
    */
    expect(code(EDITOR)).not.toMatch(/function PrizeDistributionFields/);
    expect(code(EDITOR)).toMatch(
      /<PrizeDistributionEditor[\s\S]{0,300}?value=\{draft\.prizeDistribution\}/,
    );
  });

  it("freezes the split once anyone has entered, on the editor only", () => {
    // The wizard creates; there is nobody to freeze against. The editor must pass the flag or
    // an operator can reweight a pot people have already paid into.
    expect(code(EDITOR)).toMatch(
      /<PrizeDistributionEditor[\s\S]{0,300}?disabled=\{entered\}/,
    );
  });

  it("accepts a split the server accepts, and refuses one it refuses", () => {
    /*
      The tolerance is the SERVER's, restated. A stricter check here shows a red warning over a
      distribution the server takes, which is how a screen teaches an operator to ignore it.
      Three-way even is the case that motivated it and is asserted directly.
    */
    const threeWay = [
      { rank: 1, percentage: 33.33 },
      { rank: 2, percentage: 33.33 },
      { rank: 3, percentage: 33.34 },
    ];
    expect(prizeTotalIsValid(threeWay)).toBe(true);

    expect(prizeTotalIsValid([{ rank: 1, percentage: 100 }])).toBe(true);
    expect(
      prizeTotalIsValid([
        { rank: 1, percentage: 70 },
        { rank: 2, percentage: 20 },
      ]),
    ).toBe(false);
  });

  it("totals an empty percentage as zero rather than NaN", () => {
    // A cleared input yields NaN through `Number("")` in some browsers' paths; one NaN makes
    // the whole total read "NaN%" and it never recovers as the operator keeps typing.
    expect(
      prizeTotal([
        { rank: 1, percentage: 60 },
        { rank: 2, percentage: undefined as unknown as number },
      ]),
    ).toBe(60);
  });

  it("keeps at least two paid places available", () => {
    // No paid format is ever single-player - a platform-wide hard constraint.
    expect(MIN_PRIZE_RANKS).toBe(2);
  });
});
