/**
 * Whether a contest's clock is long enough for one attempt of its game, and the one-click fix.
 *
 * MOVED HERE FROM `apps/admin/components/admin/games/contest-draft.ts` on 28 September 2026,
 * character for character, because a second screen needed it: the Game Master contest wizard
 * in the main app, which cannot import from `apps/admin`. Writing a second copy there would
 * have been the "one rule, two copies" shape - two screens telling two creators different
 * things about whether the same race fits the same clock. The admin file re-exports these
 * names, so every admin caller is unchanged. Mirrored into `apps/admin/lib/services/games/`
 * and held byte-identical by a test, because `check:mirrors` compares models only.
 *
 * MODEL-FREE BY REQUIREMENT (R58). Both wizards are `"use client"`, so nothing imported here
 * may reach the database driver.
 *
 * NO GAME IS NAMED HERE. The playing time is found through the `format` keyword a title
 * declares on its own settings schema (`resolveAttemptSeconds`), so a race counted in laps and
 * a puzzle counted in minutes get the same answer from the same code.
 */

import type { ConfigField } from "./config-schema";
import { resolveAttemptSeconds } from "./config-schema";
import { RESULT_GRACE_MARGIN_SECONDS } from "./contest-preflight";
import { resolveContestEntryDeadline } from "./entry-deadline";
import type { RoundStartPolicy } from "./round-types";

/**
 * Converts a UTC draft value (`YYYY-MM-DDTHH:mm`) to an absolute ISO instant.
 *
 * Returns the input unchanged when empty or unparseable, so the server produces the "this
 * date is required / not valid" message rather than this function inventing one. A bare
 * `new Date("2026-09-20T13:00")` is local in every browser, which is exactly the shift that
 * made a correctly typed end time land before the start.
 */
export function utcDraftToIso(value: string): string {
  if (!value) return value;
  // Already absolute (edit forms sometimes pass a stored ISO through unchanged).
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const absolute = new Date(value);
    return Number.isNaN(absolute.getTime()) ? value : absolute.toISOString();
  }
  // Fixed-length date + hour:minute only — no nested optional groups (eslint
  // security/detect-unsafe-regex). Seconds, if present, are ignored; we always write :00Z.
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? value : fallback.toISOString();
  }
  const instant = new Date(`${match[1]}T${match[2]}:00Z`);
  return Number.isNaN(instant.getTime()) ? value : instant.toISOString();
}

/**
 * The inverse, for populating a form from stored dates. Built from UTC getters, because the
 * schedule pickers show UTC and a local version silently moves a saved contest on re-save.
 */
