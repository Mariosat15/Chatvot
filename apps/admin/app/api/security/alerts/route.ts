import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/auth";
// Reason: the admin app's "@/" alias points at apps/admin/, so shared services
// in the repo-root lib/ must be imported via a relative path.
import {
  listSecurityAlerts,
  countUnacknowledgedAlerts,
  acknowledgeSecurityAlert,
} from "../../../../../../lib/services/security/security-alert.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/security/alerts
 *   ?limit=100&includeAcknowledged=0&alertType=...&provider=...
 * Lists recent SecurityAlert documents for admin review.
 */
export async function GET(request: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser.isAuthenticated) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 100;
  const includeAcknowledged = searchParams.get("includeAcknowledged") === "1";
  const alertType = searchParams.get("alertType") || undefined;
  const provider = searchParams.get("provider") || undefined;

  try {
    const [alerts, counts] = await Promise.all([
      listSecurityAlerts({
        limit: Number.isFinite(limit) ? limit : 100,
        includeAcknowledged,
        alertType: alertType as
          | "webhook_signature_failure"
          | "webhook_replay_detected"
          | "chargeback_received"
          | "nosql_injection_attempt"
          | "csrf_violation"
          | "origin_mismatch"
          | "brute_force_detected"
          | "ato_attempt"
          | "rate_limit_exceeded"
          | "other"
          | undefined,
        provider,
      }),
      countUnacknowledgedAlerts(),
    ]);

    return NextResponse.json({
      success: true,
      alerts,
      counts,
    });
  } catch (err) {
    console.error("GET /api/security/alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load security alerts" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/security/alerts
 *   body: { alertId, note? }
 * Marks a SecurityAlert as acknowledged by the current admin.
 */
export async function POST(request: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser.isAuthenticated) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { alertId?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const alertId = typeof body.alertId === "string" ? body.alertId : "";
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!alertId) {
    return NextResponse.json(
      { success: false, error: "alertId required" },
      { status: 400 },
    );
  }

  try {
    const updated = await acknowledgeSecurityAlert(
      alertId,
      adminUser.adminId ?? adminUser.email ?? "admin",
      note,
    );
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, alert: updated });
  } catch (err) {
    console.error("POST /api/security/alerts failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge alert" },
      { status: 500 },
    );
  }
}
