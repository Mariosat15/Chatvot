import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { clearLoginLockouts } from "@/lib/services/login-lockout-clear";

/**
 * POST /api/lockouts/[email]/unlock - Unlock an account
 * This clears database lockouts AND calls main app to clear in-memory lockouts
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  try {
    const guard = await guardSection("fraud");
    if (!guard.ok) return guard.response;
    const session = guard.admin;

    const { email } = await params;
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const lockoutsCleared = await clearLoginLockouts(
      decodedEmail,
      session.id,
      reason || "Admin manual unlock",
    );

    // Create audit log
    const AuditLog = (await import("@/database/models/audit-log.model"))
      .default;
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: "account_unlock",
      actionCategory: "security",
      description: `Unlocked account: ${decodedEmail}`,
      targetType: "user",
      targetId: decodedEmail,
      metadata: { reason, lockoutsCleared },
      status: "success",
    });

    console.log(
      `🔓 [Admin] Account unlocked: ${decodedEmail} by ${session.email} (${lockoutsCleared} lockouts cleared)`,
    );

    return NextResponse.json({
      success: true,
      message: `Account unlocked successfully`,
      lockoutsCleared,
    });
  } catch (error) {
    console.error("Error unlocking account:", error);
    return NextResponse.json(
      { error: "Failed to unlock account" },
      { status: 500 },
    );
  }
}
