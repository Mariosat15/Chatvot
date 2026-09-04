import type { RankableParticipant } from "../types";

/**
 * Ranking for a contest played through an external provider.
 *
 * PURE, AND IT MUST STAY PURE. Invariant 2 - enforced by ESLint - bans anything in a game
 * module folder from importing a model or the database connection. Everything this needs
 * arrives on the participant; the engine does the reading.
 *
 * IT IGNORES `rankingMethod` ENTIRELY, and that is the design rather than a shortcut.
 * Trading's six methods (pnl, roi, win rate and so on) are six different questions you can
 * ask of a trading account. A provider game reports one number. Offering an operator a
 * choice of ranking method on a provider contest would be offering six labels for one
 * behaviour - the setting would appear to work and change nothing, which is worse than not
 * offering it.
 */

/**
 * The value the engine sorts on, descending, higher being better.
 *
 * The negation is the whole trick. The engine performs exactly one sort, descending, for
 * every game. A time trial where 92 seconds beats 105 is expressed by returning -92 and
 * -105, which sorts correctly through that same descending pass. No branch is added to the
 * engine, and no game gets to reach in and change how sorting works.
 */
export function getProviderRankingValue(
  participant: RankableParticipant,
): number {
  // Reason: a player whose result never arrived has no score, and the unresolved-round
  // policy has already decided what that means (scored zero, excluded, or settlement held).
  // By the time ranking runs, an absent score is a genuine zero rather than an error.
  const score = participant.score ?? 0;

  return participant.scoreDirection === "lower_is_better" ? -score : score;
}

/**
 * Provider games declare no tie-breaks.
 *
 * Returning a constant makes every tie a genuine tie, which the engine already handles:
 * tied players share the combined prize for the ranks they occupy, under the contest's
 * `tiePrizeDistribution`. That is the correct outcome for two players who scored
 * identically at the same game.
 *
 * The alternative - breaking ties on join time - was rejected. It looks like a tidy
 * deterministic ordering and it is actually a rule that the first to register wins money,
 * which nothing tells the player and which rewards refreshing the lobby.
 */
export function getProviderTieBreakerValue(): number {
  return 0;
}
