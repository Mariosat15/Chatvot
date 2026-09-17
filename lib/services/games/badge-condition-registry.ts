/**
 * Single master list of badge condition types and categories (R96b).
 *
 * Every consumer — evaluator, form, AI prompts, balance engine, wizard — must
 * read from here. A fourth list is how trading floors land on game badges.
 *
 * Scope:
 *  - `platform` — account / wallet / social; no trade floors
 *  - `trading`  — forex trading metrics; rarity trade floors apply
 *  - `both`     — contests / XP / placements any game (R96a cross-game)
 *  - `game`     — UserGameStats fields for provider (or trading) games
 *
 * Model-free and client-safe. Mirrored into apps/admin.
 */

export type ConditionScope = "platform" | "trading" | "both" | "game";

export interface BadgeConditionDef {
  type: string;
  label: string;
  /** Form / AI grouping heading */
  group: string;
  scope: ConditionScope;
  /**
   * UserGameStats field for `game` scope. Evaluated against the badge's
   * `gameTypes` (first provider key, or `_overall` when platform-scoped).
   */
  gameStat?:
    | "contestsEntered"
    | "contestsCompleted"
    | "wins"
    | "podiums"
    | "totalPoints"
    | "seasonPoints"
    | "rating"
    | "bestRank"
    | "bestScore"
    | "currentStreak";
}

export interface BadgeCategoryDef {
  id: string;
  label: string;
  /** Which condition scopes belong in this category's picker */
  scopes: ConditionScope[];
}

/** Categories operators and agents may assign. Includes Games (R96b). */
export const BADGE_CATEGORIES: readonly BadgeCategoryDef[] = [
  { id: "Competition", label: "Competition", scopes: ["both", "game", "platform"] },
  { id: "Trading", label: "Trading", scopes: ["trading"] },
  { id: "Games", label: "Games", scopes: ["game", "both"] },
  { id: "Profit", label: "Profit", scopes: ["trading"] },
  { id: "Risk", label: "Risk", scopes: ["trading"] },
  { id: "Speed", label: "Speed", scopes: ["trading"] },
  { id: "Consistency", label: "Consistency", scopes: ["trading", "both"] },
  { id: "Strategy", label: "Strategy", scopes: ["trading"] },
  { id: "Social", label: "Social", scopes: ["platform"] },
  { id: "Legendary", label: "Legendary", scopes: ["trading", "both", "game", "platform"] },
] as const;

export const BADGE_CATEGORY_IDS: readonly string[] = BADGE_CATEGORIES.map(
  (c) => c.id,
);

/**
 * Master condition catalogue. Order within a group is display order.
 * Do not add a type to the form or an AI prompt without adding it here first.
 */
