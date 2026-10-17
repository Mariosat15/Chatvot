/**
 * Category labels for SecurityAlert types — model-free so the Dev Zone UI can import it.
 *
 * Categories are for navigation only; filter queries still use alertType / severity.
 */

export type CommandAlertCategory =
  | "provider"
  | "security"
  | "payment"
  | "other";

const PROVIDER_TYPES = [
  "round_unresolved",
  "provider_kill_switch",
  "provider_signature_invalid",
  "contest_stuck_finalizing",
  "prize_pool_mismatch",
  "provider_callback_failure_rate",
  "provider_latency_high",
  "provider_score_out_of_range",
  "provider_integrity_flag",
  "repeat_challenge_pairing",
  "catalogue_sync_stale",
] as const;

const PAYMENT_TYPES = ["chargeback_received"] as const;

const SECURITY_TYPES = [
  "webhook_signature_failure",
  "webhook_replay_detected",
  "nosql_injection_attempt",
  "csrf_violation",
  "origin_mismatch",
  "brute_force_detected",
  "ato_attempt",
  "rate_limit_exceeded",
] as const;

const PROVIDER_SET = new Set<string>(PROVIDER_TYPES);
const PAYMENT_SET = new Set<string>(PAYMENT_TYPES);
const SECURITY_SET = new Set<string>(SECURITY_TYPES);

export function categoryForAlertType(alertType: string): CommandAlertCategory {
  if (PROVIDER_SET.has(alertType)) return "provider";
  if (PAYMENT_SET.has(alertType)) return "payment";
  if (SECURITY_SET.has(alertType)) return "security";
  return "other";
}

export function alertTypesForCategory(category: CommandAlertCategory): string[] {
  if (category === "provider") return [...PROVIDER_TYPES];
  if (category === "payment") return [...PAYMENT_TYPES];
  if (category === "security") return [...SECURITY_TYPES];
  return ["other"];
}

export const COMMAND_ALERT_CATEGORY_LABELS: Record<
  CommandAlertCategory,
  string
> = {
  provider: "Provider / Games",
  security: "Security",
  payment: "Payments",
  other: "Other",
};

export const COMMAND_ALERT_CATEGORIES: readonly CommandAlertCategory[] = [
  "provider",
  "security",
  "payment",
  "other",
] as const;

/** Safe label lookup — avoids indexing a Record with a request-/loop-supplied key. */
export function labelForCategory(category: CommandAlertCategory): string {
  switch (category) {
    case "provider":
      return COMMAND_ALERT_CATEGORY_LABELS.provider;
    case "security":
      return COMMAND_ALERT_CATEGORY_LABELS.security;
    case "payment":
      return COMMAND_ALERT_CATEGORY_LABELS.payment;
    case "other":
      return COMMAND_ALERT_CATEGORY_LABELS.other;
  }
}

/** Safe count lookup for the category chip strip. */
export function countForCategory(
  counts: Record<CommandAlertCategory, number>,
  category: CommandAlertCategory,
): number {
  switch (category) {
    case "provider":
      return counts.provider;
    case "security":
      return counts.security;
    case "payment":
      return counts.payment;
    case "other":
      return counts.other;
  }
}
