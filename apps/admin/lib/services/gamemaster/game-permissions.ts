/**
 * What a Game Master is allowed to create, resolved from four sources of truth.
 *
 * WHY THIS EXISTS AS ONE MODULE
 * -----------------------------
 * There are two Game Master competition creation routes - `app/api/gamemaster/competitions`
 * and `apps/admin/app/api/gamemaster/competitions` - and before this module they disagreed
 * about every question below. The main route read the CURRENT package and refused a Game
 * Master whose package forbids creation; the admin route read the cached `subscription.limits`
 * and never checked `canCreateCompetitions` at all. Both are reachable by the same person:
 * a Game Master signs into the admin app with their ordinary credentials at
 * `/api/gamemaster-auth/login` and gets a `gm_token`. So the main route's stated protection -
 * "this ensures if admin changes the package, the GM cannot bypass restrictions" - was true
 * of that file and false of the platform.
 *
 * That is the fifth "one rule, two copies" finding in this codebase after `referenceId`,
 * `failedReason`, `challengeId` and the Game Master fee `||`. None of them is visible to
 * `npm run check:mirrors`, which compares models. So the rule gets ONE implementation and a
 * test that runs both routes' inputs through it.
 *
 * WHY IT IS MODEL-FREE
 * --------------------
 * Both routes read `gamemastersubscriptions` with the raw MongoDB driver, so there is no
 * hydrated document to hang a method on - which is also why the `canCreateCompetitions`
 * VIRTUAL on `gamemaster-subscription.model.ts` has never run in production. It reads
 * `competitionCreationOverride` correctly and no code path has ever invoked it. Taking plain
 * data in and returning a verdict is what lets the raw-driver callers use the same rule, and
 * it keeps this importable from a client component if the creation UI ever needs to grey a
 * control out.
 *
 * MIRRORED into `apps/admin/lib/services/gamemaster/`. `check:mirrors` compares models, not
 * services, so the two copies must be edited together by hand.
 */

import { resolveGameType } from "@/lib/games/registry";
import type { GameType } from "@/lib/games/types";
import {
  DEFAULT_ALLOWED_GAME_TYPES,
  DEFAULT_GM_LIMITS,
  resolveAllowedGameTypes,
} from "./subscription-limits";

// Re-exported so a caller needs one import path for the gate, while the VALUE has a single
// definition beside the other limit defaults. The dependency runs this way only; making
// `subscription-limits.ts` import from here instead would be circular.
export { DEFAULT_ALLOWED_GAME_TYPES, resolveAllowedGameTypes };

/** Why a creation request was refused. The route maps these to status codes and copy. */
export type CreationRefusalReason =
  | "no_subscription"
  | "subscription_expired"
  | "creation_not_permitted"
  | "game_not_permitted"
  | "game_not_supported_here"
  | "daily_limit_reached";

export interface GameMasterCreationLimits {
  maxCompetitionsPerDay: number;
  maxUsersPerCompetition: number;
  referralFeePercentage: number;
  canCreateCompetitions: boolean;
  allowedGameTypes: readonly string[];
  /**
   * Which source decided `canCreateCompetitions`, for the log line and the refusal copy.
   *
   * Reason it is reported rather than inferred: "your package does not allow competition
   * creation" is wrong and unactionable when the real cause is an administrator's explicit
   * per-Game-Master deny, and it sends the Game Master to buy an upgrade that will not help.
   */
  creationDecidedBy: "admin_override" | "current_package" | "cached_limits" | "default";
}

/** The shape of the `limits` subdocument as it is STORED, i.e. every field optional. */
export interface StoredGameMasterLimits {
  maxCompetitionsPerDay?: number | null;
  maxUsersPerCompetition?: number | null;
  referralFeePercentage?: number | null;
  canCreateCompetitions?: boolean | null;
  canEarnFromChallenges?: boolean | null;
  challengeReferralFeePercentage?: number | null;
  allowedGameTypes?: unknown;
}

