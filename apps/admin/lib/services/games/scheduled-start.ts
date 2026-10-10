import { playModeHasLobby } from "./play-shape";

/**
 * How far ahead a together-start (`scheduled`) contest's start must still be when it is
 * created, published or re-timed.
 *
 * A scheduled contest closes entry at its start (`entryClosesAtStart`), so a contest whose start
 * is already behind it when it goes live can never be entered by anyone. (When this was written
 * Play also refused every new round after the start; since 28 Sep 2026 a player who entered in
 * time may still join the running race late.) That was reachable because nothing compared the
 * start with the clock. Two minutes is the least time in which a player can realistically join
 * and open the lobby before the gun.
 *
 * Model-free on purpose, like `play-shape.ts`, so the admin wizard can import the same number.
 */
export const MIN_SCHEDULED_START_LEAD_SECONDS = 120;

/**
 * The refusal sentence when a scheduled contest's start is too soon, or `null` when it is fine
 * or the contest has no gun. The start is the play window start, which is the gun the launch
 * gate reads.
 */
export function scheduledStartTooSoon(
  contest: { playMode?: string | null; playWindowStart?: Date | null },
  now: Date,
): string | null {
  if (!playModeHasLobby(contest.playMode) || !contest.playWindowStart) return null;
  const start = new Date(contest.playWindowStart).getTime();
  if (!Number.isFinite(start)) return null;
  const earliest = now.getTime() + MIN_SCHEDULED_START_LEAD_SECONDS * 1000;
  if (start >= earliest) return null;
  const minutes = MIN_SCHEDULED_START_LEAD_SECONDS / 60;
  const when = start <= now.getTime() ? "has already passed" : "is too soon";
  return `Everyone starts together in this competition, and its start time ${when}. Nobody could join and enter the lobby before the start, so no one could play. Set the start at least ${minutes} minutes from now (UTC) and try again.`;
}
