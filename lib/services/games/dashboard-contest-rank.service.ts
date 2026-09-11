/* eslint-disable @typescript-eslint/no-explicit-any */
// Reason for a rule-scoped disable rather than typing the rows, and for NOT copying the
// blanket `/* eslint-disable */` the dashboard action carries: the comparator below was moved
// here character for character, and the existing structural guards staying green is the only
// evidence that no rank moved. Narrowing `any` to `DashboardRankableParticipant` is a change
// to the moved code - safe, but it must not travel in the commit whose whole claim is that
// nothing changed. It is also not free: `getDashboardRankingValue` is called for CHALLENGE
// participants as well, which are a different model with the same field names, so typing it
// needs both call sites looked at. Recorded as a follow-up, scoped to one rule so nothing
// else in this file goes unchecked.
import { hasProviderGameLabel } from "@/lib/services/games/contest-config";
import { resolveScoreDirection } from "@/lib/services/games/score-direction.service";
import { getGameModuleOrTrading } from "@/lib/games";

/**
 * The rank a contest card shows, computed the same way for every caller.
 *
 * WHY THIS IS A MODULE AND NOT TEN LINES INSIDE THE DASHBOARD ACTION. The stored
 * `participant.currentRank` is written by finalization and by a periodic job, so on a running
 * contest it is stale or zero. Every screen that wants a live rank therefore sorts the
 * participants itself - and the moment a SECOND caller does that, the two can disagree. That
 * matters here more than it looks: the dashboard card and the endpoint that refreshes it are
 * two callers of one question, so a second copy does not merely risk drifting one day, it
 * shows the player one rank on page load and a different one fifteen seconds later, with no
 * error and nothing in a log. A rank that visibly changes without the standings changing is
 * indistinguishable, from the player's seat, from the platform being wrong about who is winning.
 *
 * This is the "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId`
 * and the Game Master `|| 5`, none of which `check:mirrors` can see, because it compares
 * models. There is no guard that would catch a second ranking copy either, which is why the
 * test suite asserts the comparator appears in this file and in no consumer.
 *
 * MOVED VERBATIM from `lib/actions/comprehensive-dashboard.actions.ts` on 11 September 2026.
 * Nothing about the arithmetic changed, deliberately: the existing structural guards staying
 * green is the only evidence that no rank moved, and that is only evidence if nothing else
 * changed in the same commit.
 */

/**
 * A participant row as the dashboard reads it.
 *
 * Hand-written rather than imported from the model because the two bulk reads that feed this
 * select different subsets, and both are legitimate. The cost of a hand-written shape is that
 * the compiler has nothing to disagree with, so a field name invented here would compile and
 * silently read `undefined` for ever - the `billsPerRound` trap. Every field below is checked
 * against `competition-participant.model.ts`.
 */
export interface DashboardRankableParticipant {
  userId?: unknown;
  status?: string;
  pnl?: number;
  pnlPercentage?: number;
  currentCapital?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  /** Reason: the provider-game equivalent of `pnl`. Absent means no round has reported yet. */
  score?: number;
}

/** The contest fields ranking needs. A subset of `Competition`, not a new shape. */
export interface DashboardRankableContest {
  status?: string;
  gameType?: string;
  gameKey?: string;
  rules?: { rankingMethod?: string } | null;
}

/**
 * Get ranking value for dashboard sorting — mirrors competition-ranking.service.ts logic
 * Reason: The dashboard needs to compute user rank without importing the full ranking service.
 *
 * DELIBERATELY NOT COLLAPSED INTO THE GAME REGISTRY, and the reason is worth keeping because
 * the collapse looks like an obvious tidy-up. This is a second copy of trading's ranking
 * switch, which is exactly the "one rule, two copies" shape that has produced several
 * defects here. Replacing it with `getGameModuleOrTrading(...).getRankingValue` would remove
 * the duplication and it would ALSO silently break `win_rate` contests: the module reads the
 * stored `participant.winRate`, this computes it from `winningTrades / totalTrades`, and
 * `winRate` is not in the bulk participant select the caller passes in - so every player
 * would rank on zero. Collapsing the two means widening that select first, and the two
 * changes must not travel in one commit or a green suite stops being evidence that no rank
 * moved.
 *
 * The provider branch in `createDashboardRankResolver` does NOT go through here, so a new
 * game inherits the registry's behaviour rather than this copy's.
 */
