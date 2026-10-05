import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { verifyAdminPassword } from "@/lib/admin/verify-admin-password";

/**
 * POST /api/admin/verify-password
 * Verify admin password for sensitive operations.
 *
 * Reason: Password is verified against the logged-in admin's hash stored in
 * MongoDB (not the ADMIN_PASSWORD env var). This ensures that after a password
 * change, all sensitive-operation confirmations use the current password.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdminAuth();

    const { password } = await request.json();

    const check = await verifyAdminPassword(auth.adminId as string, password);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, message: check.message },
        { status: check.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password verified",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ Error verifying password:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify password",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
