/**
 * Fire-and-forget persistence of SecurityAlert events.
 *
 * Call sites (e.g., webhook handlers) must not block the normal response on
 * alert persistence — we log to console synchronously and best-effort write to
 * MongoDB in the background. Failure to persist is logged but never rethrown.
 */

// Reason: relative imports so this module resolves under both the main app's
// @/ alias (repo root) and the admin app's @/ alias (apps/admin/).
import { connectToDatabase } from "../../../database/mongoose";
import SecurityAlert, {
  type SecurityAlertSeverity,
  type SecurityAlertType,
  type ISecurityAlert,
} from "../../../database/models/security-alert.model";

export interface RecordSecurityAlertInput {
  alertType: SecurityAlertType;
  severity?: SecurityAlertSeverity;
  source: string;
  provider?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  reason: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Write a SecurityAlert to MongoDB. Never throws. Returns null on failure.
 */
export async function recordSecurityAlert(
  input: RecordSecurityAlertInput,
): Promise<ISecurityAlert | null> {
  const severity = input.severity ?? "high";

  // Always log — even if DB is down, ops gets a paper trail in the process logs.
  console.error(
    `🚨 [SECURITY] ${input.alertType} [${severity}] source=${input.source}` +
      (input.provider ? ` provider=${input.provider}` : "") +
      (input.ip ? ` ip=${input.ip}` : "") +
      (input.userId ? ` userId=${input.userId}` : "") +
      ` — ${input.reason}`,
  );

  try {
    await connectToDatabase();
    const doc = await SecurityAlert.create({
      alertType: input.alertType,
      severity,
      source: input.source,
      provider: input.provider,
      ip: input.ip,
      userAgent: input.userAgent,
      userId: input.userId,
      reason: input.reason,
      metadata: input.metadata,
      acknowledged: false,
    });
    return doc;
  } catch (err) {
    console.error(
      "⚠️ [SECURITY] Failed to persist SecurityAlert (logged to console only):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface ListSecurityAlertsOptions {
  limit?: number;
  includeAcknowledged?: boolean;
  alertType?: SecurityAlertType;
  provider?: string;
  since?: Date;
}

/**
 * List recent SecurityAlerts for admin display. Defaults: 100 most-recent
 * unacknowledged alerts.
 */
export async function listSecurityAlerts(
  options: ListSecurityAlertsOptions = {},
): Promise<ISecurityAlert[]> {
  const {
    limit = 100,
    includeAcknowledged = false,
    alertType,
    provider,
    since,
  } = options;

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (!includeAcknowledged) query.acknowledged = false;
  if (alertType) query.alertType = alertType;
  if (provider) query.provider = provider;
  if (since) query.createdAt = { $gte: since };

  return SecurityAlert.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(1, limit), 500))
    .lean<ISecurityAlert[]>();
}

/**
 * Mark an alert as acknowledged by an admin. Returns the updated doc or null.
 */
export async function acknowledgeSecurityAlert(
  alertId: string,
  adminId: string,
  note?: string,
): Promise<ISecurityAlert | null> {
  await connectToDatabase();
  return SecurityAlert.findByIdAndUpdate(
    alertId,
    {
      $set: {
        acknowledged: true,
        acknowledgedBy: adminId,
        acknowledgedAt: new Date(),
        acknowledgmentNote: note,
      },
    },
    { new: true },
  ).lean<ISecurityAlert | null>();
}

/**
 * Counts for the admin dashboard badge.
 */
export async function countUnacknowledgedAlerts(): Promise<{
  total: number;
  bySeverity: Record<SecurityAlertSeverity, number>;
}> {
  await connectToDatabase();
  const rows = await SecurityAlert.aggregate([
    { $match: { acknowledged: false } },
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);

  const bySeverity: Record<SecurityAlertSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  let total = 0;
  for (const r of rows as { _id: SecurityAlertSeverity; count: number }[]) {
    if (r._id in bySeverity) {
      bySeverity[r._id] = r.count;
      total += r.count;
    }
  }
  return { total, bySeverity };
}
