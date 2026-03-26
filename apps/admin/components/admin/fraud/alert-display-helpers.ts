/**
 * Shared helpers for computing consistent fraud alert display values.
 *
 * Reason: Alert `title` and `description` stored in the DB can become stale
 * when new evidence or users are merged into an existing alert. These helpers
 * compute display values from the **actual** alert data so every view
 * (Investigation Center card, Alert Detail dialog, Overview tab) shows
 * the same numbers.
 */

/** Minimal alert shape needed for display helpers */
export interface AlertForDisplay {
  alertType: string;
  suspiciousUserIds: string[];
  evidence: Array<{ type: string; description: string; data?: unknown }>;
  detectionCount?: number;
}

// Maps raw evidence.type keys to human-readable method names.
const TYPE_LABELS = new Map<string, string>([
  ["device_fingerprint", "Same Device"],
  ["same_device", "Same Device"],
  ["payment_fingerprint", "Same Payment"],
  ["same_payment", "Same Payment"],
  ["mirror_trading", "Mirror Trading"],
  ["coordinated_entry", "Coordinated Entry"],
  ["trading_similarity", "Trading Similarity"],
  ["ip_browser_match", "IP + Browser Match"],
  ["ip_detection", "IP Detection"],
  ["same_ip", "Same IP"],
  ["same_ip_browser", "Same IP + Browser"],
  ["rapid_creation", "Rapid Creation"],
  ["timezone_language", "Timezone / Language"],
  ["device_switching", "Device Switching"],
  ["duplicate_document", "KYC Duplicate"],
  ["kyc_duplicate", "KYC Duplicate"],
]);

function getMethodLabel(type: string): string {
  return TYPE_LABELS.get(type) || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Returns the deduplicated, sorted list of unique method labels
 * from the evidence array (e.g. ["Same Payment", "Mirror Trading", "Same Device"]).
 */
export function getUniqueMethodLabels(alert: AlertForDisplay): string[] {
  const labels = new Set<string>();
  for (const ev of alert.evidence) {
    labels.add(getMethodLabel(ev.type));
  }
  return Array.from(labels);
}

/**
 * Computes the number of unique evidence types (Fraud Types).
 */
export function getEvidenceTypeCount(alert: AlertForDisplay): number {
  return new Set(alert.evidence.map((e) => e.type)).size;
}

/**
 * Unique account count: suspiciousUserIds UNION all connectedAccountIds in evidence.
 * This is the canonical "Accounts Involved" number.
 */
export function getAccountsInvolved(alert: AlertForDisplay): number {
  const ids = new Set<string>(alert.suspiciousUserIds);
  for (const ev of alert.evidence) {
    const data = ev.data as Record<string, unknown> | undefined;
    if (data && Array.isArray(data.connectedAccountIds)) {
      for (const id of data.connectedAccountIds as string[]) ids.add(id);
    }
  }
  return ids.size;
}

/**
 * Returns a dynamic title like:
 *   "Multiple Fraud Indicators (4 methods, 4 detections)"
 * or a simpler one if there's only 1 evidence type.
 */
export function computeAlertTitle(alert: AlertForDisplay): string {
  const uniqueTypes = getEvidenceTypeCount(alert);
  const detections = alert.evidence.length;

  if (uniqueTypes <= 1) {
    const label = alert.evidence.length > 0 ? getMethodLabel(alert.evidence[0].type) : alert.alertType;
    return `${label} Detection (${detections} detection${detections !== 1 ? "s" : ""})`;
  }

  return `Multiple Fraud Indicators (${uniqueTypes} methods, ${detections} detection${detections !== 1 ? "s" : ""})`;
}

/**
 * Returns a dynamic description like:
 *   "4 accounts flagged for: Same Payment, Mirror Trading, Same Device, Coordinated Entry"
 */
export function computeAlertDescription(alert: AlertForDisplay): string {
  const accountCount = getAccountsInvolved(alert);
  const labels = getUniqueMethodLabels(alert);
  return `${accountCount} accounts flagged for: ${labels.join(", ")}`;
}
