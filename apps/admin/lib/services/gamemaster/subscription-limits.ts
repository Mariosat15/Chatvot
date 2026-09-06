/**
 * Copying a Game Master package's configuration onto a subscription's cached limits.
 *
 * WHY THIS IS ONE FUNCTION AND NOT AN INLINE OBJECT IN FIVE ROUTES
 * ----------------------------------------------------------------
 * There were five writers of `GameMasterSubscription.limits` - the purchase route twice
 * (upgrade and first purchase), the admin fix-purchases repair route, activate, and renew -
 * and three carried a byte-identical copy of the same defect: `config.referralFeePercentage
 * || 5`, which stores 5% for a package deliberately configured at 0%.
 *
 * That is the shape Stage 0 spent a phase on: one bug duplicated is not drift, no mirror
 * guard catches it, and fixing the copy somebody happens to be reading leaves the others.
 * So the shape gets one writer and a test that pins it.
 *
 * WHY THESE LIMITS ARE CACHED AT ALL, since a cache is what allows the two to disagree: a
 * package can be deleted while a Game Master is still subscribed to it, and settlement has
 * to be able to pay them something. Both money paths read the CURRENT package first and
 * treat this copy as the fallback.
 */

export interface GameMasterPackageConfig {
  maxCompetitionsPerDay?: number;
  maxUsersPerCompetition?: number;
  referralFeePercentage?: number;
  canCreateCompetitions?: boolean;
  canEarnFromChallenges?: boolean;
  challengeReferralFeePercentage?: number;
}

export interface GameMasterSubscriptionLimits {
  maxCompetitionsPerDay: number;
  maxUsersPerCompetition: number;
  referralFeePercentage: number;
  canCreateCompetitions: boolean;
  canEarnFromChallenges: boolean;
  challengeReferralFeePercentage?: number;
}

export const DEFAULT_GM_LIMITS = {
  maxCompetitionsPerDay: 1,
  maxUsersPerCompetition: 50,
  referralFeePercentage: 5,
} as const;

/**
 * A stored number, or the default when the package genuinely declares none.
 *
 * Reason it is not `??` alone: `??` would let `NaN` through, and these values arrive from
 * `parseFloat` on an admin form. `NaN` stored on a required Number path is a percentage that
 * poisons every multiplication it reaches, silently, because `NaN * anything` is `NaN` and
 * nothing here checks. Reason it is not `||` either: that is the whole defect - 0 is a
 * configuration, not an absence.
 */
function numberOrDefault(
  value: number | undefined | null,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function buildSubscriptionLimits(
  config: GameMasterPackageConfig | null | undefined,
): GameMasterSubscriptionLimits {
  const c = config ?? {};

  return {
    maxCompetitionsPerDay: numberOrDefault(
      c.maxCompetitionsPerDay,
      DEFAULT_GM_LIMITS.maxCompetitionsPerDay,
    ),
    maxUsersPerCompetition: numberOrDefault(
      c.maxUsersPerCompetition,
      DEFAULT_GM_LIMITS.maxUsersPerCompetition,
    ),
    referralFeePercentage: numberOrDefault(
      c.referralFeePercentage,
      DEFAULT_GM_LIMITS.referralFeePercentage,
    ),
    // Reason for `!== false` rather than a truthy check: absent means allowed on this flag,
    // which is the package default. Only an explicit `false` withdraws it.
    canCreateCompetitions: c.canCreateCompetitions !== false,
    // And the opposite default here, deliberately: earning from challenges is opt-in, so
    // only an explicit `true` grants it. The asymmetry matches the schema.
    canEarnFromChallenges: c.canEarnFromChallenges === true,
    // Left undefined when the package declares none, NOT defaulted to the competition rate.
    // Both money paths already fall back to `referralFeePercentage` when this is absent, so
    // filling it in here would freeze today's competition rate into the challenge rate and
    // stop it following the package when an admin changes it.
    ...(typeof c.challengeReferralFeePercentage === "number" &&
    Number.isFinite(c.challengeReferralFeePercentage)
      ? { challengeReferralFeePercentage: c.challengeReferralFeePercentage }
      : {}),
  };
}
