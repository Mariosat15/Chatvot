/**
 * ONE reward stage for every contest that finishes, whatever the game and whichever app
 * settled it. Risk R94.
 *
 * Why this exists rather than the eight copies it replaces. Both apps register
 * `checkAndFinalizeCompetitions` on an every-minute cron, so which app settles a given
 * contest is a race - and the two apps disagreed about what a finish is worth:
 *
 *   | path                          | activity XP | badges |
 *   | main competition finalizer    | yes         | yes    |
 *   | admin competition finalizer   | NO          | yes    |
 *   | main challenge finalizer      | yes         | yes    |
 *   | admin challenge finalizer     | NO          | yes    |
 *   | provider competition          | NO          | NO     |
 *   | provider challenge            | NO          | NO     |
 *
 * So a trading player's XP for finishing depended on which cron got there first, with no
 * flag, no error and no log line on either branch; and a provider player earned nothing at
 * all, for ever. The first is live and has already happened. The second is latent only
 * because no provider contest has settled in production.
 *
 * Three rules this stage holds, each of which one of the old copies broke:
 *
 * - It is GAME-AGNOSTIC. It reads a finishing position and a game label, never a P&L, a
 *   trade count or a capital figure, so nothing here has to learn about the next game. The
 *   rank is passed IN, already resolved by whichever module ranked the contest, because the
 *   score direction is settled once in `calculateRankings` and a second reader of it is how
 *   a lower-is-better game pays the slowest player first (R37).
 *
 * - It NEVER throws into its caller. Every call site runs after the money transaction has
 *   committed, so a badge-service failure must not produce a refusal the caller reports as a
 *   failed settlement - the prizes are already paid.
 *
 * - It is called AFTER the commit, never inside the transaction. XP and badges are not part
 *   of the payout, and holding a transaction open across them lengthens the window on the
 *   optimistic lock for no gain.
 *
 * What it deliberately does NOT do. It does not decide how much a finish is worth - the
 * amounts live in `xp-level.service.ts` and are the subject of the cross-game rebalance,
 * which is a behaviour change and therefore a separate commit. An extraction's whole claim
 * is that nothing moved, and the six green call sites are the only evidence of it.
 */

import { TRADING_GAME_TYPE } from "@/lib/games/types";

/** Which of the two paid formats finished. Competitions and challenges pay different XP. */
export type ContestRewardKind = "competition" | "challenge";

export interface ContestRewardParticipant {
  userId: string;
  /**
   * 1-based finishing position, or absent when the player holds no place.
   *
   * Absent is a real state and not a missing value: a tied challenge has no winner, and a
   * player excluded by the eligibility gate (R45) or refunded for never scoring (R50) is
   * not in the ranking. Such a player still earns completion XP - they entered and the
   * contest ran - but no podium bonus. Defaulting an absent rank to a number is how a
   * non-scorer is paid a first place.
   */
  rank?: number;
}

export interface ContestRewardsInput {
  kind: ContestRewardKind;
  /** For the log line and the XP ledger's attribution only. */
  contestId: string;
  /**
   * The contest's immutable `gameKey`. Absent is resolved to trading, matching invariant 5,
   * because an unlabelled contest predates X1 and is a trading one.
   */
  gameKey?: string;
  participants: ContestRewardParticipant[];
}

export interface ContestRewardsResult {
  /** Distinct players who were awarded something. */
  playersRewarded: number;
  /** Podium bonuses handed out - 0 on a tie, and 0 when nobody placed. */
  podiumAwards: number;
}

/** Podium XP exists for the top three only. A fourth place is a completion, not a placing. */
const PODIUM_EVENTS = {
  1: "competition_podium_1",
  2: "competition_podium_2",
  3: "competition_podium_3",
} as const;

const MAX_PODIUM_RANK = 3;

export async function awardContestRewards(
  input: ContestRewardsInput,
): Promise<ContestRewardsResult> {
  const { kind, contestId, participants } = input;
  const gameKey = input.gameKey || TRADING_GAME_TYPE;

  // Reason: one row per player. A duplicate userId would award the same finish twice, and
  // the competition path can legitimately hand over a leaderboard and a participant list
  // that overlap. Keeping the BEST rank, because a Map keyed on userId would otherwise let
  // an unranked duplicate erase a podium place depending purely on iteration order.
  const bestByUser = new Map<string, number | undefined>();
  for (const p of participants) {
    if (!p?.userId) continue;
    const existing = bestByUser.get(p.userId);
    if (!bestByUser.has(p.userId)) {
      bestByUser.set(p.userId, p.rank);
      continue;
    }
    if (typeof p.rank === "number" && (existing === undefined || p.rank < existing)) {
      bestByUser.set(p.userId, p.rank);
    }
  }

  if (bestByUser.size === 0) {
    return { playersRewarded: 0, podiumAwards: 0 };
  }

  let podiumAwards = 0;

  try {
    const { awardActivityXP } = await import("@/lib/services/xp-level.service");
    const { evaluateUserBadges } = await import(
      "@/lib/services/badge-evaluation.service"
    );

    for (const [userId, rank] of bestByUser) {
      // Completion XP: everybody who took part, placed or not.
      const completionEvent =
        kind === "challenge" ? "challenge_completed" : "competition_completed";
      awardActivityXP(userId, completionEvent, gameKey).catch(() => {});

      if (typeof rank === "number" && rank >= 1) {
        if (kind === "challenge") {
          // A challenge has one winner and no podium. Rank 1 is the winner; a tie gives
          // neither player a rank, so neither gets the bonus.
          if (rank === 1) {
            awardActivityXP(userId, "challenge_won", gameKey).catch(() => {});
            podiumAwards += 1;
          }
        } else if (rank <= MAX_PODIUM_RANK) {
          const event = PODIUM_EVENTS[rank as 1 | 2 | 3];
          awardActivityXP(userId, event, gameKey).catch(() => {});
          podiumAwards += 1;
        }
      }

      // Evaluate every badge category, not a game-specific subset: a badge's conditions are
      // the badge's business, and filtering by game here would be this layer deciding what a
      // game can be rewarded for.
      evaluateUserBadges(userId).catch(() => {});
    }
  } catch (error) {
    // Reason: the caller has already committed and paid. A failure to load either service
    // must be visible in the log and invisible to the settlement result, or an operator sees
    // a paid contest reported as a failed one and finalizes it again.
    console.error(
      `❌ [CONTEST REWARDS] ${kind} ${contestId}: could not award XP or badges:`,
      error,
    );
    return { playersRewarded: 0, podiumAwards: 0 };
  }

  console.log(
    `🏅 [CONTEST REWARDS] ${kind} ${contestId} (${gameKey}): ${bestByUser.size} player(s), ${podiumAwards} placing bonus(es)`,
  );

  return { playersRewarded: bestByUser.size, podiumAwards };
}
