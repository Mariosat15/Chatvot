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
  allowedGameTypes?: string[];
}

export interface GameMasterSubscriptionLimits {
  maxCompetitionsPerDay: number;
  maxUsersPerCompetition: number;
  referralFeePercentage: number;
  canCreateCompetitions: boolean;
  canEarnFromChallenges: boolean;
  challengeReferralFeePercentage?: number;
  allowedGameTypes: readonly string[];
}

export const DEFAULT_GM_LIMITS = {
  maxCompetitionsPerDay: 1,
  maxUsersPerCompetition: 50,
  referralFeePercentage: 5,
} as const;

/**
 * The game types a Game Master may create when nothing says otherwise.
 *
 * Chapter 19 section 5: a Game Master's share is a percentage of the entry fee taken BEFORE
 * provider cost exists, and the existing cap is against the GROSS platform fee - so a
 * low-fee provider contest can be net loss-making while still paying out. Trading has no
 * per-round cost and never had this problem. Provider games are therefore withheld from
 * *creation* until the share is computed on net platform fee.
 *
 * Note what this does NOT withhold: a Game Master still EARNS from a provider contest their
 * referred players enter, because earning follows referred players rather than created
 * contests. Only creation is gated, deliberately.
 *
 * It lives here beside the other limit defaults, and `game-permissions.ts` re-exports it, so
 * that the read gate and this write path cannot end up with two copies of the value - the
 * rule the X1 backfill recorded. The dependency runs gate -> limits and never back.
 */
export const DEFAULT_ALLOWED_GAME_TYPES: readonly string[] = ["trading"];

/**
 * The stored allow-list, or trading.
 *
 * THE DEFAULT IS APPLIED HERE, IN CODE, AND NOT BY THE SCHEMA - and that is the whole point
 * of the function. Three separate reasons, any one of which is sufficient:
 *
 *   - A Mongoose default fills a value when it HYDRATES, so it does nothing for the
 *     documents that already exist. Every Game Master subscription in the database predates
 *     this field and has no `allowedGameTypes` key at all.
 *   - Both creation routes read `gamemastersubscriptions` with the raw MongoDB driver, which
 *     never hydrates, so a schema default would not apply even to a document written today.
 *   - "Missing" has three shapes here and only one is obvious: absent, `null`, and `[]`. An
 *     empty array is what an admin form posting no selection produces, and read as "no
 *     restriction" it would silently permit everything - the opposite of the safe answer.
 *
 * FAILS CLOSED. Anything that is not a non-empty array of non-empty strings resolves to
 * trading rather than to "unrestricted", because the two mistakes are not symmetric: wrongly
 * refusing a provider contest is visible and someone complains, while wrongly permitting one
 * costs the platform money on every entry and nothing reports it.
 */
export function resolveAllowedGameTypes(stored: unknown): readonly string[] {
  if (!Array.isArray(stored)) return DEFAULT_ALLOWED_GAME_TYPES;

  const cleaned = stored
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return cleaned.length > 0 ? cleaned : DEFAULT_ALLOWED_GAME_TYPES;
}

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
    // Which games this tier may CREATE contests for, cached like everything else here.
    //
    // Resolved through the SAME function the creation gate reads (`game-permissions.ts`)
    // rather than with a local `?? ["trading"]`, and that is the rule the X1 backfill
    // recorded: never let a second writer carry its own copy of a constant. With a literal
    // here, changing the platform default would leave every subscription written before the
    // change holding a value nothing else uses - and every one of them would look correctly
    // configured. A test asserts the two agree.
    allowedGameTypes: resolveAllowedGameTypes(c.allowedGameTypes),
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
