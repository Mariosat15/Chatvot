import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  alertTypesForCategory,
  type CommandAlertCategory,
} from "@/lib/admin/command-alert-categories";
// Reason: shared service lives at repo root; admin @/ points at apps/admin/.
import {
  pageSecurityAlerts,
  deleteSecurityAlertsByIds,
  deleteSecurityAlertsMatching,
  getSecurityAlertRetentionSettings,
  setSecurityAlertRetentionSettings,
  acknowledgeSecurityAlertsByIds,
  listSecurityAlertsForExport,
  securityAlertsToCsv,
  COMMAND_ALERT_PAGE_SIZES,
  type PageSecurityAlertsInput,
} from "../../../../../../lib/services/security/security-alert-ops.service";
import { SECURITY_ALERT_RETENTION_DAYS } from "../../../../../../database/models/security-alert-settings.model";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "provider",
  "security",
  "payment",
  "other",
]);

function parseListInput(searchParams: URLSearchParams): PageSecurityAlertsInput {
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "25");
  const severity = searchParams.get("severity") || undefined;
  const alertType = searchParams.get("alertType") || undefined;
  const category = searchParams.get("category") || undefined;
  const provider = searchParams.get("provider") || undefined;
  const q = searchParams.get("q") || undefined;
  const status = searchParams.get("status") || "open"; // open | ack | all

  const input: PageSecurityAlertsInput = {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    provider: provider || undefined,
    q: q || undefined,
  };

  if (status === "all") {
    input.includeAcknowledged = true;
  } else if (status === "ack") {
    input.acknowledgedOnly = true;
  }

  if (
    severity === "low" ||
    severity === "medium" ||
    severity === "high" ||
    severity === "critical"
  ) {
    input.severity = severity;
  }

  if (alertType && alertType !== "all") {
    input.alertType = alertType;
  } else if (category && CATEGORIES.has(category)) {
    input.alertTypes = alertTypesForCategory(category as CommandAlertCategory);
  }

  return input;
}

/**
 * GET /api/dev-zone/command-alerts
 * Paginated SecurityAlerts (same events that print 🚨 [SECURITY] in PM2).
 * Pass format=csv to download the filtered set (cap 5,000).
 */
export async function GET(request: NextRequest) {
  const guard = await guardSection("command-alerts");
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const input = parseListInput(searchParams);

    if (searchParams.get("format") === "csv") {
      const rows = await listSecurityAlertsForExport(input);
      const csv = securityAlertsToCsv(rows);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="command-alerts-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const [page, settings] = await Promise.all([
      pageSecurityAlerts(input),
      getSecurityAlertRetentionSettings(),
    ]);

    return NextResponse.json({
      success: true,
      ...page,
      settings,
      pageSizes: COMMAND_ALERT_PAGE_SIZES,
      retentionOptions: SECURITY_ALERT_RETENTION_DAYS,
    });
  } catch (err) {
    console.error("GET /api/dev-zone/command-alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load command alerts" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/dev-zone/command-alerts
 * Acknowledge one or many alerts (keeps history; drops them from the open live list).
 * body: { action: "acknowledge", ids: string[], note?: string }
 */
export async function POST(request: NextRequest) {
  const guard = await guardSection("command-alerts");
  if (!guard.ok) return guard.response;

  let body: { action?: unknown; ids?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (body.action !== "acknowledge") {
    return NextResponse.json(
      { success: false, error: 'action must be "acknowledge"' },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : [];
  if (!ids.length) {
    return NextResponse.json(
      { success: false, error: "ids[] required" },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const adminId = guard.admin.id || guard.admin.email || "admin";

  try {
    const acknowledged = await acknowledgeSecurityAlertsByIds(
      ids,
      adminId,
      note,
    );
    return NextResponse.json({ success: true, acknowledged });
  } catch (err) {
    console.error("POST /api/dev-zone/command-alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge alerts" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/dev-zone/command-alerts
 * Update auto-delete retention settings.
 */
export async function PATCH(request: NextRequest) {
  const guard = await guardSection("command-alerts");
  if (!guard.ok) return guard.response;

  let body: { autoDeleteEnabled?: unknown; retentionDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const autoDeleteEnabled = body.autoDeleteEnabled === true;
  const retentionDays = Number(body.retentionDays);
  if (
    !SECURITY_ALERT_RETENTION_DAYS.includes(
      retentionDays as (typeof SECURITY_ALERT_RETENTION_DAYS)[number],
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `retentionDays must be one of ${SECURITY_ALERT_RETENTION_DAYS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const settings = await setSecurityAlertRetentionSettings({
      autoDeleteEnabled,
      retentionDays,
    });
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error("PATCH /api/dev-zone/command-alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dev-zone/command-alerts
 * body: { ids: string[] } — delete selected
 * body: { matchCurrentFilters: true, ...filters } — delete matching (cap 5k)
 */
export async function DELETE(request: NextRequest) {
  const guard = await guardSection("command-alerts");
  if (!guard.ok) return guard.response;

  let body: {
    ids?: unknown;
    matchCurrentFilters?: unknown;
    page?: unknown;
    pageSize?: unknown;
    status?: unknown;
    severity?: unknown;
    alertType?: unknown;
    category?: unknown;
    provider?: unknown;
    q?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  try {
    if (Array.isArray(body.ids)) {
      const ids = body.ids.filter((id): id is string => typeof id === "string");
      const deleted = await deleteSecurityAlertsByIds(ids);
      return NextResponse.json({ success: true, deleted });
    }

    if (body.matchCurrentFilters === true) {
      const params = new URLSearchParams();
      if (typeof body.status === "string") params.set("status", body.status);
      if (typeof body.severity === "string") params.set("severity", body.severity);
      if (typeof body.alertType === "string")
        params.set("alertType", body.alertType);
      if (typeof body.category === "string")
        params.set("category", body.category);
      if (typeof body.provider === "string")
        params.set("provider", body.provider);
      if (typeof body.q === "string") params.set("q", body.q);
      const input = parseListInput(params);
      const deleted = await deleteSecurityAlertsMatching(input);
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json(
      { success: false, error: "Provide ids[] or matchCurrentFilters: true" },
      { status: 400 },
    );
  } catch (err) {
    console.error("DELETE /api/dev-zone/command-alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete alerts" },
      { status: 500 },
    );
  }
}
