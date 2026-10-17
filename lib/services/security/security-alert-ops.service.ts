/**
 * Paginated list / delete / retention for SecurityAlert — used by Dev Zone → Command Alerts.
 *
 * Keeps the original `listSecurityAlerts` / acknowledge helpers unchanged for Fraud UI.
 */

import { connectToDatabase } from "../../../database/mongoose";
import SecurityAlert, {
  type SecurityAlertSeverity,
  type SecurityAlertType,
  type ISecurityAlert,
} from "../../../database/models/security-alert.model";
import SecurityAlertSettings, {
  SECURITY_ALERT_RETENTION_DAYS,
  type SecurityAlertRetentionDays,
  type ISecurityAlertSettings,
} from "../../../database/models/security-alert-settings.model";

export const COMMAND_ALERT_PAGE_SIZES = [10, 25, 50, 100] as const;
export type CommandAlertPageSize = (typeof COMMAND_ALERT_PAGE_SIZES)[number];

export interface PageSecurityAlertsInput {
  page?: number;
  pageSize?: number;
  includeAcknowledged?: boolean;
  /** When true, only acknowledged rows. */
  acknowledgedOnly?: boolean;
  alertType?: SecurityAlertType | string;
  /** Multiple types — used for category filters. */
  alertTypes?: string[];
  severity?: SecurityAlertSeverity;
  provider?: string;
  /** Case-insensitive match on reason / source / alertType. */
  q?: string;
  since?: Date;
}

export interface PageSecurityAlertsResult {
  alerts: ISecurityAlert[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  bySeverity: Record<SecurityAlertSeverity, number>;
  byCategoryRough: {
    provider: number;
    security: number;
    payment: number;
    other: number;
  };
}

function buildAlertFilter(
  input: PageSecurityAlertsInput,
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (input.acknowledgedOnly) {
    query.acknowledged = true;
  } else if (!input.includeAcknowledged) {
    query.acknowledged = false;
  }

  if (input.alertTypes && input.alertTypes.length > 0) {
    query.alertType = { $in: input.alertTypes };
  } else if (input.alertType) {
    query.alertType = input.alertType;
  }

  if (input.severity) query.severity = input.severity;
  if (input.provider) query.provider = input.provider;
  if (input.since) query.createdAt = { $gte: input.since };

  const q = typeof input.q === "string" ? input.q.trim() : "";
  if (q) {
    // Reason: escape so an operator typing "(" does not break the filter into a regex error.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { reason: { $regex: escaped, $options: "i" } },
      { source: { $regex: escaped, $options: "i" } },
      { alertType: { $regex: escaped, $options: "i" } },
      { provider: { $regex: escaped, $options: "i" } },
    ];
  }

  return query;
}

const PROVIDER_TYPES = new Set([
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
]);
const PAYMENT_TYPES = new Set(["chargeback_received"]);
const SECURITY_TYPES = new Set([
  "webhook_signature_failure",
  "webhook_replay_detected",
  "nosql_injection_attempt",
  "csrf_violation",
  "origin_mismatch",
  "brute_force_detected",
  "ato_attempt",
  "rate_limit_exceeded",
]);

function roughCategory(alertType: string): keyof PageSecurityAlertsResult["byCategoryRough"] {
  if (PROVIDER_TYPES.has(alertType)) return "provider";
  if (PAYMENT_TYPES.has(alertType)) return "payment";
  if (SECURITY_TYPES.has(alertType)) return "security";
  return "other";
}

/**
 * Paginated SecurityAlert list for Dev Zone. Caps pageSize at 100.
 */
export async function pageSecurityAlerts(
  input: PageSecurityAlertsInput = {},
): Promise<PageSecurityAlertsResult> {
  await connectToDatabase();

  const pageSizeRaw = input.pageSize ?? 25;
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25),
  );
  const pageRaw = input.page ?? 1;
  const page = Math.max(1, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1);
  const filter = buildAlertFilter(input);

  const [total, alerts, severityRows, typeRows] = await Promise.all([
    SecurityAlert.countDocuments(filter),
    SecurityAlert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<ISecurityAlert[]>(),
    SecurityAlert.aggregate([
      { $match: filter },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),
    SecurityAlert.aggregate([
      { $match: filter },
      { $group: { _id: "$alertType", count: { $sum: 1 } } },
    ]),
  ]);

  const bySeverity: Record<SecurityAlertSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const r of severityRows as { _id: SecurityAlertSeverity; count: number }[]) {
    if (r._id in bySeverity) bySeverity[r._id] = r.count;
  }

  const byCategoryRough = {
    provider: 0,
    security: 0,
    payment: 0,
    other: 0,
  };
  for (const r of typeRows as { _id: string; count: number }[]) {
    byCategoryRough[roughCategory(r._id)] += r.count;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    alerts,
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    bySeverity,
    byCategoryRough,
  };
}

/**
 * Mark alerts as acknowledged. Keeps the documents; they drop out of the default
 * "open" live list. Returns how many were updated.
 */
export async function acknowledgeSecurityAlertsByIds(
  ids: string[],
  adminId: string,
  note?: string,
): Promise<number> {
  if (!ids.length) return 0;
  await connectToDatabase();
  const result = await SecurityAlert.updateMany(
    { _id: { $in: ids }, acknowledged: false },
    {
      $set: {
        acknowledged: true,
        acknowledgedBy: adminId,
        acknowledgedAt: new Date(),
        ...(typeof note === "string" && note.trim()
          ? { acknowledgmentNote: note.trim() }
          : {}),
      },
    },
  );
  return result.modifiedCount ?? 0;
}

