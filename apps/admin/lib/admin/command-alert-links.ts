/**
 * Deep-link helpers for Command Alerts → other admin screens.
 * Model-free so the client table can import it (R58).
 */

export interface AlertLinkFacts {
  userId?: string | null;
  alertType?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Types that belong on Fraud Monitoring's Security Alerts card. */
const FRAUD_SECTION_TYPES = new Set([
  "webhook_signature_failure",
  "webhook_replay_detected",
  "chargeback_received",
  "nosql_injection_attempt",
  "csrf_violation",
  "origin_mismatch",
  "brute_force_detected",
  "ato_attempt",
  "rate_limit_exceeded",
  "repeat_challenge_pairing",
]);

/**
 * Best admin destination for this alert.
 * Prefer the user detail panel when we have a userId; otherwise Fraud Monitoring
 * for security/payment types; otherwise null (no helpful deep link).
 */
export function fraudDeepLinkForAlert(alert: AlertLinkFacts): {
  href: string;
  label: string;
} | null {
  const userId =
    typeof alert.userId === "string" && alert.userId.trim()
      ? alert.userId.trim()
      : null;
  if (userId) {
    return {
      href: `/dashboard?activeTab=users&userId=${encodeURIComponent(userId)}`,
      label: "Open user",
    };
  }

  const type = typeof alert.alertType === "string" ? alert.alertType : "";
  if (FRAUD_SECTION_TYPES.has(type)) {
    return {
      href: "/dashboard?activeTab=fraud",
      label: "Open Fraud",
    };
  }

  // Provider money / catalogue alerts: round inspector / providers are more useful
  // than Fraud, but those screens need specific ids. Fall back to Fraud's security
  // card so the operator still has one click into the shared alert surface.
  if (
    type === "prize_pool_mismatch" ||
    type === "catalogue_sync_stale" ||
    type === "round_unresolved" ||
    type === "provider_kill_switch" ||
    type.startsWith("provider_")
  ) {
    return {
      href: "/dashboard?activeTab=fraud",
      label: "Open Fraud alerts",
    };
  }

  return null;
}