/** The `gameMasterConfig` on a marketplace package, as stored. */
export interface StoredPackageConfig {
  maxCompetitionsPerDay?: number | null;
  maxUsersPerCompetition?: number | null;
  referralFeePercentage?: number | null;
  canCreateCompetitions?: boolean | null;
  allowedGameTypes?: unknown;
}

export interface ResolveCreationLimitsInput {
  /** `subscription.limits` as read from the database. */
  limits?: StoredGameMasterLimits | null;
  /** The CURRENT package's `gameMasterConfig`, or null when the package is gone. */
  packageConfig?: StoredPackageConfig | null;
  /** `subscription.competitionCreationOverride`. */
  override?: "enabled" | "disabled" | null;
  /** `subscription.overrideLimits`, which apply only while the override is `enabled`. */
  overrideLimits?: {
    maxCompetitionsPerDay?: number | null;
    maxUsersPerCompetition?: number | null;
  } | null;
}

/**
 * A stored number, or the fallback when there genuinely is none.
 *
 * Same reasoning as `numberOrDefault` in `subscription-limits.ts`, and deliberately not
 * imported from it: that one is private to the write path. `||` is wrong because 0 is a
 * configuration; `??` alone is wrong because these values arrive from `parseFloat` on an
 * admin form and `NaN` on a required Number path poisons every multiplication downstream.
 */
function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Collapse the four sources into the limits that actually apply.
 *
 * PRECEDENCE, and each step is load-bearing:
 *
 *   1. An administrator's explicit `competitionCreationOverride` wins outright. It is the
 *      only per-Game-Master control; everything else is per-tier, so without it the only
 *      way to stop one Game Master creating competitions is to change the package for
 *      everybody on that tier or suspend the subscription - which also stops their earnings.
 *   2. The CURRENT package, when it still exists. The cached copy is what a Game Master
 *      bought; the package is what the operator currently offers, and reading the cache
 *      first is how a tightened tier gets bypassed by everyone already subscribed.
 *   3. The cached `subscription.limits`, because a package can be DELETED while somebody is
 *      still subscribed to it - which is the reason the cache exists at all
 *      (`subscription-limits.ts`).
 *   4. The module defaults.
 *
 * THE OVERRIDE DELIBERATELY DOES NOT WIDEN `allowedGameTypes`. It is a control over
 * competition creation *rights*, and letting it also grant provider games would route around
 * chapter 19 section 5's economic constraint through a switch labelled something else - an
 * operator enabling creation for one Game Master has not decided anything about provider
 * pricing. Granting a game type is an explicit edit to `allowedGameTypes`.
 */
