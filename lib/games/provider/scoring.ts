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
  /*
    The `?? 0` places a player with no result LAST in the ordering, which is right - but a
    comment here used to go further and say an absent score "is a genuine zero rather than
    an error", and that sentence was doing real harm. It reads as though nothing else needs
    deciding, and for a whole day it was the only thing standing between a player who never
    launched a round and a prize: last place is still a paid position when the contest has
    three prize ranks and three entrants.

    Ordering and ELIGIBILITY are separate questions, and `hasResult` below answers the
    second. An absent score orders last and wins nothing. THE SENTENCE THAT FOLLOWED USED
    TO SAY a stored zero "orders last and is eligible, because the player attempted the
    game" - that was true of the code and is no longer the rule; see `providerHasResult`.
    The half that survives is the one that matters here: **a stored value and an absent one
    are different facts**, and this function still orders them identically.
  */
  const score = participant.score ?? 0;

  return participant.scoreDirection === "lower_is_better" ? -score : score;
}

/**
 * A provider participant is eligible for a prize only once they have scored ABOVE ZERO.
 *
 * OWNER DECISION, 9 SEPTEMBER 2026 (task document 2 and 4, which says "score > 0" in
 * terms). This reverses the rule this function shipped with, and the reasoning it
 * reversed is left below rather than deleted, because it is a real argument and the next
 * reader deserves to see that it was considered rather than overlooked.
 *
 * THE ARGUMENT AGAINST, WHICH LOST: a stored zero and an absent score are different
 * facts. A player who launched a round, played it and scored nothing has attempted the
 * game, and refusing them is the same shape as `canEnterChallenges` treating an absent
 * value as a stored `false`. THE ARGUMENT THAT WON: the observed case was a three-player
 * contest with three prize ranks, where a zero simply sat in third place and was paid -
 * so the rule was not distinguishing "attempted and failed" from "took the seat", it was
 * paying anybody who turned up. A prize is for a result, and zero is the absence of one.
 *
 * `> 0` IS APPLIED IN BOTH SCORE DIRECTIONS AND MUST NOT BE MADE DIRECTIONAL. It reads as
 * though a `lower_is_better` game should treat zero as the best possible score, and for
 * the catalogue as it stands that is wrong twice over: the only lower-is-better title
 * measures `duration_ms`, where zero milliseconds is not a fast round but an unrecorded
 * one. A test pins the rule as direction-independent so nobody "improves" it into a
 * branch.
 *
 * THE ONE FUTURE TITLE THIS WOULD BE WRONG FOR, named so it is noticed rather than
 * discovered: an `integer` + `lower_is_better` game scoring mistakes or penalties, where
 * zero is a flawless round. No such title exists, and the fix then is a declared
 * capability on the catalogue row - never a guess made here from `scoreType`.
 *
 * `Number.isFinite` is still first, because a `NaN` would otherwise pass `> 0`'s inverse
 * in some rewrites and, more importantly, ranks as a silent last place: `NaN` fails every
 * comparison in the sort, so it lands wherever the sort happens to leave it, which is not
 * a position anybody chose.
 *
 * Note what this does NOT do: it does not decide what an unreported round means. That is the
 * contest's `unresolvedRoundPolicy` - score zero, exclude and refund, or hold for a human -
 * and under `exclude` the player has already been removed from the list before ranking runs.
 * This is the residual case: the contest settled, and this player has no number.
 */
export function providerHasResult(participant: RankableParticipant): boolean {
  return Number.isFinite(participant.score) && (participant.score as number) > 0;
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
