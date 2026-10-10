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
  // Reason this DELEGATES rather than reading the row itself: five of the six callers want
  // only the direction, and the sixth - settlement - also needs the eligibility rules added
  // for task 14. Two functions each doing their own `findOne` would be two definitions of
  // "what does this title say", and the defaults would drift apart exactly as this file's
  // own class comment describes happening to the direction itself. The delegation is pinned
  // by a test asserting this function's answer always equals the wider one's, in every case.
  const rules = await resolveScoringRules(gameKey, session);
  return rules.direction;
}

/**
 * Everything about how ONE contest's scores are ranked and which of them get paid.
 *
 * Task document 14. This is the wider read `resolveScoreDirection` above now delegates to,
 * and it exists because eligibility became configurable per title: whether a score of zero
 * counts, and whether there is an extra bar to clear. Those are prize decisions, so they must
 * reach `providerHasResult` - and the only route a game module has to a catalogue fact is the
 * participant, because invariant 2 bans a module from importing a model.
 *
 * ONE READ PER CONTEST, THREADED ONTO EVERY ROW. Not stored per participant, for the reason
 * R32/R33 recorded: a per-row copy lets two rows in one leaderboard disagree, and half a board
 * negating while the other half does not is incoherent rather than merely wrong. A uniformly
 * wrong direction is at least visibly wrong and can be explained; an incoherent one cannot.
 *
 * EVERY DEFAULT HERE FAILS TOWARDS THE PLATFORM RULE, NOT TOWARDS PAYING. A missing title, an
 * absent `gameKey` or an unrecognised value all yield "upward, zero is not a result, no extra
 * bar" - which is precisely what the code did before any of this was configurable, so a
 * catalogue row that has been deleted or was never synced cannot turn a refusal into a payment.
 * That direction matters more than it looks: the opposite default would mean an operator
 * deleting a title retroactively makes every zero-scoring entrant of a live contest a winner.
 */
export interface ContestScoringRules {
  direction: ScoreDirection;
  /** Absent on the title reads as `false` - see `providerHasResult`. */
  zeroIsValidResult: boolean;
  /** `undefined` means no bar. A stored `0` is a real and different instruction. */
  minimumEligibleScore?: number;
}

const PLATFORM_DEFAULT_RULES: ContestScoringRules = {
  direction: "higher_is_better",
  zeroIsValidResult: false,
  minimumEligibleScore: undefined,
};

export async function resolveScoringRules(
  gameKey: string | undefined,
  session?: ClientSession,
): Promise<ContestScoringRules> {
  // Reason this is a real case and not defensive noise: `gameKey` is optional on the contest
  // document. An absent label cannot resolve a title, so there is nothing to read and the
  // safe upward default applies.
  if (!gameKey) {
    console.warn(
      "⚠️ Provider contest has no gameKey; ranking its scores as higher-is-better.",
    );
    return PLATFORM_DEFAULT_RULES;
  }

  const query = ProviderGame.findOne({ gameKey }).select(
    "scoreDirection zeroIsValidResult minimumEligibleScore",
  );
  if (session) query.session(session);

  const title = await query.lean<{
    scoreDirection?: string;
    zeroIsValidResult?: boolean;
    minimumEligibleScore?: number;
  } | null>();

  if (!title) {
    // Not fatal: the contest's own scores are still rankable, and refusing here would strand a
    // settleable contest because a catalogue row was removed. Loud, because a missing title
    // means `gameKey` no longer resolves and that affects more than this sort.
    console.warn(
      `⚠️ No catalogue entry for "${gameKey}"; ranking its scores as higher-is-better.`,
    );
    return PLATFORM_DEFAULT_RULES;
  }

  return {
    direction:
      title.scoreDirection === "lower_is_better"
        ? "lower_is_better"
        : "higher_is_better",
    // Reason: `=== true` rather than a truthiness check or a `??`. The field is read from a
    // `.lean()` document, so it arrives as whatever is stored - and a schema default is not
    // applied on a lean read (defaults are a hydration step). Anything other than a real
    // stored `true` therefore has to mean the platform rule, or a pre-migration row would
    // read as `undefined` and a `??` chain would still have to name the same fallback twice.
    zeroIsValidResult: title.zeroIsValidResult === true,
    // Reason: `Number.isFinite`, so a stored `null` from an old row - or a `NaN` from a bad
    // edit - reads as "no bar" rather than as a comparison that is false for every score.
    // An unguarded `NaN` here refuses EVERY participant and pays the whole pot to the
    // unclaimed pool, with no error and nothing in a log.
    minimumEligibleScore: Number.isFinite(title.minimumEligibleScore)
      ? title.minimumEligibleScore
      : undefined,
  };
}