export function resolveCreationLimits(
  input: ResolveCreationLimitsInput,
): GameMasterCreationLimits {
  const limits = input.limits ?? {};
  const pkg = input.packageConfig ?? null;
  const overrideActive = input.override === "enabled";
  const overrides = overrideActive ? input.overrideLimits ?? {} : {};

  // Reason `!== false` rather than a truthy check, on both the package and the cache: absent
  // means allowed on this flag, matching the schema default and `buildSubscriptionLimits`.
  // Only an explicit `false` withdraws it.
  let canCreateCompetitions: boolean;
  let creationDecidedBy: GameMasterCreationLimits["creationDecidedBy"];

  if (input.override === "enabled") {
    canCreateCompetitions = true;
    creationDecidedBy = "admin_override";
  } else if (input.override === "disabled") {
    canCreateCompetitions = false;
    creationDecidedBy = "admin_override";
  } else if (pkg && typeof pkg.canCreateCompetitions === "boolean") {
    canCreateCompetitions = pkg.canCreateCompetitions;
    creationDecidedBy = "current_package";
  } else if (typeof limits.canCreateCompetitions === "boolean") {
    canCreateCompetitions = limits.canCreateCompetitions;
    creationDecidedBy = "cached_limits";
  } else {
    canCreateCompetitions = true;
    creationDecidedBy = "default";
  }

  // Reason the two caps are resolved by two explicit calls rather than one helper
  // parameterised on the field name: indexing three objects by a variable key is an object
  // injection sink, and while the key here is one of two literals rather than caller input,
  // "safe because of where the value came from" is exactly the reasoning that made
  // `ACTIONS["__proto__"]` reachable on the round inspector. Two call sites cost nothing.
  const cap = (
    fromOverride: number | null | undefined,
    fromPackage: number | null | undefined,
    fromCache: number | null | undefined,
    fallback: number,
  ): number => {
    if (typeof fromOverride === "number" && Number.isFinite(fromOverride)) {
      return fromOverride;
    }
    return pkg ? finiteOr(fromPackage, fallback) : finiteOr(fromCache, fallback);
  };

  return {
    maxCompetitionsPerDay: cap(
      overrides.maxCompetitionsPerDay,
      pkg?.maxCompetitionsPerDay,
      limits.maxCompetitionsPerDay,
      DEFAULT_GM_LIMITS.maxCompetitionsPerDay,
    ),
    maxUsersPerCompetition: cap(
      overrides.maxUsersPerCompetition,
      pkg?.maxUsersPerCompetition,
      limits.maxUsersPerCompetition,
      DEFAULT_GM_LIMITS.maxUsersPerCompetition,
    ),
    referralFeePercentage: pkg
      ? finiteOr(pkg.referralFeePercentage, DEFAULT_GM_LIMITS.referralFeePercentage)
      : finiteOr(limits.referralFeePercentage, DEFAULT_GM_LIMITS.referralFeePercentage),
    canCreateCompetitions,
    allowedGameTypes: resolveAllowedGameTypes(
      pkg && Array.isArray(pkg.allowedGameTypes)
        ? pkg.allowedGameTypes
        : limits.allowedGameTypes,
    ),
    creationDecidedBy,
  };
}

export interface CreationVerdict {
  ok: boolean;
  reason?: CreationRefusalReason;
  /** Operator- and Game-Master-facing copy. Never contains an internal identifier alone. */
  message?: string;
  /**
   * The game type the contest will be LABELLED with, resolved once.
   *
   * Returned rather than left to the caller so the gate and the label cannot disagree. A
   * capability gate must never take its deciding value from caller input by one path while
   * the stored label comes from another - that is a way to be admitted as trading and
   * written as something else, or the reverse.
   */
  gameType: GameType;
}

export interface CheckCreationInput {
  limits: GameMasterCreationLimits;
  /** The game type the caller asked for. Absent means trading (invariant 5). */
  requestedGameType?: string | null;
  /** `subscription.currentPeriodCompetitionsCreated` after any daily reset. */
  competitionsCreatedToday: number;
}

/**
 * May this Game Master create this contest right now?
 *
 * Refusals are checked in the order an operator would want to hear them: the permission to
 * create at all, then the game, then the daily quota. A Game Master told "daily limit
 * reached" when their package forbids creation entirely would wait until tomorrow and be
 * refused again.
 */
export function checkGameMasterCanCreate(
  input: CheckCreationInput,
): CreationVerdict {
  // Resolved through the SAME helper that stamps the stored label, so a request carrying no
  // game type is treated as trading by the gate and written as trading by the insert.
  const gameType = resolveGameType(input.requestedGameType);

  if (!input.limits.canCreateCompetitions) {
    return {
      ok: false,
      reason: "creation_not_permitted",
      message:
        input.limits.creationDecidedBy === "admin_override"
          ? "Competition creation has been disabled for your account by an administrator. Please contact support."
          : "Your package does not allow competition creation. Upgrade your package to create competitions.",
      gameType,
    };
  }

  if (!input.limits.allowedGameTypes.includes(gameType)) {
    return {
      ok: false,
      reason: "game_not_permitted",
      // Reason the message names the game rather than listing what IS allowed: the allow-list
      // is one entry for every Game Master today, so "you may only create trading" reads as
      // a permanent product statement rather than a setting. Naming the refused game keeps it
      // accurate when a second entry is granted.
      message: `Your Game Master package does not allow creating ${gameType} competitions.`,
      gameType,
    };
  }

  if (input.competitionsCreatedToday >= input.limits.maxCompetitionsPerDay) {
    return {
      ok: false,
      reason: "daily_limit_reached",
      message: `Daily limit reached. You can create ${input.limits.maxCompetitionsPerDay} competition(s) per day.`,
      gameType,
    };
  }

  return { ok: true, gameType };
}

