import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { completeWithdrawal } from "@/lib/services/withdrawal.service";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/withdrawals/[id]/complete
 * Mark a withdrawal as completed after admin has transferred money
 *
 * Call this AFTER you have manually transferred money to the user's bank account
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

    // Optional: bank transfer reference from admin
    let bankTransferReference: string | undefined;
    try {
      const body = await request.json();
      bankTransferReference = body.bankTransferReference;
    } catch {
      // No body provided, that's ok
    }

    await connectToDatabase();

    const result = await completeWithdrawal(
      id,
      guard.admin.id,
      guard.admin.email,
      bankTransferReference,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal marked as completed - User has been notified",
      payoutId: result.payoutId,
      status: result.status,
    });
  } catch (error) {
    console.error("Error completing withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete withdrawal" },
      { status: 500 },
    );
  }
}
