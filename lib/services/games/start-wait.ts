/**
 * How long an "everyone plays at once" contest waits for two ready players (owner rule,
 * 28 September 2026).
 *
 * A together-start contest no longer starts at the start time regardless: the game holds it
 * until at least two players are ready. It cannot wait for ever, so each contest carries a
 * waiting limit. Once the limit passes and play never began, the whole contest is cancelled
 * and every player is refunded IN FULL, platform fee included - the same answer the platform
 * gives a contest that never reached its minimum number of players.
 *
 * MODEL-FREE BY REQUIREMENT (R58): the player's pre-flight screen and the admin wizard both
 * import this, and a client bundle must not reach a database driver. Mirrored byte-for-byte
 * into `apps/admin/lib/services/games/`.
 */

export const DEFAULT_START_WAIT_SECONDS = 300;
export const MIN_START_WAIT_SECONDS = 60;
export const MAX_START_WAIT_SECONDS = 900;

/** A whole number of seconds inside the permitted range. Anything else is not a waiting limit. */
export function isValidStartWaitSeconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_START_WAIT_SECONDS &&
    value <= MAX_START_WAIT_SECONDS
  );
}

/**
 * The waiting limit to use for a stored value.
 *
 * An unusable value reads as the default, never as zero: a zero limit would cancel every
 * together-start contest the moment it opened, and `NaN` from a `parseFloat` on an admin form
 * would make the deadline comparison false for ever, so nothing would ever be cancelled. Same
 * rule as R31 - when replacing a missing value, enumerate everything the fallback must catch.
 */
export function resolveStartWaitSeconds(stored: unknown): number {
  return isValidStartWaitSeconds(stored) ? stored : DEFAULT_START_WAIT_SECONDS;
}

/**
 * The moment a together-start contest gives up waiting, or `null` for any other contest.
 *
 * Only a contest STORED as `scheduled` has one, for the same reason only such a contest has a
 * lobby: the stored shape is what the contest was sold as, and an absent shape changes nothing.
 */
export function startWaitDeadline(contest: {
  playMode?: string | null;
  playWindowStart?: Date | null;
  startWaitSeconds?: unknown;
}): Date | null {
  if (contest.playMode !== "scheduled" || !contest.playWindowStart) return null;
  const start = new Date(contest.playWindowStart).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + resolveStartWaitSeconds(contest.startWaitSeconds) * 1000);
}

/** The least a round needs to say for the cancel decision. */
export interface StartWaitRoundFacts {
  userId: string;
  status: string;
  rawScore?: number | null;
}

/**
 * Whether play demonstrably never began, so the contest must be cancelled and refunded.
 *
 * Asked only once the deadline has passed. Both halves must hold:
 *
 * 1. NO ROUND CARRIES EVIDENCE THAT PLAY HAPPENED - a score on a finished round, or a round the
 *    provider has not yet reported on (`unresolved`). A contest that ran and merely produced
 *    poor results is settled normally, never refunded here.
 * 2. FEWER THAN TWO PLAYERS STILL HAVE A LIVE ROUND. Play needs two ready players and every
 *    ready player holds a live round, so with fewer than two it cannot be running and cannot
 *    start. With two or more live, play may be under way and its results not yet delivered, so
 *    the answer is "wait": the game gives up at the same deadline and ends every open round, and
 *    the next sweep sees them ended.
 *
 * Every other ending (`voided` by the game's own cancellation, `abandoned` with no score, a
 * player who never pressed Play at all) reads as "did not happen", which is the owner's rule:
 * nobody played, so nobody pays.
 */
export function playNeverStarted(rounds: readonly StartWaitRoundFacts[]): boolean {
  const evidenceOfPlay = rounds.some(
    (round) =>
      round.status === "unresolved" ||
      (round.status !== "voided" &&
        typeof round.rawScore === "number" &&
        Number.isFinite(round.rawScore)),
  );
  if (evidenceOfPlay) return false;

  const livePlayers = new Set(
    rounds
      .filter((round) => round.status === "pending" || round.status === "launched")
      .map((round) => round.userId),
  );
  return livePlayers.size < 2;
}

/** The recorded reason, which each player also reads in their cancellation notice. */
export function startWaitCancelReason(waitSeconds: number): string {
  const minutes = Math.round(waitSeconds / 60);
  return `Cancelled - fewer than two players were ready within ${minutes} minute${
    minutes === 1 ? "" : "s"
  } of the start. Every entry fee has been refunded in full.`;
}