/**
 * The game types the Game Master creation ROUTES can actually build a contest for.
 *
 * A DIFFERENT QUESTION FROM `allowedGameTypes`, AND THE TWO MUST NOT BE COLLAPSED.
 * `allowedGameTypes` asks whether this Game Master is *permitted* a game; this asks whether
 * the route *knows how* to create one. Today only trading, and the gap is not cosmetic: a
 * provider contest needs a catalogue title, settings validated against that title's
 * `configSchema`, round settings, and the pre-flight checklist - which is chapter 19
 * sections 3.1 and 3.3, and is not built.
 *
 * Why it is a refusal rather than something left to fail naturally: `contestGameLabel`
 * derives `gameKey` from the game TYPE when no key is supplied, so a provider contest
 * created here would be stamped `gameKey: "provider"` instead of
 * `provider:<providerKey>:<gameCode>`. `gameKey` is IMMUTABLE - it is the join key for every
 * historical statistic - so that cannot be corrected in place afterwards, and nothing would
 * report it. The contest would settle, pay, and quietly sit outside every per-game figure.
 *
 * So the day somebody grants a Game Master `["trading", "provider"]` they get a refusal that
 * names the missing capability, rather than a contest with a permanently wrong key. Widening
 * the allow-list is necessary and not sufficient, and this is what says so.
 */
export const ROUTE_CREATABLE_GAME_TYPES: readonly string[] = ["trading"];

export function checkRouteCanCreateGameType(gameType: GameType): CreationVerdict {
  if (ROUTE_CREATABLE_GAME_TYPES.includes(gameType)) {
    return { ok: true, gameType };
  }

  return {
    ok: false,
    reason: "game_not_supported_here",
    message: `Creating ${gameType} competitions is not available yet. Please contact support.`,
    gameType,
  };
}

/**
 * The smallest number of players a paid contest may require.
 *
 * A hard platform constraint rather than a Game Master one: no paid format is ever
 * single-player. `minParticipants` at 1 means the auto-cancel-and-refund below the minimum
 * can never fire, so one player pays an entry fee and takes the pot back minus the platform
 * fee - a paid solo game, which is the thing the regulatory position in
 * `legal/ChartVolt-Regulatory-Defence-Pack.html` depends on the platform not offering.
 */
export const MIN_CONTEST_PARTICIPANTS = 2;

/**
 * Clamp a requested minimum up to the platform floor.
 *
 * Reason this is a clamp and not a refusal: the value is not something a Game Master types
 * on purpose - the creation form does not expose it - so a 1 arriving here is a default
 * somewhere upstream rather than an operator decision, and refusing the whole request would
 * turn a silently-wrong field into a dead form. A supplied 3 is honoured; anything below 2,
 * absent, or unparseable becomes 2.
 *
 * Note `parseInt(x) || 2` is what this replaces and it is wrong in exactly one direction:
 * `parseInt("1") || 2` is 1, because 1 is truthy. `"0"` and `""` were caught by luck.
 */
export function clampMinParticipants(requested: unknown): number {
  const parsed =
    typeof requested === "number"
      ? requested
      : Number.parseInt(String(requested ?? ""), 10);

  return Number.isFinite(parsed) && parsed > MIN_CONTEST_PARTICIPANTS
    ? Math.floor(parsed)
    : MIN_CONTEST_PARTICIPANTS;
}
