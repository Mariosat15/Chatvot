import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  describeEntryClose,
  resolveRegistrationDeadline,
} from "@/lib/utils/registration-deadline";
import { resolveContestEntryDeadline } from "@/lib/services/games/entry-deadline";

/**
 * WHAT A PLAYER IS TOLD ABOUT THE DOOR CLOSING, and why the trading-capital line is withheld.
 *
 * Two owner reports on one panel, 10 September 2026. The first is the wording: the entry
 * countdown carried one unconditional sentence about entries being refused "whether or not the
 * competition is still running", which is false under `until_window_closes` - there the
 * deadline IS the moment play stops - and silent about the reason under `reserve_full_round`,
 * where the gap exists precisely to stop somebody paying for a contest they cannot finish a
 * round in.
 *
 * The second was found while reading the file: the panel promised every entrant
 * "$0 in trading capital to compete" on a provider contest, because `startingCapital` is
 * `required` only while the contest is trading and the panel's `|| 0` turned the absent field
 * into a number.
 */

const PANEL = readFileSync(
  join(process.cwd(), "components/trading/CompetitionEntryButton.tsx"),
  "utf8",
);

/** Comments in this file discuss the anti-patterns, so a structural test must not read them. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const CODE = stripComments(PANEL);

const START = new Date("2026-09-10T10:00:00.000Z");
const END = new Date("2026-09-10T12:00:00.000Z");
const TEN_MINUTES = 10 * 60;

describe("describeEntryClose - which rule shut the door", () => {
  it("a trading contest has no round policy, so the operator chose the deadline", () => {
    // Reason this is the default rather than an error: a trading contest's deadline is a real
    // operator decision unrelated to round length, and the original sentence is correct there.
    const answer = describeEntryClose({
      registrationDeadline: new Date("2026-09-10T11:00:00.000Z"),
      startTime: START,
      endTime: END,
    });

    expect(answer).toEqual({ kind: "operator_chosen", reservedMs: 0 });
  });

  it("under 'players can start any time' entry runs to the end", () => {
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: END,
      attemptSeconds: TEN_MINUTES,
      roundStartPolicy: "until_window_closes",
      startTime: START,
    });

    // The deadline IS the window end under this policy, which is the whole point of it.
    expect(deadline.getTime()).toBe(END.getTime());

    expect(
      describeEntryClose({
        registrationDeadline: deadline,
        startTime: START,
        endTime: END,
        playWindowEnd: END,
        roundStartPolicy: "until_window_closes",
      }),
    ).toEqual({ kind: "runs_to_the_end", reservedMs: 0 });
  });

  it("under 'everybody gets the full time' it reserves exactly one attempt", () => {
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: END,
      attemptSeconds: TEN_MINUTES,
      roundStartPolicy: "reserve_full_round",
      startTime: START,
    });

    const answer = describeEntryClose({
      registrationDeadline: deadline,
      startTime: START,
      endTime: END,
      playWindowEnd: END,
      roundStartPolicy: "reserve_full_round",
    });

    expect(answer.kind).toBe("reserves_round");
    // The span the player is shown is the attempt length, to the millisecond. Asserted against
    // the writer's own output rather than a literal, so the two cannot drift.
    expect(answer.reservedMs).toBe(TEN_MINUTES * 1000);
  });

  it("reserving nothing is described permissively, because that is how it behaves", () => {
    // No declared attempt length: `resolveContestEntryDeadline` returns the window end and the
    // round-start gate reserves `attemptSeconds ?? maxDurationSeconds ?? 0`, so nothing is held
    // back. Saying "we kept time for you" would be a promise no gate keeps.
    const deadline = resolveContestEntryDeadline({
      playWindowEnd: END,
      attemptSeconds: undefined,
      roundStartPolicy: "reserve_full_round",
      startTime: START,
    });

    expect(deadline.getTime()).toBe(END.getTime());
    expect(
      describeEntryClose({
        registrationDeadline: deadline,
        startTime: START,
        endTime: END,
        playWindowEnd: END,
        roundStartPolicy: "reserve_full_round",
      }),
    ).toEqual({ kind: "runs_to_the_end", reservedMs: 0 });
  });

  it("the reserved span is measured from the CLAMPED deadline, not the stored one", () => {
    /*
      The legacy clamp is the reason this lives beside `resolveRegistrationDeadline`. A stored
      deadline before the start is pulled forward to the start, so on a contest shorter than one
      round the door shuts at the gun and the span the player is owed is the whole contest - not
      the attempt length. A copy of this that read the raw field would report a NEGATIVE or an
      understated reservation while the countdown beside it used the clamped instant.
    */
    const stored = new Date("2026-09-10T09:00:00.000Z"); // an hour before the start
    expect(
      resolveRegistrationDeadline({
        registrationDeadline: stored,
        startTime: START,
      })?.getTime(),
    ).toBe(START.getTime());

    const answer = describeEntryClose({
      registrationDeadline: stored,
      startTime: START,
      endTime: END,
      playWindowEnd: END,
      roundStartPolicy: "reserve_full_round",
    });

    expect(answer.kind).toBe("reserves_round");
    expect(answer.reservedMs).toBe(END.getTime() - START.getTime());
  });

  it("falls back to endTime when the play window is absent", () => {
    const answer = describeEntryClose({
      registrationDeadline: new Date("2026-09-10T11:50:00.000Z"),
      startTime: START,
      endTime: END,
      roundStartPolicy: "reserve_full_round",
    });

    expect(answer).toEqual({ kind: "reserves_round", reservedMs: 10 * 60 * 1000 });
  });

  it("says nothing rather than guessing when there is no end at all", () => {
    expect(
      describeEntryClose({
        registrationDeadline: new Date("2026-09-10T11:50:00.000Z"),
        startTime: START,
        roundStartPolicy: "reserve_full_round",
      }),
    ).toEqual({ kind: "operator_chosen", reservedMs: 0 });
  });

  it("an unparseable end is not treated as a reservation", () => {
    expect(
      describeEntryClose({
        registrationDeadline: new Date("2026-09-10T11:50:00.000Z"),
        startTime: START,
        endTime: "not a date",
        roundStartPolicy: "reserve_full_round",
      }).kind,
    ).toBe("operator_chosen");
  });

  it("reads the stored policy and never infers one from the arithmetic", () => {
    /*
      A deadline before the end looks exactly like a reservation. It is not, when the policy is
      permissive - an operator could have set an early deadline for another reason entirely -
      and describing it as "we held a round back for you" is a promise about the round-start
      gate that the gate does not make.
    */
    expect(
      describeEntryClose({
        registrationDeadline: new Date("2026-09-10T11:30:00.000Z"),
        startTime: START,
        endTime: END,
        playWindowEnd: END,
        roundStartPolicy: "until_window_closes",
      }),
    ).toEqual({ kind: "runs_to_the_end", reservedMs: 0 });
  });
});