/**
 * Rows for CSV export — same filters as the list, capped at 5,000 (same as bulk delete).
 */
export async function listSecurityAlertsForExport(
  input: PageSecurityAlertsInput,
): Promise<ISecurityAlert[]> {
  await connectToDatabase();
  const filter = buildAlertFilter(input);
  return SecurityAlert.find(filter)
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean<ISecurityAlert[]>();
}

/** Flatten one alert into CSV-safe string fields. */
export function securityAlertToCsvRow(alert: ISecurityAlert): string[] {
  const created =
    alert.createdAt instanceof Date
      ? alert.createdAt.toISOString()
      : String(alert.createdAt ?? "");
  const ackAt =
    alert.acknowledgedAt instanceof Date
      ? alert.acknowledgedAt.toISOString()
      : alert.acknowledgedAt
        ? String(alert.acknowledgedAt)
        : "";
  let metadata = "";
  try {
    metadata = alert.metadata ? JSON.stringify(alert.metadata) : "";
  } catch {
    metadata = "";
  }
  return [
    String(alert._id),
    created,
    String(alert.alertType ?? ""),
    String(alert.severity ?? ""),
    String(alert.source ?? ""),
    String(alert.provider ?? ""),
    String(alert.userId ?? ""),
    String(alert.ip ?? ""),
    String(alert.reason ?? ""),
    alert.acknowledged ? "yes" : "no",
    String(alert.acknowledgedBy ?? ""),
    ackAt,
    metadata,
  ];
}

const CSV_HEADER = [
  "id",
  "createdAt",
  "alertType",
  "severity",
  "source",
  "provider",
  "userId",
  "ip",
  "reason",
  "acknowledged",
  "acknowledgedBy",
  "acknowledgedAt",
  "metadata",
] as const;

/** Escape one CSV cell (RFC 4180-ish). */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a full CSV document from alert rows. */
export function securityAlertsToCsv(alerts: ISecurityAlert[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const a of alerts) {
    lines.push(securityAlertToCsvRow(a).map(csvEscape).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Delete specific alert ids. Returns how many were removed. */
export async function deleteSecurityAlertsByIds(
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;
  await connectToDatabase();
  const result = await SecurityAlert.deleteMany({ _id: { $in: ids } });
  return result.deletedCount ?? 0;
}

/**
 * Delete every alert matching the same filters as the list (no pagination).
 * Caps at 5,000 per call so a mistaken "delete all" cannot hang the process.
 */
export async function deleteSecurityAlertsMatching(
  input: PageSecurityAlertsInput,
): Promise<number> {
  await connectToDatabase();
  const filter = buildAlertFilter(input);
  const ids = await SecurityAlert.find(filter)
    .select("_id")
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();
  if (ids.length === 0) return 0;
  const result = await SecurityAlert.deleteMany({
    _id: { $in: ids.map((d) => d._id) },
  });
  return result.deletedCount ?? 0;
}

/** Delete alerts older than `days`. Used by the retention job and by a manual purge. */
export async function purgeSecurityAlertsOlderThan(
  days: number,
): Promise<number> {
  if (!Number.isFinite(days) || days < 1) return 0;
  await connectToDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await SecurityAlert.deleteMany({ createdAt: { $lt: cutoff } });
  return result.deletedCount ?? 0;
}

export interface SecurityAlertRetentionSettings {
  autoDeleteEnabled: boolean;
  retentionDays: SecurityAlertRetentionDays;
}

export async function getSecurityAlertRetentionSettings(): Promise<SecurityAlertRetentionSettings> {
  await connectToDatabase();
  const doc = (await SecurityAlertSettings.findOne({ key: "default" }).lean()) as
    | ISecurityAlertSettings
    | null;
  return {
    autoDeleteEnabled: doc?.autoDeleteEnabled === true,
    retentionDays:
      doc &&
      SECURITY_ALERT_RETENTION_DAYS.includes(
        doc.retentionDays as SecurityAlertRetentionDays,
      )
        ? (doc.retentionDays as SecurityAlertRetentionDays)
        : 7,
  };
}

export async function setSecurityAlertRetentionSettings(input: {
  autoDeleteEnabled: boolean;
  retentionDays: number;
}): Promise<SecurityAlertRetentionSettings> {
  await connectToDatabase();
  const days = SECURITY_ALERT_RETENTION_DAYS.includes(
    input.retentionDays as SecurityAlertRetentionDays,
  )
    ? (input.retentionDays as SecurityAlertRetentionDays)
    : 7;

  const doc = await SecurityAlertSettings.findOneAndUpdate(
    { key: "default" },
    {
      $set: {
        autoDeleteEnabled: input.autoDeleteEnabled === true,
        retentionDays: days,
      },
      $setOnInsert: { key: "default" },
    },
    { upsert: true, new: true },
  ).lean<ISecurityAlertSettings | null>();

  return {
    autoDeleteEnabled: doc?.autoDeleteEnabled === true,
    retentionDays: (doc?.retentionDays as SecurityAlertRetentionDays) ?? 7,
  };
}

/**
 * Run auto-purge if enabled. Safe to call daily from the worker.
 * Returns deleted count (0 when disabled).
 */
export async function runSecurityAlertAutoPurge(): Promise<{
  deleted: number;
  skipped: boolean;
  retentionDays: number;
}> {
  const settings = await getSecurityAlertRetentionSettings();
  if (!settings.autoDeleteEnabled) {
    return { deleted: 0, skipped: true, retentionDays: settings.retentionDays };
  }
  const deleted = await purgeSecurityAlertsOlderThan(settings.retentionDays);
  return {
    deleted,
    skipped: false,
    retentionDays: settings.retentionDays,
  };
}
