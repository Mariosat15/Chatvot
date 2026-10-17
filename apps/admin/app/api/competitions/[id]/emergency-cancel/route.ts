import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { emergencyCancelActiveCompetition } from "@/lib/actions/trading/competition-cancel.actions";

/**
 * POST /api/competitions/[id]/emergency-cancel
 * Emergency cancel an active competition
 *
 * Body: { reason: string, useSnapshotId?: string }
 *
 * Guarded on the `competitions` SECTION. `verifyAdminAuth` answers only "is this an admin
 * token", so an employee granted one unrelated section could close every position and refund
 * every entrant of a live contest. Sixth instance of that class; see
 * `finalize-old-competitions/route.ts` for the list.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { id } = await params;
    const body = await request.json();
    const { reason, useSnapshotId } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        {
          error:
            "A detailed reason (at least 10 characters) is required for emergency cancellation",
        },
        { status: 400 },
      );
    }

    console.log(`🚨 [API] Emergency cancel request for competition ${id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Admin: ${admin.email}`);
    console.log(
      `   Snapshot ID: ${useSnapshotId || "none (using current prices)"}`,
    );

    // Get snapshot prices if specified
    let snapshotPrices: Map<string, { bid: number; ask: number }> | undefined;

    if (useSnapshotId) {
      // TODO: Fetch prices from snapshot when price snapshot system is implemented
      // For now, we'll use current prices
      console.log(
        `   ⚠️ Snapshot ID provided but snapshot system not yet implemented - using current prices`,
      );
    }

    // Perform emergency cancellation
    const result = await emergencyCancelActiveCompetition(
      id,
      reason.trim(),
      admin.id,
      snapshotPrices,
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        details: {
          closedPositions: result.closedPositions,
          // Reported so the confirmation can say what actually happened rather than
          // announcing it. A provider contest closes no positions and voids rounds instead,
          // and "0 positions closed" alone reads like the action failed.
          voidedRounds: result.voidedRounds,
          refundedCount: result.refundedCount,
          totalRefunded: result.totalRefunded,
        },
      });
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in emergency cancel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