describe("the entry panel says which rule applies", () => {
  it("branches on all three kinds", () => {
    expect(CODE).toContain("describeEntryClose(competition)");
    expect(CODE).toMatch(/entryClose\.kind\s*===\s*"reserves_round"/);
    expect(CODE).toMatch(/entryClose\.kind\s*===\s*"runs_to_the_end"/);
  });

  it("the misleading clause is reachable only on the operator-chosen branch", () => {
    /*
      Counting, not presence. The sentence is CORRECT for a trading contest whose operator set
      a deadline, so a test banning it outright would fail on correct code and be deleted by
      the first person it inconvenienced. What must not happen is a second copy of it leaking
      back onto a game branch, which is exactly what the defect was.
    */
    const clause = [
      ...CODE.matchAll(/whether or not the\s+competition is still running/g),
    ];
    expect(clause).toHaveLength(1);

    const ternary = CODE.indexOf('entryClose.kind === "runs_to_the_end"');
    expect(ternary).toBeGreaterThan(-1);
    // It sits in the final else, so it must appear AFTER the last branch test.
    expect(clause[0].index ?? -1).toBeGreaterThan(ternary);
  });

  it("the reserved span is rendered, not merely computed", () => {
    // Reason the operand is asserted rather than the helper's name: a panel that calls
    // `describeEntryClose`, discards the span and prints a fixed "a few minutes" satisfies any
    // check for the import while telling the player nothing they can plan around.
    expect(CODE).toMatch(/formatRemaining\(entryClose\.reservedMs\)/);
  });

  it("the deadline and the explanation come from one module", () => {
    // Two producers here means a countdown reaching zero while the sentence under it describes
    // a different instant - the "one rule, two copies" shape this file was extracted to stop.
    // No `s` flag: `[^}]` already crosses newlines, and the flag needs an es2018 target.
    expect(CODE).toMatch(
      /import\s*\{[^}]*describeEntryClose[^}]*resolveRegistrationDeadline[^}]*\}\s*from\s*"@\/lib\/utils\/registration-deadline"/,
    );
    expect(CODE).not.toMatch(/registrationDeadline\s*\)\s*-\s*/);
  });
});

describe("the trading-capital promise is withheld from a game", () => {
  it("is guarded, and the guard is the game test", () => {
    const at = CODE.indexOf("in trading");
    expect(at).toBeGreaterThan(-1);

    // Positional, not file-wide: `isProviderGame` is used several times in this file, so a
    // bare check that the identifier appears is green on the defect.
    const before = CODE.slice(Math.max(0, at - 400), at);
    expect(before).toMatch(/!isProviderGame\s*&&/);
  });

  it("there is exactly one capital sentence, so a second cannot render unguarded", () => {
    expect([...CODE.matchAll(/in trading\s*\n?\s*capital to compete/g)]).toHaveLength(1);
    expect([...CODE.matchAll(/startingCapital\.toLocaleString\(\)/g)]).toHaveLength(1);
  });

  it("the non-refundable half is NOT withheld", () => {
    /*
      The load-bearing negative. Guarding the whole info box would have been the smaller diff
      and would have taken the fee warning off every game contest with it - and that sentence
      is true of every game, which is why the guard wraps the capital clause alone.
    */
    const box = CODE.indexOf("Entry fee is non-refundable");
    expect(box).toBeGreaterThan(-1);
    const guard = CODE.indexOf("!isProviderGame", box);
    expect(guard).toBeGreaterThan(box);
  });
});
