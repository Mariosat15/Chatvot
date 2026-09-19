import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";

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

    if (!password) {
      return NextResponse.json(
        { success: false, message: "Password is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const admin = await Admin.findById(auth.adminId).select("password");

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin account not found" },
        { status: 404 },
      );
    }

    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid password" },
        { status: 401 },
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
