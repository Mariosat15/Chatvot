import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  GENERIC_ERROR,
  detachAffiliation,
  moveAffiliation,
  type AdminAffiliationResult,
} from "@/lib/services/gamemaster/admin-affiliation.service";

/**
 * POST /api/gamemasters/referred-players/[userId]
 * Body: { action: "move", targetSubscriptionId, reason } | { action: "detach", reason }
 *
 * The audited admin reassignment of owner decision D1 (`External game plans/24` s7.3).
 * Reason: granted by `gamemaster-management`, the section owning the screen it is pressed on.
 * Written to BOTH audit stores: the customer audit trail (by the service, so it travels with
 * the change) and the system audit log here, which the Audit Logs screen reads.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await guardSection("gamemaster-management");
  if (!guard.ok) return guard.response;

  try {
    const { userId } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = body?.action;
    if (action !== "move" && action !== "detach") {
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
    }

    await connectToDatabase();
    const actor = {
      id: guard.admin.id,
      email: guard.admin.email,
      name: guard.admin.name ?? guard.admin.email.split("@")[0],
      role: guard.admin.role ?? "admin",
    };
    const common = {
      userId,
      reason: typeof body?.reason === "string" ? body.reason : "",
      actor,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    };

    const result: AdminAffiliationResult =
      action === "move"
        ? await moveAffiliation({
            ...common,
            targetSubscriptionId:
              typeof body?.targetSubscriptionId === "string" ? body.targetSubscriptionId : "",
          })
        : await detachAffiliation(common);

    if (!result.success) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.error },
        { status: result.code === "error" ? 500 : 400 },
      );
    }

    try {
      await auditLogService.logSystemAction(
        actor,
        action === "move" ? "gm_affiliation_moved" : "gm_affiliation_detached",
        action === "move"
          ? `Moved player ${userId} from Game Master ${result.fromGameMasterId} to ${result.toGameMasterId}`
          : `Detached player ${userId} from Game Master ${result.fromGameMasterId}`,
        {
          userId,
          fromGameMasterId: result.fromGameMasterId,
          toGameMasterId: result.toGameMasterId,
          endedReferralId: result.endedReferralId,
          referralId: result.referralId,
          reason: common.reason.trim(),
        },
      );
    } catch (error) {
      console.warn("⚠️ Admin affiliation system audit entry not written:", error);
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("❌ Admin affiliation route failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