export function getDashboardRankingValue(p: any, method: string): number {
  switch (method) {
    case "pnl":
      return p.pnl || 0;
    case "roi":
      return p.pnlPercentage || 0;
    case "total_capital":
      return p.currentCapital || 0;
    case "win_rate":
      return p.totalTrades > 0
        ? ((p.winningTrades || 0) / p.totalTrades) * 100
        : 0;
    case "total_wins":
      return p.winningTrades || 0;
    case "profit_factor": {
      const wins = p.winningTrades || 0;
      const losses = p.losingTrades || 0;
      if (losses === 0) return wins > 0 ? 9999 : 0;
      return wins / losses;
    }
    default:
      return p.pnl || 0;
  }
}

export interface ResolveDashboardRankArgs {
  competition: DashboardRankableContest;
  /** Every participant of this contest, including the user. */
  participants: DashboardRankableParticipant[];
  userId: string;
  /**
   * What to report when the rank cannot be computed - an upcoming contest, a contest with no
   * participants loaded, or a user who is not in the list. The caller passes the stored
   * `currentRank`, which is the right answer for a finished contest and the only answer
   * available for one that has not started.
   */
  fallbackRank: number;
}

/**
 * A resolver with a per-request memo of the score direction.
 *
 * A FACTORY RATHER THAN A BARE FUNCTION, and the memo is part of the extracted behaviour
 * rather than an optimisation added on the way. The direction is a property of the catalogue
 * title, so it is read once per game key and reused; resolving it inside the sort comparator
 * would be quadratic in participants, and a comparator must stay synchronous in any case.
 * A caller ranking one contest can use it and throw it away.
 */
export function createDashboardRankResolver() {
  const directionByGameKey = new Map<string, string>();

  async function scoreDirectionFor(gameKey?: string): Promise<string> {
    const key = gameKey || "";
    const cached = directionByGameKey.get(key);
    if (cached) return cached;
    const resolved = await resolveScoreDirection(gameKey);
    directionByGameKey.set(key, resolved);
    return resolved;
  }

  async function resolveRank({
    competition,
    participants,
    userId,
    fallbackRank,
  }: ResolveDashboardRankArgs): Promise<number> {
    const rankingMethod = competition.rules?.rankingMethod || "pnl";
    // Reason: the DISPLAY helper, not the launch helper. `isProviderContest` also demands a
    // provider key and a game code, because a contest missing those cannot launch a round.
    // Ranking is not launching - a keyless provider contest still has scores and no profit
    // and loss - so the strict helper would rank its players on `pnl` and tie every one of
    // them at zero.
    const isProviderGame = hasProviderGameLabel(competition);

    // Reason: participation.currentRank from the database can be stale or 0.
    if (competition.status !== "active" || participants.length === 0) {
      return fallbackRank;
    }

    // Reason: a provider game reports one score and no trades, so BOTH halves of the
    // trading comparator misfire on it. `getDashboardRankingValue` reads `pnl`, which is
    // zero for every provider row, and the has-trades pre-sort is a no-op because nobody
    // has trades - so every comparison returns 0, the sort is a no-op, and the player is
    // shown a confident rank that is really their position in the query's result order.
    // No error, no log line. Same shape as R37, one screen along.
    const direction = isProviderGame
      ? await scoreDirectionFor(competition.gameKey)
      : undefined;
    // Reason: dispatched through the registry rather than by adding a `score` case to
    // `getDashboardRankingValue`, so the direction negation exists in exactly one place
    // (`lib/games/provider/scoring.ts`) and a third game inherits it for free.
    const providerModule = isProviderGame
      ? getGameModuleOrTrading(competition.gameType)
      : undefined;
    const rankingValue = (p: any): number =>
      providerModule
        ? providerModule.getRankingValue(
            { ...p, scoreDirection: direction },
            rankingMethod,
          )
        : getDashboardRankingValue(p, rankingMethod);

    const sorted = [...participants]
      .filter((p: any) => (p.status || "active") !== "disqualified")
      .sort((a: any, b: any) => {
        if (!isProviderGame) {
          const aHasTrades = (a.totalTrades || 0) > 0;
          const bHasTrades = (b.totalTrades || 0) > 0;
          if (aHasTrades && !bHasTrades) return -1;
          if (!aHasTrades && bHasTrades) return 1;
        }
        return rankingValue(b) - rankingValue(a);
      });
    const idx = sorted.findIndex((p: any) => p.userId?.toString() === userId);
    return idx === -1 ? fallbackRank : idx + 1;
  }

  return { resolveRank };
}
