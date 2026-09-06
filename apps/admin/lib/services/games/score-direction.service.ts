import type { ClientSession } from "mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import type { ScoreDirection } from "@/lib/games/types";

/**
 * Which way a contest's scores rank, read once from the catalogue title.
 *
 * WHY THIS IS A SHARED MODULE RATHER THAN A HELPER INSIDE SETTLEMENT, which is where it
 * started: because settlement is not the only thing that ranks. The player leaderboard ranks
 * a live contest on every page load, and it was reading no direction at all - so a
 * lower-is-better game showed the *worst* player in first place for the whole duration of the
 * contest, and then settlement paid the right person. The two disagreeing is worse than either
 * being wrong alone: a player who watched themselves lead for a week is being told the
 * leaderboard they were shown was decorative.
 *
 * That is the fifth "one rule, two copies" defect on this codebase, after `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||`, and `check:mirrors` can see none of
 * them because it compares models. The rule: when a second caller needs a decision, move the
 * decision - do not copy it, and do not reach into the first caller's private helper.
 *
 * IT DEFAULTS TO HIGHER-IS-BETTER RATHER THAN REFUSING, and the reasoning is the fail-closed
 * instinct applied to sort order: the safe answer is the one that cannot REVERSE a result. An
 * unrecognised direction that refused would strand a settleable contest because a catalogue row
 * was edited; one that inverted would pay the slowest player first. Upward is also the
 * direction trading and every points game uses.
 *
 * The narrowing at the end is deliberate rather than a cast, but be accurate about what it
 * buys: it satisfies the return type without lying, and it documents that only one known
 * string means downward. It is NOT what stops an unrecognised value inverting a board -
 * `getProviderRankingValue` tests equality against `"lower_is_better"` as well, so anything
 * else already sorts upward there. Probing this was what established the distinction: replacing
 * the narrowing with a cast left the suite green. Both sites are worth keeping, since an "is
 * upward" check written with the opposite inequality would silently be wrong, but a comment
 * claiming this line is the guard would be a wrong fact.
 */
export async function resolveScoreDirection(
  gameKey: string | undefined,
  /**
   * Present when the caller holds a transaction, absent on a read path.
   *
   * Reason it is optional rather than two functions: settlement MUST read inside its session
   * or it can see a catalogue row the transaction has not committed, while the leaderboard has
   * no session to offer. One function with an optional session keeps a single definition of
   * the rule, which is the entire purpose of the file.
   */
  session?: ClientSession,
): Promise<ScoreDirection> {
  // Reason this is a real case and not defensive noise: `gameKey` is optional on the contest
  // document. An absent label cannot resolve a title, so there is nothing to read and the
  // safe upward default applies.
  if (!gameKey) {
    console.warn(
      "⚠️ Provider contest has no gameKey; ranking its scores as higher-is-better.",
    );
    return "higher_is_better";
  }

  const query = ProviderGame.findOne({ gameKey }).select("scoreDirection");
  if (session) query.session(session);

  const title = await query.lean<{ scoreDirection?: string } | null>();

  if (!title) {
    // Not fatal: the contest's own scores are still rankable, and refusing here would strand a
    // settleable contest because a catalogue row was removed. Loud, because a missing title
    // means `gameKey` no longer resolves and that affects more than this sort.
    console.warn(
      `⚠️ No catalogue entry for "${gameKey}"; ranking its scores as higher-is-better.`,
    );
    return "higher_is_better";
  }

  return title.scoreDirection === "lower_is_better"
    ? "lower_is_better"
    : "higher_is_better";
}
