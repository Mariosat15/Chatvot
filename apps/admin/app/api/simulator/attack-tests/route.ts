/**
 * Admin-gated Attack Suite kickoff / status endpoint.
 *
 * POST /api/simulator/attack-tests   { action: "start" }   → spawns the suite
 * POST /api/simulator/attack-tests   { action: "cleanup-all" } → wipes test state
 * GET  /api/simulator/attack-tests?runId=...                → run status
 * GET  /api/simulator/attack-tests                          → list recent runs
 *
 * Layers 6 + 7 of the 7-layer defense live here:
 *   - `requireAdminAuth()` ensures only admins can trigger a run
 *   - every start is written to the audit log with the admin identity
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminAuth,
  getAdminSession,
} from "../../../../../../lib/admin/auth";
import { auditLogService } from "../../../../../../lib/services/audit-log.service";
import {
  createAttackRun,
  runAttackSuite,
} from "../../../../../../lib/services/simulator/attack-tests/runner";
import AttackRun from "../../../../../../database/models/simulator/attack-run.model";
import { connectToDatabase } from "../../../../../../database/mongoose";
import {
  getAttackSuiteSecret,
  getPublicAttackSuiteConfig,
  isAttackSuiteEnabled,
} from "../../../../../../lib/services/simulator/attack-suite-config.service";

export const dynamic = "force-dynamic";

function resolveMainAppUrl(): string {
  let baseUrl = process.env.MAIN_APP_URL || "http://localhost:3000";
  if (
    baseUrl.includes("://localhost:") ||
    baseUrl.includes("://localhost/") ||
    baseUrl === "http://localhost"
  ) {
    baseUrl = baseUrl.replace("://localhost", "://127.0.0.1");
  }
  return baseUrl;
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

  const enabled = await isAttackSuiteEnabled();
  if (!enabled) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Attack Suite is disabled. Enable it and rotate a secret from the Configuration card before running.",
      },
      { status: 403 },
    );
  }

  const secret = await getAttackSuiteSecret();
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Attack Suite secret is not configured. Click 'Rotate Secret' in the Configuration card first.",
      },
      { status: 500 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = typeof body.action === "string" ? body.action : "start";

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Admin session missing" },
      { status: 401 },
    );
  }

  const baseUrl = resolveMainAppUrl();

  if (action === "cleanup-all") {
    // Force-cleanup any lingering sim-attack-* data. Useful after a crashed run.
    try {
      await auditLogService.log({
        admin: { id: admin.id, email: admin.email, name: admin.name },
        action: "attack_test.cleanup_all",
        category: "security",
        description: "Admin triggered full attack-suite cleanup sweep",
        targetType: "system",
        status: "success",
      });
      const res = await fetch(`${baseUrl}/api/simulator/attack/cleanup`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-simulator-attack-secret": secret,
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ all: true }),
      });
      const payload = await res.json().catch(() => ({}));
      return NextResponse.json({ success: res.ok, payload });
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "cleanup failed",
        },
        { status: 500 },
      );
    }
  }

  if (action !== "start") {
    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 },
    );
  }

  // Block concurrent runs — two attack suites in flight would corrupt each
  // other's decline-velocity counters and produce noisy logs.
  await connectToDatabase();
  const inFlight = await AttackRun.findOne({
    status: { $in: ["pending", "running"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (inFlight) {
    return NextResponse.json(
      {
        success: false,
        error: "An attack run is already in progress",
        runId: (inFlight as { _id: unknown })._id?.toString?.(),
      },
      { status: 409 },
    );
  }

  const run = await createAttackRun({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  });
  const runId = run._id.toString();

  await auditLogService.log({
    admin: { id: admin.id, email: admin.email, name: admin.name },
    action: "attack_test.started",
    category: "security",
    description: `Admin started card-testing attack suite (runId=${runId})`,
    targetType: "system",
    targetId: runId,
    metadata: { baseUrl, runId },
    status: "success",
  });

  // Fire and forget — the runner persists its own progress into AttackRun.
  // Any throw is caught and logged inside runAttackSuite.
  void runAttackSuite({ runId, baseUrl, attackSecret: secret }).catch(
    async (err) => {
      console.error("Attack suite crashed outside runner:", err);
      try {
        await AttackRun.findByIdAndUpdate(runId, {
          status: "failed",
          endTime: new Date(),
          $push: {
            logs: {
              timestamp: new Date(),
              level: "error",
              message: `Fatal: ${err instanceof Error ? err.message : String(err)}`,
            },
          },
        });
      } catch {
        // Best effort
      }
    },
  );

  return NextResponse.json({ success: true, runId });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (runId) {
    const run = await AttackRun.findById(runId).lean();
    if (!run) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, run });
  }

  // List recent runs (sans logs to keep payload small)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "10"), 1),
    50,
  );
  const runs = await AttackRun.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-logs")
    .lean();

  const publicConfig = await getPublicAttackSuiteConfig();

  return NextResponse.json({
    success: true,
    runs,
    enabled: publicConfig.enabled,
    secretConfigured: publicConfig.secretSet,
    config: publicConfig,
  });
}
