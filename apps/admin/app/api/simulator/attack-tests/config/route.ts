/**
 * Admin-gated Attack Suite configuration endpoint.
 *
 * GET  /admin/api/simulator/attack-tests/config           → returns public config (no raw secret)
 * POST /admin/api/simulator/attack-tests/config           → mutate config
 *   body: { action: "enable" | "disable" | "rotate" | "revoke" }
 *
 * The raw secret is returned exactly once, on a successful `rotate`, so the
 * admin can copy it to a password manager if they ever need to debug from
 * curl. Subsequent GETs only return a masked preview.
 *
 * Security:
 *   - `requireAdminAuth()` enforces admin JWT
 *   - every mutation is audit-logged under category "security"
 *   - rotating the secret while a run is in flight is blocked to avoid
 *     invalidating the in-process secret mid-run
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminAuth,
  getAdminSession,
} from "../../../../../../../lib/admin/auth";
import { auditLogService } from "../../../../../../../lib/services/audit-log.service";
import {
  clearAttackSuiteSecret,
  getPublicAttackSuiteConfig,
  rotateAttackSuiteSecret,
  setAttackSuiteEnabled,
} from "../../../../../../../lib/services/simulator/attack-suite-config.service";
import AttackRun from "../../../../../../../database/models/simulator/attack-run.model";
import { connectToDatabase } from "../../../../../../../database/mongoose";

export const dynamic = "force-dynamic";

async function assertNoRunInFlight(): Promise<string | null> {
  await connectToDatabase();
  const inFlight = await AttackRun.findOne({
    status: { $in: ["pending", "running"] },
  })
    .select("_id")
    .lean();
  if (inFlight) {
    return (inFlight as { _id: unknown })._id?.toString?.() ?? "unknown";
  }
  return null;
}

export async function GET() {
  try {
    await requireAdminAuth();
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const config = await getPublicAttackSuiteConfig();
  return NextResponse.json({ success: true, config });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAuth();
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Admin session missing" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action : "";
  const adminInfo = { adminId: admin.id, email: admin.email, name: admin.name };
  const auditAdmin = { id: admin.id, email: admin.email, name: admin.name };

  try {
    if (action === "enable" || action === "disable") {
      const next = action === "enable";

      // Refuse to enable without a configured secret
      if (next) {
        const existing = await getPublicAttackSuiteConfig();
        if (!existing.secretSet) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Cannot enable Attack Suite before a secret is configured. Click 'Rotate Secret' first.",
            },
            { status: 400 },
          );
        }
      }

      const config = await setAttackSuiteEnabled(next, adminInfo);
      await auditLogService.log({
        admin: auditAdmin,
        action: next ? "attack_test.enabled" : "attack_test.disabled",
        category: "security",
        description: `Admin ${next ? "enabled" : "disabled"} the Attack Suite`,
        targetType: "system",
        status: "success",
      });
      return NextResponse.json({ success: true, config });
    }

    if (action === "rotate") {
      const runningId = await assertNoRunInFlight();
      if (runningId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot rotate secret while an Attack Suite run is in progress.",
            runId: runningId,
          },
          { status: 409 },
        );
      }

      const { secret, config } = await rotateAttackSuiteSecret(adminInfo);
      await auditLogService.log({
        admin: auditAdmin,
        action: "attack_test.secret_rotated",
        category: "security",
        description: "Admin rotated the Attack Suite secret",
        targetType: "system",
        status: "success",
      });

      // Reason: returning the raw secret exactly once on rotate is the only
      // way the admin can copy it for out-of-band use (e.g. manual curl tests
      // from the same host). The UI treats this like a one-time reveal.
      return NextResponse.json({ success: true, secret, config });
    }

    if (action === "revoke") {
      const runningId = await assertNoRunInFlight();
      if (runningId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot revoke secret while an Attack Suite run is in progress.",
            runId: runningId,
          },
          { status: 409 },
        );
      }

      const config = await clearAttackSuiteSecret(adminInfo);
      await auditLogService.log({
        admin: auditAdmin,
        action: "attack_test.secret_revoked",
        category: "security",
        description: "Admin revoked the Attack Suite secret (forces disabled)",
        targetType: "system",
        status: "success",
      });
      return NextResponse.json({ success: true, config });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (err) {
    console.error("attack-tests config mutation failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Something went wrong",
      },
      { status: 500 },
    );
  }
}