export const BADGE_CONDITION_DEFS: readonly BadgeConditionDef[] = [
  // ── Platform ────────────────────────────────────────────────────────────
  { type: "account_created", label: "Account Created", group: "Account", scope: "platform" },
  { type: "first_deposit", label: "First Deposit", group: "Account", scope: "platform" },
  { type: "has_deposit", label: "Has Any Deposit", group: "Account", scope: "platform" },
  { type: "kyc_verified", label: "KYC Verified", group: "Account", scope: "platform" },
  { type: "profile_complete", label: "Profile Complete", group: "Account", scope: "platform" },
  { type: "total_deposits", label: "Total Deposited Amount", group: "Account", scope: "platform" },
  { type: "total_deposited", label: "Total Deposited", group: "Account", scope: "platform" },
  { type: "withdrawal_made", label: "Withdrawal Made", group: "Account", scope: "platform" },
  { type: "total_withdrawals", label: "Total Withdrawals", group: "Account", scope: "platform" },
  { type: "large_withdrawal", label: "Large Withdrawal", group: "Account", scope: "platform" },
  { type: "net_profit_lifetime", label: "Net Profit Lifetime", group: "Account", scope: "platform" },
  { type: "platform_age", label: "Platform Age (days)", group: "Account", scope: "platform" },
  { type: "early_adopter", label: "Early Adopter", group: "Account", scope: "platform" },
  { type: "account_age", label: "Account Age", group: "Account", scope: "platform" },
  { type: "account_age_days", label: "Account Age (days)", group: "Account", scope: "platform" },
  { type: "referrals_made", label: "Referrals Made", group: "Social", scope: "platform" },
  { type: "referrals_active", label: "Active Referrals", group: "Social", scope: "platform" },
  { type: "friends_added", label: "Friends Added", group: "Social", scope: "platform" },
  { type: "login_streak", label: "Login Streak", group: "Social", scope: "platform" },
  { type: "messages_sent", label: "Messages Sent", group: "Social", scope: "platform" },
  { type: "competitions_entered", label: "Competitions Entered", group: "Competition", scope: "platform" },
  { type: "first_trade", label: "First Trade", group: "Trading", scope: "platform" },

  // ── Both (cross-game contests / XP) ─────────────────────────────────────
  { type: "competitions_completed", label: "Competitions Completed", group: "Competition", scope: "both" },
  { type: "first_place_finishes", label: "First Place Finishes", group: "Competition", scope: "both" },
  { type: "podium_finishes", label: "Podium Finishes", group: "Competition", scope: "both" },
  { type: "second_place_finishes", label: "Second Place Finishes", group: "Competition", scope: "both" },
  { type: "third_place_finishes", label: "Third Place Finishes", group: "Competition", scope: "both" },
  { type: "top_10_finishes", label: "Top 10 Finishes", group: "Competition", scope: "both" },
  { type: "top_50_percent_finishes", label: "Top 50% Finishes", group: "Competition", scope: "both" },
  { type: "perfect_competition_win_rate", label: "Perfect Comp Win Rate", group: "Competition", scope: "both" },
  { type: "beat_top_trader", label: "Beat Top Player", group: "Competition", scope: "both" },
  { type: "level_reached", label: "Level Reached", group: "Progression", scope: "both" },
  { type: "xp_threshold", label: "XP Threshold", group: "Progression", scope: "both" },
  { type: "xp_earned_today", label: "XP Earned Today", group: "Progression", scope: "both" },
  { type: "xp_earned_this_week", label: "XP Earned This Week", group: "Progression", scope: "both" },
  { type: "total_badges", label: "Total Badges", group: "Progression", scope: "both" },

  // ── Game (UserGameStats) ────────────────────────────────────────────────
  {
    type: "game_contests_entered",
    label: "Game Contests Entered",
    group: "Games",
    scope: "game",
    gameStat: "contestsEntered",
  },
  {
    type: "game_contests_completed",
    label: "Game Contests Completed",
    group: "Games",
    scope: "game",
    gameStat: "contestsCompleted",
  },
  {
    type: "game_wins",
    label: "Game Wins",
    group: "Games",
    scope: "game",
    gameStat: "wins",
  },
  {
    type: "game_podiums",
    label: "Game Podiums",
    group: "Games",
    scope: "game",
    gameStat: "podiums",
  },
  {
    type: "game_total_points",
    label: "Game Total Points",
    group: "Games",
    scope: "game",
    gameStat: "totalPoints",
  },
  {
    type: "game_season_points",
    label: "Game Season Points",
    group: "Games",
    scope: "game",
    gameStat: "seasonPoints",
  },
  {
    type: "game_rating",
    label: "Game Rating",
    group: "Games",
    scope: "game",
    gameStat: "rating",
  },
  {
    type: "game_best_rank",
    label: "Game Best Rank (≤)",
    group: "Games",
    scope: "game",
    gameStat: "bestRank",
  },
  {
    type: "game_best_score",
    label: "Game Best Score",
    group: "Games",
    scope: "game",
    gameStat: "bestScore",
  },
  {
    type: "game_current_streak",
    label: "Game Current Streak",
    group: "Games",
    scope: "game",
    gameStat: "currentStreak",
  },

  // ── Trading ─────────────────────────────────────────────────────────────
  { type: "total_trades", label: "Total Trades", group: "Trading", scope: "trading" },
  { type: "winning_trades", label: "Winning Trades", group: "Trading", scope: "trading" },
  { type: "losing_trades", label: "Losing Trades", group: "Trading", scope: "trading" },
  { type: "trades_today", label: "Trades Today", group: "Trading", scope: "trading" },
  { type: "trades_this_week", label: "Trades This Week", group: "Trading", scope: "trading" },
  { type: "trades_this_month", label: "Trades This Month", group: "Trading", scope: "trading" },
  { type: "consecutive_trading_days", label: "Consecutive Trading Days", group: "Trading", scope: "trading" },
  { type: "unique_pairs_traded", label: "Unique Pairs Traded", group: "Trading", scope: "trading" },
  { type: "different_assets_traded", label: "Different Assets Traded", group: "Trading", scope: "trading" },
  { type: "win_rate", label: "Win Rate %", group: "Performance", scope: "trading" },
  { type: "win_streak", label: "Current Win Streak", group: "Performance", scope: "trading" },
  { type: "max_win_streak", label: "Max Win Streak", group: "Performance", scope: "trading" },
  { type: "total_pnl", label: "Total P&L", group: "Performance", scope: "trading" },
  { type: "total_pnl_positive", label: "Positive P&L", group: "Performance", scope: "trading" },
  { type: "profit_factor", label: "Profit Factor", group: "Performance", scope: "trading" },
  { type: "single_trade_profit", label: "Single Trade Profit", group: "Performance", scope: "trading" },
  { type: "best_trade_pnl", label: "Best Trade P&L", group: "Performance", scope: "trading" },
  { type: "average_trade_pnl", label: "Average Trade P&L", group: "Performance", scope: "trading" },
  { type: "average_roi", label: "Average ROI", group: "Performance", scope: "trading" },
  { type: "no_liquidations", label: "No Liquidations", group: "Risk", scope: "trading" },
  { type: "always_uses_sl", label: "Always Uses Stop Loss", group: "Risk", scope: "trading" },
  { type: "always_uses_tp", label: "Always Uses Take Profit", group: "Risk", scope: "trading" },
  { type: "max_drawdown", label: "Max Drawdown %", group: "Risk", scope: "trading" },
  { type: "manual", label: "Manual (admin award)", group: "Other", scope: "platform" },
] as const;

