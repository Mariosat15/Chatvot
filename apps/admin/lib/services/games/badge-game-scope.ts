/**
 * Badge visibility / evaluation scope by game (X7 step 4).
 *
 * Model-free so client and services can share the rules. Does not author
 * badges (R96b) — it only decides whether an existing badge applies to a
 * player given which games they have played.
 */

import { TRADING_GAME_TYPE } from "@/lib/games/types";

/** Condition types that are meaningful without trading activity (R96a). */
export const PLATFORM_OR_CROSS_GAME_CONDITION_TYPES = new Set([
  "first_deposit",
  "has_deposit",
  "total_deposited",
  "total_deposits",
  "withdrawal_made",
  "total_withdrawals",
  "large_withdrawal",
  "net_profit_lifetime",
  "platform_age",
  "early_adopter",
  "account_age",
  "account_age_days",
  "account_created",
  "kyc_verified",
  "profile_complete",
  "referrals_made",
  "referrals_active",
  "friends_added",
  "login_streak",
  "competitions_entered",
  "first_trade",
  "competitions_completed",
  "first_place_finishes",
  "podium_finishes",
  "second_place_finishes",
  "third_place_finishes",
  "top_10_finishes",
  "top_50_percent_finishes",
  "perfect_competition_win_rate",
  "beat_top_trader",
  "level_reached",
  "xp_threshold",
  "xp_earned_today",
  "xp_earned_this_week",
  "total_badges",
  "messages_sent",
]);

/**
 * Empty stored array → platform (every game). A lone `"trading"` keeps today's
 * default meaning. Provider keys are explicit per-game scopes (R96b later).
 */
export function normalizeBadgeGameTypes(
  gameTypes: string[] | null | undefined,
): string[] {
  if (!Array.isArray(gameTypes) || gameTypes.length === 0) return [];
  return gameTypes
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
}

export function providerKeysFromGameTypes(gameTypes: string[]): string[] {
  return gameTypes.filter(
    (t) => t !== TRADING_GAME_TYPE && t !== "*" && t !== "all",
  );
}

/**
 * Whether an *unearned* badge should be shown / evaluated for this player.
 * Earned badges are never filtered — renaming or hiding them deletes progress.
 */
export function badgeAppliesToPlayer(input: {
  gameTypes?: string[] | null;
  conditionType?: string;
  playedGameKeys: ReadonlySet<string>;
  hasTradingActivity: boolean;
}): boolean {
  const types = normalizeBadgeGameTypes(input.gameTypes);
  const providerKeys = providerKeysFromGameTypes(types);

  if (providerKeys.length > 0) {
    return providerKeys.some((k) => input.playedGameKeys.has(k));
  }

  // Platform scope (explicit empty after normalize)
  if (types.length === 0) return true;

  // Default catalogue: ["trading"] only
  if (types.length === 1 && types[0] === TRADING_GAME_TYPE) {
    const cond = input.conditionType || "";
    if (PLATFORM_OR_CROSS_GAME_CONDITION_TYPES.has(cond)) return true;
    return input.hasTradingActivity;
  }

  // Mixed list without provider keys (e.g. trading + all) — treat as platform
  return true;
}

/**
 * gameKey to stamp on xpHistory for a badge award. Single provider key wins;
 * trading-only stamps trading; platform / mixed leave undefined.
 */
export function gameKeyForBadgeXp(
  gameTypes?: string[] | null,
): string | undefined {
  const types = normalizeBadgeGameTypes(gameTypes);
  const providerKeys = providerKeysFromGameTypes(types);
  if (providerKeys.length === 1) return providerKeys[0];
  if (types.length === 1 && types[0] === TRADING_GAME_TYPE) {
    return TRADING_GAME_TYPE;
  }
  return undefined;
}