export function isoToUtcDraft(value: string | Date | undefined | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

/**
 * How the contest clock and the game's playing time relate.
 *
 * THE CREATOR MEETS TWO NUMBERS THAT BOTH LOOK LIKE "HOW LONG": the game's own settings (one
 * of which the title marks as its play clock - how long ONE attempt lasts) and the contest's
 * start and end. This is the one place that compares them.
 *
 * ABSENT DURATION MEANS NO STATEMENT, never a guessed one. `RoundPreflight.tsx` applies no
 * gate when nothing declares a duration, so a screen that invented a deadline here would
 * contradict the server for the one class of title where nobody knows the answer.
 */
export function describeRoundFit(input: {
  startTime: string;
  endTime: string;
  /** The title's parsed `configSchema`. Empty is fine; it just means nothing is declared. */
  schemaFields?: ConfigField[];
  /** The creator's answers, which is where the declared clock's value lives. */
  settings?: Record<string, unknown>;
  /** The catalogue ceiling, used only when the title declares no play clock. */
  maxDurationSeconds?: number;
  /**
   * Absent means `reserve_full_round`, matching the schema, so a stored contest with no
   * policy is described by the rule it was created under.
   */
  roundStartPolicy?: RoundStartPolicy;
}):
  | {
      /** How long one attempt runs for, and therefore how much time is reserved. */
      reservedSeconds: number;
      /**
       * Present only while the contest reserves a full round. Under `until_window_closes`
       * there is no cut-off to name, and returning the arithmetic anyway is how a screen
       * ends up printing a deadline that does not exist.
       */
      lastAttemptStart?: Date;
      reservesFullRound: boolean;
      /**
       * True when no attempt could run to its natural length.
       *
       * A REFUSAL OR A WARNING DEPENDING ON THE POLICY, which is why the flag says what is
       * true rather than what the screen should do about it: reserving, nobody can start a
       * round at all and `contest-preflight.ts` refuses; until-close, every round is simply
       * shortened and the contest is legitimate.
       */
      windowTooShort: boolean;
      /** The contest's own length, so a caller can state both sides of the comparison. */
      windowSeconds: number;
    }
  | undefined {
  const attemptSeconds = resolveAttemptSeconds(
    input.schemaFields ?? [],
    input.settings,
    input.maxDurationSeconds,
  );
  if (attemptSeconds === undefined) return undefined;

  // Reason: draft values are UTC wall-clock without a zone; parse through utcDraftToIso
  // so a browser in UTC+3 cannot shrink a one-hour window to "0 seconds".
  const start = new Date(utcDraftToIso(input.startTime));
  const end = new Date(utcDraftToIso(input.endTime));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  const windowSeconds = (end.getTime() - start.getTime()) / 1000;
  const reservesFullRound = input.roundStartPolicy !== "until_window_closes";

  return {
    reservedSeconds: attemptSeconds,
    // Delegated rather than subtracted here: this is the same instant the contest stores as
    // its `registrationDeadline` and the same one the play screen counts down to.
    lastAttemptStart: reservesFullRound
      ? resolveContestEntryDeadline({
          playWindowEnd: end,
          attemptSeconds,
          roundStartPolicy: input.roundStartPolicy,
          startTime: start,
        })
      : undefined,
    reservesFullRound,
    windowTooShort: windowSeconds < attemptSeconds,
    windowSeconds,
  };
}

/**
 * A duration a person can read without doing arithmetic. Seconds are kept for anything that
 * is not a whole number of minutes, because rounding "90 seconds" to "1 minute" in a sentence
 * about whether something FITS would be wrong in the one direction that matters.
 */
export function describeDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} seconds`;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return `${Math.round(seconds)} seconds`;
}

/**
 * The end time that makes the contest long enough for one whole attempt, for the timing
 * note's one-click fix. Adds a minute of headroom and rounds UP to the minute, because the
 * schedule inputs hold minutes and rounding down would land back under the attempt length.
 */
export function endTimeThatFits(
  startTime: string,
  reservedSeconds: number,
): string | undefined {
  const start = new Date(utcDraftToIso(startTime));
  if (Number.isNaN(start.getTime()) || !(reservedSeconds > 0)) return undefined;
  const minuteMs = 60_000;
  const endMs = start.getTime() + reservedSeconds * 1000 + minuteMs;
  return isoToUtcDraft(new Date(Math.ceil(endMs / minuteMs) * minuteMs));
}

/**
 * How long the contest keeps accepting a late result, derived rather than asked for.
 *
 * It has to cover the longest attempt plus a margin, or a round started at the last moment is
 * cut off before its result can arrive - and `contest-preflight.ts` refuses a contest whose
 * grace is short. A fixed 900 seconds would refuse every contest whose playing time runs
 * past ten minutes, naming a field no creator can see. IT ONLY EVER RAISES the floor it is
 * given, so a deliberately longer grace is never lowered.
 */
export function deriveResultGraceSeconds(
  floorSeconds: number,
  attemptSeconds: number | undefined,
): number {
  if (attemptSeconds === undefined) return floorSeconds;
  return Math.max(floorSeconds, attemptSeconds + RESULT_GRACE_MARGIN_SECONDS);
}