const BY_TYPE = new Map(BADGE_CONDITION_DEFS.map((d) => [d.type, d]));

export function getConditionDef(type: string): BadgeConditionDef | undefined {
  return BY_TYPE.get(type);
}

export function conditionScope(type: string): ConditionScope {
  // Reason: unknown fails closed to trading — wrongly skipping a trade floor
  // lets a badge be earned without proof; wrongly applying one is visible.
  return BY_TYPE.get(type)?.scope ?? "trading";
}

/** R96a trade-exempt set, derived once from the registry. */
export function tradeExemptTypes(): Set<string> {
  return new Set(
    BADGE_CONDITION_DEFS.filter((d) => d.scope === "platform").map((d) => d.type),
  );
}

/** R96a cross-game set (scope `both`). */
export function crossGameConditionTypes(): Set<string> {
  return new Set(
    BADGE_CONDITION_DEFS.filter((d) => d.scope === "both").map((d) => d.type),
  );
}

/** Conditions that never take a trade floor (platform + both + game). */
export function noTradeFloorTypes(): Set<string> {
  return new Set(
    BADGE_CONDITION_DEFS.filter((d) => d.scope !== "trading").map((d) => d.type),
  );
}

/** Conditions allowed for a badge whose gameTypes are provider-only. */
export function conditionsForGameBadge(): BadgeConditionDef[] {
  return BADGE_CONDITION_DEFS.filter(
    (d) => d.scope === "game" || d.scope === "both" || d.scope === "platform",
  );
}

/** Conditions allowed for a trading-only badge. */
export function conditionsForTradingBadge(): BadgeConditionDef[] {
  return BADGE_CONDITION_DEFS.filter(
    (d) => d.scope === "trading" || d.scope === "both" || d.scope === "platform",
  );
}

/**
 * Picker list for the admin form given the badge's gameTypes.
 * Provider-only → no trading conditions. Trading-only / empty → no pure game stats
 * unless the operator also scopes to a game (empty = platform = both lists).
 */
export function conditionsAllowedForGameTypes(
  gameTypes: string[] | null | undefined,
): BadgeConditionDef[] {
  const types = Array.isArray(gameTypes)
    ? gameTypes.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const hasTrading = types.length === 0 || types.includes("trading");
  const hasProvider = types.some((t) => t !== "trading" && t !== "*" && t !== "all");

  if (hasProvider && !hasTrading) {
    return conditionsForGameBadge();
  }
  if (hasTrading && !hasProvider) {
    return conditionsForTradingBadge();
  }
  // Platform or mixed — full catalogue
  return [...BADGE_CONDITION_DEFS];
}

/** Prompt block for AI agents — types grouped with scope tags. */
export function conditionTypesForPrompt(): string {
  const lines: string[] = [];
  for (const d of BADGE_CONDITION_DEFS) {
    if (d.type === "manual") continue;
    lines.push(`- ${d.type} [${d.scope}] — ${d.label}`);
  }
  return lines.join("\n");
}

export function categoryIdsForPrompt(): string {
  return BADGE_CATEGORY_IDS.join(", ");
}

/**
 * Prompt block for agents authoring GAME-scoped content (R96b).
 *
 * Reason: the milestone agent's prompt named trading metrics only, so every
 * milestone it proposed for a provider game asked for trades. Handing it the
 * game-legal subset is the same fix the badge agent already has — and it is
 * derived from the registry, so a new condition type appears here the moment
 * it is registered rather than the next time somebody remembers this string.
 */
export function gameConditionTypesForPrompt(): string {
  return conditionsForGameBadge()
    .filter((d) => d.type !== "manual")
    .map((d) => `- ${d.type} [${d.scope}] — ${d.label}`)
    .join("\n");
}

/**
 * Whether a condition type may be attached to a badge with these gameTypes.
 * Used by writers (wizard, generate, form save) to refuse mismatches.
 */
export function conditionAllowedOnBadge(
  conditionType: string,
  gameTypes: string[] | null | undefined,
): boolean {
  return conditionsAllowedForGameTypes(gameTypes).some(
    (d) => d.type === conditionType,
  );
}
