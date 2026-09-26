import { auditLogService } from "@/lib/services/audit-log.service";

interface AdminSessionLike {
  id: string;
  email: string;
  name?: string;
}

/**
 * Fire-and-forget audit log helper for chargeback lifecycle actions.
 * Never throws — audit failures should not break the admin workflow.
 *
 * Reason: All chargeback state transitions must be durably recorded for
 * compliance, even when the action itself succeeds silently.
 */
export async function logChargebackAction(
  admin: AdminSessionLike,
  action:
    | "chargeback_created"
    | "chargeback_initiated"
    | "chargeback_represented"
    | "chargeback_won"
    | "chargeback_withdrawn"
    | "chargeback_completed"
    | "chargeback_narrative_updated"
    | "chargeback_attachment_added"
    | "chargeback_attachment_removed",
  caseId: string,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await auditLogService.log({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      action,
      category: "financial",
      description,
      targetType: "other",
      targetId: caseId,
      metadata,
    });
  } catch (err) {
    console.error("⚠️ [chargebacks] audit log failed:", err);
  }
}
