/**
 * WHEN ENTRY CLOSES FOR A GAME CONTEST.
 *
 * The owner's instruction on 8 September 2026 was that a player may join at any point before
 * the contest ends. A provider contest was doing the opposite: `createProviderContest` wrote
 * `registrationDeadline: new Date(input.startTime)`, so arriving a minute after a one-hour
 * contest opened meant not being able to join it at all.
 *
 * TAKEN LITERALLY THE INSTRUCTION SELLS A SEAT THAT CANNOT PLAY, which is why these tests
 * assert something slightly narrower than "until the end". Under `reserve_full_round` the gate
 * in `round.service.ts` refuses an attempt that would not fit in what remains, so entry open to
 * the final second means a player paying an entry fee, being refused every attempt, ranking on
 * nothing, and - since R50 - not even being eligible for the redistribution. Entry therefore
 * closes at the last moment playing is still possible, which under the permissive policy IS
 * the window end and under the reserving one is one attempt before it.
 *
 * THE STRUCTURAL HALF MATTERS AS MUCH AS THE ARITHMETIC. Three places derived this instant
 * independently before today, and the two a player sees sit either side of a decision to
 * travel to another screen. The negative assertions below - that no consumer subtracts the
 * attempt length itself - are the load-bearing ones: importing the shared module is trivially
 * satisfied by a file that imports it and then does the sum again five lines later, which is
 * exactly what `RoundPreflight` did before `round-window.ts` was extracted.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  entryDeadlineMs,
  resolveContestEntryDeadline,
} from "@/lib/services/games/entry-deadline";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const CREATE =
  "apps/admin/lib/services/game-providers/provider-contest.service.ts";
const EDIT =
  "apps/admin/lib/services/game-providers/provider-contest-edit.service.ts";
const MAIN_MODULE = "lib/services/games/entry-deadline.ts";
const ADMIN_MODULE = "apps/admin/lib/services/games/entry-deadline.ts";
const PLAYER_WINDOW = "components/games/round-window.ts";
const ROUND_FIT = "lib/services/games/round-fit.ts";

/** Comments explain these rules at length, and a structural test that reads prose is useless. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const start = new Date("2026-09-08T12:00:00.000Z");
const windowEnd = new Date("2026-09-08T13:00:00.000Z");

describe("resolveContestEntryDeadline", () => {
  it("keeps entry open past the start, which is the whole point of the change", () => {
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: 600,
      roundStartPolicy: "reserve_full_round",
      startTime: start,
    });

    expect(deadline.getTime()).toBeGreaterThan(start.getTime());
  });

  it("FLIPPED 2 Oct 2026: no longer holds back an attempt, even under the old reserving policy", () => {
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: 600,
      roundStartPolicy: "reserve_full_round",
      startTime: start,
    });

    // Reason: this used to assert the window end less one attempt, matching the round-start
    // gate's `reserve_full_round` subtraction, so a player was never sold a seat the gate then
    // refused. The owner removed that gate on every game (2 Oct 2026): a late joiner now plays a
    // shortened round, so the seat is playable to the last second and entry stays open with it.
    expect(deadline.getTime()).toBe(windowEnd.getTime());
  });

  it("runs to the window end under until_window_closes, because a short round is allowed there", () => {
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: 600,
      roundStartPolicy: "until_window_closes",
      startTime: start,
    });

    expect(deadline.getTime()).toBe(windowEnd.getTime());
  });

  it("FLIPPED 2 Oct 2026: an absent policy reserves nothing either", () => {
    // Was: "treats an absent policy as reserving, matching the schema and contest-config".
    // contest-config now normalises every stored policy to until_window_closes, so an absent
    // one must not quietly reinstate the reservation here.
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: 600,
      roundStartPolicy: undefined,
      startTime: start,
    });

    expect(deadline.getTime()).toBe(windowEnd.getTime());
  });

  it("keeps entry open to the end of an everyone-at-once contest too", () => {
    // Reason (owner, 2 Oct 2026): a late joiner of a scheduled race joins the running race.
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: 600,
      roundStartPolicy: "until_window_closes",
      startTime: start,
      entryClosesAtStart: true,
    });

    expect(deadline.getTime()).toBe(windowEnd.getTime());
  });

  it("reserves nothing when no attempt length is known, matching the gate's own fallback", () => {
    // Reason: `roundFitsInWindow` reads `attemptSeconds ?? maxDurationSeconds ?? 0`, so with
    // neither declared it applies no reservation. Guessing one here would close entry against
    // a rule nothing enforces.
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: windowEnd,
      attemptSeconds: undefined,
      roundStartPolicy: "reserve_full_round",
      startTime: start,
    });

    expect(deadline.getTime()).toBe(windowEnd.getTime());
  });

  it("never lands before the contest starts", () => {
    // Re-aimed 2 Oct 2026: with no subtraction left, the floor is reached only by a window
    // that ends before the start - a malformed document. A deadline before the start is not a
    // short entry window, it is a contest nobody can enter.
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: new Date(start.getTime() - 60_000),
      attemptSeconds: 600,
      roundStartPolicy: "until_window_closes",
      startTime: start,
    });

    expect(deadline.getTime()).toBe(start.getTime());
  });
});

describe("entryDeadlineMs - the screens' half", () => {
  it("FLIPPED 2 Oct 2026: is the last full-length attempt, no longer the entry deadline", () => {
    // Was: "agrees with the date version for the reserving case". Entry now stays open to the
    // window end, so the two deliberately differ: this number only tells the play screen how
    // long an UNSHORTENED round remains, and must not be read as the moment entry closes.
    expect(entryDeadlineMs(windowEnd.getTime(), 600)).toBe(
      windowEnd.getTime() - 600_000,
    );
    expect(
      resolveContestEntryDeadline({
        playWindowEnd: windowEnd,
        attemptSeconds: 600,
        roundStartPolicy: "reserve_full_round",
        startTime: start,
      }).getTime(),
    ).toBe(windowEnd.getTime());
  });

  it("says nothing rather than guessing, which the writer cannot do", () => {
    // Reason for the deliberate asymmetry: a service writing a stored field has to write
    // something, where a screen naming a deadline it cannot compute is worse than silent.
    expect(entryDeadlineMs(null, 600)).toBeNull();
    expect(entryDeadlineMs(windowEnd.getTime(), undefined)).toBeNull();
    expect(entryDeadlineMs(windowEnd.getTime(), Number.NaN)).toBeNull();
  });
});

describe("one producer, and every consumer delegates to it", () => {
  it("the admin copy is byte-identical to the main one", () => {
    // `check:mirrors` compares models, so it has no opinion about this file - and the writers
    // live in apps/admin while the readers live in the main app, which is exactly the shape
    // that produced `referenceId`, `failedReason` and `challengeId`.
    expect(read(ADMIN_MODULE)).toBe(read(MAIN_MODULE));
  });

  it("stays importable by a client component, which is what makes one producer possible", () => {
    /*
      `RoundPreflight` is `"use client"` and the provider lobby is a server component, so this
      module reaches both only while its runtime import graph is empty. A value import of a
      model here does not fail this suite - it fails the client BUILD, one screen away, with an
      error naming Mongoose rather than this file.

      Type-only imports are fine and are why the check is on `import type` rather than on
      imports at all: they are erased, and forbidding them would push `RoundStartPolicy` into a
      third definition. Same requirement as `components/games/play-state.ts` and
      `apps/admin/lib/admin/contest-control-copy.ts`, both of which were first written as a
      second copy for exactly this reason.
    */
    for (const path of [MAIN_MODULE, ADMIN_MODULE]) {
      const runtimeImports = [
        ...read(path).matchAll(/^import\s+(?!type\b)[^;]+from\s+"([^"]+)"/gm),
      ].map((m) => m[1]);
      expect(runtimeImports).toEqual([]);
    }
  });

  it("the play screen's helper forwards rather than repeating the sum", () => {
    const src = stripComments(read(PLAYER_WINDOW));
    expect(src).toMatch(/entryDeadlineMs\s*\(/);
    // The negative half. Importing the module proves nothing if the file then subtracts again.
    expect(src).not.toMatch(/\*\s*1000/);
  });

  it("FLIPPED 2 Oct 2026: the wizard's clock note no longer reads the ENTRY deadline", () => {
    // Was: "the wizard's clock note forwards rather than repeating the sum" - it delegated the
    // last-attempt moment to `resolveContestEntryDeadline`. Once entry stayed open to the end
    // the two answers stopped being the same moment, so delegating would make the note claim
    // the last full attempt starts at the final whistle. The note now computes it once,
    // floored at the start, and the entry deadline is not imported at all.
    const src = stripComments(read(ROUND_FIT));
    expect(src).not.toMatch(/resolveContestEntryDeadline/);
    const fit = src.slice(src.indexOf("export function describeRoundFit"));
    expect(fit.length).toBeGreaterThan(200);
    expect(fit.match(/end\.getTime\(\)\s*-\s*attemptSeconds\s*\*\s*1000/g)).toHaveLength(1);
    expect(fit).toMatch(/Math\.max\(\s*start\.getTime\(\)/);
  });
});

