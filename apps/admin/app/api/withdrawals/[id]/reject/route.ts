import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { rejectWithdrawal } from "@/lib/services/withdrawal.service";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/withdrawals/[id]/reject
 * Reject a withdrawal request and refund credits to user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Reason: PendingWithdrawalsSection owns this screen; section grant is the auth answer.
    const guard = await guardSection("pending-withdrawals");
    if (!guard.ok) return guard.response;

    const { id } = await params;

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Rejection reason is required (min 3 characters)",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const result = await rejectWithdrawal(
      id,
      guard.admin.id,
      guard.admin.email,
      reason.trim(),
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal rejected - Credits refunded to user",
      withdrawal: result.withdrawal,
    });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject withdrawal" },
      { status: 500 },
    );
  }
}
