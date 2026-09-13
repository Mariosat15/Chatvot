/**
 * Shared milestone condition evaluation for journey maps.
 * Used by: journey evaluate API, journey sync-all-users API, and milestone simulator.
 * Single source of truth so simulator and production stay in sync.
 */

export interface MilestoneCondition {
  type: string;
  value?: number | string;
  comparison?: string;
}

export type MilestoneUserStats = Record<string, number | boolean>;

const BOOLEAN_CONDITION_TYPES = [
  "account_created",
  "kyc_verified",
  "first_deposit",
  "has_deposit",
  "first_trade",
  "first_withdrawal",
  "withdrawal_made",
  "first_winning_trade",
  "first_losing_trade",
  "first_stop_loss",
  "first_take_profit",
  "total_pnl_positive",
] as const;

/**
 * Evaluate if a milestone condition is met against user stats.
 * Used by production journey APIs and admin milestone simulator (single source of truth).
 */
export function evaluateMilestoneCondition(
  condition: MilestoneCondition | undefined,
  userStats: MilestoneUserStats
): boolean {
  if (!condition) return false;

  const { type, value, comparison = "gte" } = condition;
  const userValue = userStats[type];

  if (BOOLEAN_CONDITION_TYPES.includes(type as (typeof BOOLEAN_CONDITION_TYPES)[number])) {
    return userStats[type] === true;
  }

  if (type === "map_completed") {
    return false; // Handled separately via progression logic
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const numericUserValue = typeof userValue === "number" ? userValue : 0;

  if (numericValue === undefined || numericValue === null || isNaN(numericValue as number)) {
    return false;
  }

  switch (comparison) {
    case "gte":
    case ">=":
      return numericUserValue >= (numericValue as number);
    case "gt":
    case ">":
      return numericUserValue > (numericValue as number);
    case "lte":
    case "<=":
      return numericUserValue <= (numericValue as number);
    case "lt":
    case "<":
      return numericUserValue < (numericValue as number);
    case "eq":
    case "=":
    case "==":
      return numericUserValue === numericValue;
    default:
      return numericUserValue >= (numericValue as number);
  }
}
