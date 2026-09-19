import type { IUserRestriction } from "@/database/models/user-restriction.model";

/**
 * Default ETA when an admin has not explicitly set one on the restriction.
 * Kept as a constant so admin UI copy, API responses and emails share the
 * same baseline without hard-coding the number in multiple places.
 */
export const DEFAULT_REVIEW_ETA_DAYS = 3;

/**
 * Mapping of raw `reason` enum values to privacy-safe, user-facing labels.
 * // Reason: Internal reason codes leak fraud-detection signals. The public
 * review page must show a neutral, non-disclosing category instead.
 */
const REASON_LABELS: Record<string, string> = {
  multi_accounting: "Duplicate-account review",
  fraud: "Fraud review",
  fraud_detected: "Fraud review",
  payment_fraud: "Payment review",
  terms_violation: "Terms-of-service review",
  suspicious_activity: "Security review",
  admin_decision: "Manual review",
  automated_fraud_detection: "Security review",
  kyc_failed: "Identity verification review",
  kyc_fraud: "Identity verification review",
  other: "Account review",
};

export type BlockedAction = "trade" | "enterCompetition" | "deposit" | "withdraw";

export interface ReviewPacket {
  /** `_id.toString()` of the restriction — used as the public case ID. */
  id: string;
  caseId: string;
  status: "active" | "lifted";
  type: "banned" | "suspended";
  reason: string;
  reasonLabel: string;
  customReason?: string;
  blockedActions: BlockedAction[];
  /** Human-readable ETA text ("within 3 business days"). */
  reviewEtaText: string;
  reviewEtaDays: number;
  reviewEtaDate?: string;
  documentsRequested: string[];
  expiresAt?: string;
  restrictedAt: string;
  appealSubmittedAt?: string;
  appealConversationId?: string;
}

/** Convert an ObjectId-like value into a short uppercase case identifier. */
export function toCaseId(id: string): string {
  const tail = id.slice(-8).toUpperCase();
  return `CV-${tail}`;
}

/**
 * Add N business days (Mon-Fri) to a date without tripping on weekends.
 * This keeps the ETA copy honest when an admin restricts on a Friday.
 */
function addBusinessDays(start: Date, days: number): Date {
  if (days <= 0) return start;
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

/**
 * Build the public-facing review packet from a restriction document.
 * Keeps `/api/user/restrictions` and the `/account/review` page aligned.
 */
export function toReviewPacket(
  restriction: Pick<
    IUserRestriction,
    | "_id"
    | "restrictionType"
    | "reason"
    | "customReason"
    | "canTrade"
    | "canEnterCompetitions"
    | "canDeposit"
    | "canWithdraw"
    | "restrictedAt"
    | "expiresAt"
    | "isActive"
    | "reviewEtaDays"
    | "documentsRequested"
    | "appealSubmittedAt"
    | "appealConversationId"
  > & { _id: unknown },
): ReviewPacket {
  const id = String(restriction._id);
  const caseId = toCaseId(id);

  const blockedActions: BlockedAction[] = [];
  if (!restriction.canTrade) blockedActions.push("trade");
  if (!restriction.canEnterCompetitions) blockedActions.push("enterCompetition");
  if (!restriction.canDeposit) blockedActions.push("deposit");
  if (!restriction.canWithdraw) blockedActions.push("withdraw");

  const etaDays = restriction.reviewEtaDays ?? DEFAULT_REVIEW_ETA_DAYS;
  const reviewEtaDate = restriction.restrictedAt
    ? addBusinessDays(new Date(restriction.restrictedAt), etaDays)
    : undefined;

  const reviewEtaText =
    etaDays === 0
      ? "Review in progress"
      : `within ${etaDays} business ${etaDays === 1 ? "day" : "days"}`;

  return {
    id,
    caseId,
    status: restriction.isActive ? "active" : "lifted",
    type: restriction.restrictionType,
    reason: restriction.reason,
    reasonLabel: REASON_LABELS[restriction.reason] ?? "Account review",
    customReason: restriction.customReason,
    blockedActions,
    reviewEtaText,
    reviewEtaDays: etaDays,
    reviewEtaDate: reviewEtaDate?.toISOString(),
    documentsRequested: restriction.documentsRequested ?? [],
    expiresAt: restriction.expiresAt?.toISOString(),
    restrictedAt: new Date(restriction.restrictedAt).toISOString(),
    appealSubmittedAt: restriction.appealSubmittedAt?.toISOString(),
    appealConversationId: restriction.appealConversationId,
  };
}
