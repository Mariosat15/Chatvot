/**
 * The last instant at which starting an attempt is still worth something, in one place.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A FOURTH COPY. Three places were already deriving this
 * moment independently: the play screen's pre-flight, the admin wizard's clock note, and - from
 * 8 September 2026 - the contest's own `registrationDeadline`. All three answer the same
 * question, and the two that a player sees sit either side of a decision to travel to another
 * screen, so a disagreement of even a rounding is a player told they have time and then refused.
 * That is the "one rule, two copies" shape behind five defects in this codebase already
 * (`referenceId`, `failedReason`, `challengeId`, the Game Master `||`, the score direction R37
 * closed), none of which `check:mirrors` can see, because it compares models. So this module is
 * the producer and the other three delegate to it: a net reduction from three to one, not an
 * addition.
 *
 * IT IS MIRRORED, matching `config-schema.ts`, `contest-preflight.ts` and `round-types.ts`,
 * because the writers are in `apps/admin` and the readers are in the main app. The round
 * *services* beside it are deliberately not mirrored - there must be one round path - but this
 * is arithmetic over values both apps already hold.
 *
 * WHY ENTRY CLOSES HERE RATHER THAN AT `startTime`. A provider contest used to set
 * `registrationDeadline` to its own start, so a player who arrived a minute late could not join
 * at all. The owner asked for the opposite: join at any point before the contest ends. Taken
 * literally that sells a seat to somebody who cannot play - under `reserve_full_round` the gate
 * in `round.service.ts` refuses an attempt that would not fit, so a player joining with two
 * minutes left in a contest granting ten minutes of play would pay an entry fee, be refused
 * every attempt, and rank on nothing. The honest reading of the instruction is therefore
 * "for as long as playing is still possible", which is exactly the moment below.
 */

import type { RoundStartPolicy } from "./round-types";

interface EntryDeadlineInput {
  /** When play stops. `12` s2.3 derives this from the contest's own end. */
  playWindowEnd: Date;
  /**
   * How long one attempt of THIS contest runs for - `resolveAttemptSeconds`, never the
   * catalogue ceiling. `undefined` means nothing declares it, which is handled below.
   */
  attemptSeconds: number | undefined;
  /** Absent means `reserve_full_round`, matching both the schema and `contest-config.ts`. */
  roundStartPolicy: RoundStartPolicy | undefined;
  /**
   * The contest's start, used only as a floor. A deadline before the start is not a shorter
   * entry window, it is a contest nobody can enter - and `resolveRegistrationDeadline` already
   * clamps the same way at read time, for documents an older bug wrote that way.
   */
  startTime: Date;
}

/**
 * The instant after which no new entry is accepted.
 *
 * Three cases, and the third is the one that looks like a gap:
 *
 * - **`until_window_closes`** - the window end. That policy exists precisely to let a late
 *   player have a shortened round, so there is nothing to hold back.
 * - **`reserve_full_round`** - the window end less one whole attempt, matching
 *   `roundFitsInWindow`. Reserving a fraction would admit a player the gate then refuses.
 * - **No attempt length at all** - the window end, because the gate applies no reservation it
 *   cannot compute either (`attemptSeconds ?? maxDurationSeconds ?? 0`). Guessing a length here
 *   would close entry against a rule nothing enforces.
 */
export function resolveContestEntryDeadline(input: EntryDeadlineInput): Date {
  const reserves = input.roundStartPolicy !== "until_window_closes";
  const reservedMs =
    reserves && typeof input.attemptSeconds === "number"
      ? input.attemptSeconds * 1000
      : 0;

  const deadline = input.playWindowEnd.getTime() - reservedMs;
  return new Date(Math.max(deadline, input.startTime.getTime()));
}

/**
 * The same instant as milliseconds, for callers holding numbers rather than dates.
 *
 * `null` when the window end is unknown, or when a reserving contest has no attempt length -
 * the two cases where a screen must say nothing rather than name a deadline. Note this is
 * STRICTER than the function above, and deliberately: a service writing a stored deadline has
 * to write something, where a screen can and should stay quiet.
 */
export function entryDeadlineMs(
  playWindowEndMs: number | null,
  attemptSeconds: number | undefined,
): number | null {
  if (playWindowEndMs === null) return null;
  if (typeof attemptSeconds !== "number" || !Number.isFinite(attemptSeconds)) {
    return null;
  }

  return playWindowEndMs - attemptSeconds * 1000;
}
