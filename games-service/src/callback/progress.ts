import { signOutbound } from "../http/inbound-auth";
import { findTitle, type RoundConfig } from "../games/titles";
import { scoreRound, type BoardOutcome } from "../games/scoring";
import type { RoundDoc } from "../store/round.model";

/**
 * Telling the platform what the player has done SO FAR, while the round is still being played.
 *
 * WHY THIS EXISTS. The platform's contest board could say a player was playing and nothing
 * more, however many boards they had solved, because the only thing we ever sent was the final
 * result. The owner's words on 11 September 2026: it is "not showing live the boards the user
 * finished". This is our half of closing that.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * IT IS THE OPPOSITE OF `deliver.ts` IN EVERY WAY THAT MATTERS, AND THAT IS DELIBERATE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A result is retried for twenty-four hours with a delivery record per round, because a lost
 * one is a contest that cannot settle and other players' prize money frozen behind it.
 *
 * A progress report is fire-and-forget, with no record, no retry and no backoff. A lost one
 * costs a board one stale line for at most a few seconds, because the NEXT board supersedes it
 * and the result supersedes them all. Retrying would be strictly worse than not: a queue of
 * stale progress reports arriving out of order behind a finished round is a board that goes
 * backwards, and the platform refuses them anyway once the round is no longer live.
 *
 * So the failure handling here is to log at warn and carry on. What must never happen is a
 * progress send affecting the player's own game - an `await` on a slow platform between a
 * player solving a board and being handed the next one is a stall in a round somebody PAID
 * for. The caller therefore starts this and does not wait for it, and the promise cannot
 * reject.
 *
 * NO SCORE IS SENT. `scoreRound` computes one alongside the breakdown and it is discarded
 * here, deliberately: the platform's progress endpoint stores display figures and nothing
 * else, so sending a number it must ignore invites somebody on either side to start using it,
 * and a score arriving outside the one result callback is the second scoring door that
 * chapter 02 section 10 forbids.
 */

/**
 * How long we will wait for the platform to take a progress report.
 *
 * Much shorter than the result callback's ten seconds, and for the opposite reason. There, a
 * generous timeout buys a better chance of not losing a score. Here the report is worthless
 * within a few seconds anyway, so a long timeout only keeps a socket open into the next board.
 */
const PROGRESS_TIMEOUT_MS = 3_000;

function boardOutcomes(round: RoundDoc): BoardOutcome[] {
  return round.boards.map((board) => ({
    index: board.index,
    issuedAt: board.issuedAt,
    solvedAt: board.solvedAt,
  }));
}

/**
 * The figures for a round in flight, computed exactly as the final ones are.
 *
 * ONE SCORING FUNCTION, NOT A SECOND ONE THAT COUNTS BOARDS. Reusing `scoreRound` is what
 * makes the live line and the final line agree: a separate "progress breakdown" would drift
 * the moment either changes, and a board that says five boards solved beside a result that
 * says four is worse than a board that says nothing.
 *
 * Returns null when nothing is solved yet, because an all-zero breakdown is not progress - it
 * is the state every round is in before anybody has done anything, and reporting it puts a
 * line of zeroes under a player who has just pressed Play.
 */
export function progressBreakdownFor(
  round: RoundDoc,
): Record<string, unknown> | null {
  const title = findTitle(round.gameCode);
  if (!title) return null;

  const boards = boardOutcomes(round);
  if (!boards.some((board) => board.solvedAt)) return null;

  try {
    return scoreRound(title, round.config as unknown as RoundConfig, boards).breakdown ?? null;
  } catch {
    // A scoring function that throws mid-round must not take the player's board down with it.
    // The result path will surface the same fault where it is actually consequential.
    return null;
  }
}

/**
 * Sends one progress report. Never throws, never retries, never blocks the caller.
 *
 * Returns a small verdict so a test can assert what happened without a network. `skipped`
 * covers the two entirely normal cases - the platform did not ask for progress, or there is
 * nothing worth reporting yet - and is not a failure.
 */
export async function sendProgress(
  round: RoundDoc,
): Promise<{ sent: boolean; reason?: string }> {
  if (!round.progressCallbackUrl) return { sent: false, reason: "skipped" };
  if (round.mode !== "ranked") {
    // Practice has no contest board to appear on, and the platform stores no round for it.
    return { sent: false, reason: "skipped" };
  }

  const breakdown = progressBreakdownFor(round);
  if (!breakdown) return { sent: false, reason: "skipped" };

  const { body, headers } = signOutbound({
    roundId: round.roundId,
    providerRoundId: round.providerRoundId,
    breakdown,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROGRESS_TIMEOUT_MS);

  try {
    const response = await fetch(round.progressCallbackUrl, {
      method: "POST",
      headers,
      // The SAME string that was signed. Re-serialising here is the single most common way a
      // signed webhook fails - key order and number formatting shift and the signature stops
      // matching the bytes.
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Warn rather than error: a refused progress report is recoverable by definition,
      // because the next board sends another one and the result is delivered separately with
      // its own retry. The status is included because a persistent 401 means a rotated secret
      // and a persistent 404 means the wrong environment, and those need different actions.
      console.warn(
        `⚠️ [progress] ${round.roundId}: platform returned HTTP ${response.status}`,
      );
      return { sent: false, reason: `HTTP ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.warn(
      `⚠️ [progress] ${round.roundId}: ${error instanceof Error ? error.message : "send failed"}`,
    );
    return { sent: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