describe("the two writers", () => {
  it("create derives the deadline instead of pinning it to the start", () => {
    const src = stripComments(read(CREATE));
    expect(src).toMatch(/registrationDeadline:\s*resolveContestEntryDeadline\(/);
    // The defect verbatim. A probe restoring it must go red here and nowhere vaguer.
    expect(src).not.toMatch(
      /registrationDeadline:\s*new Date\(input\.startTime\)/,
    );
  });

  it("create resolves the fallback policy ONCE, and to the wizard's default", () => {
    // It was `until_window_closes`, to match a wizard that defaulted to the permissive
    // option. The owner reversed that default, so a stale fallback would give a caller
    // omitting the field the opposite of what the screen shows.
    //
    // Reason the count matters: the fallback was briefly written twice, once for the stored
    // field and once inside the deadline call, and a probe changing either one stayed green
    // because the assertion found the other. Two copies here is not cosmetic - the contest
    // would store one policy while closing entry under the other, with nothing to compare.
    //
    // FLIPPED 2 Oct 2026: the fallback now names `until_window_closes`, because the owner
    // removed the late-start reservation on every game. The shape forces that value anyway;
    // the fallback must not name the removed policy, or a shape without a forced value would
    // silently reinstate it.
    const src = stripComments(read(CREATE));
    const fallbacks = src.match(/RoundStart\s*\?\?\s*"[a-z_]+"/g);
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks?.[0]).toContain('"until_window_closes"');
    expect(src).not.toMatch(/\?\?\s*"reserve_full_round"/);
  });

  it("edit recomputes the deadline AFTER every other field is written", () => {
    const src = stripComments(read(EDIT));
    const deadline = src.indexOf("competition.registrationDeadline =");
    const settings = src.indexOf("markModified(\"gameConfig\")");
    const startTime = src.indexOf("competition.startTime = input.startTime");

    expect(deadline).toBeGreaterThan(-1);
    // Four fields feed the deadline and an edit may move any subset. Computing it inside the
    // start-time branch - which is where it used to live - is wrong the moment the play window
    // or the settings move instead, and there is no error when it happens.
    expect(deadline).toBeGreaterThan(settings);
    expect(deadline).toBeGreaterThan(startTime);
  });

  it("edit reads the document rather than the request", () => {
    const src = stripComments(read(EDIT));
    const block = src.slice(src.indexOf("competition.registrationDeadline ="));
    // `input.x` here would be stale for every field the operator did not touch.
    expect(block.slice(0, 600)).not.toMatch(/input\./);
  });

  it("edit loads the title unconditionally, not only when settings change", () => {
    const src = stripComments(read(EDIT));
    const lookup = src.indexOf("ProviderGame.findOne");
    const settingsBranch = src.indexOf("if (input.settings !== undefined)");

    expect(lookup).toBeGreaterThan(-1);
    // Loading it inside the settings branch means an edit that only moves the end time
    // recomputes the deadline against no play clock and leaves entry open to the last second.
    expect(lookup).toBeLessThan(settingsBranch);
  });
});
