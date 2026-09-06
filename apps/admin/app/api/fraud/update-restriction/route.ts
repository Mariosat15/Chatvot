import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";
import { Admin } from "@/database/models/admin.model";
import bcrypt from "bcryptjs";

/**
 * PUT /api/admin/fraud/update-restriction
 * Update a user restriction
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminAuth();

    const {
      restrictionId,
      reason,
      customReason,
      canTrade,
      canEnterCompetitions,
      canDeposit,
      canWithdraw,
      hideFromPublic,
      expiresAt,
      adminPassword,
    } = await request.json();

    console.log("✏️ Update restriction request:", {
      restrictionId,
      reason,
      hasPassword: !!adminPassword,
    });

    if (!restrictionId) {
      return NextResponse.json(
        { success: false, message: "Restriction ID required" },
        { status: 400 },
      );
    }

    if (!adminPassword) {
      return NextResponse.json(
        { success: false, message: "Admin password required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Reason: Verify against the logged-in admin's DB password, not the env var,
    // so password changes take effect immediately for all sensitive operations.
    const admin = await Admin.findById(auth.adminId).select("password");
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin account not found" },
        { status: 404 },
      );
    }

    const isPasswordValid = await bcrypt.compare(adminPassword, admin.password);
    if (!isPasswordValid) {
      console.error("❌ Invalid admin password");
      return NextResponse.json(
        { success: false, message: "Invalid admin password" },
        { status: 401 },
      );
    }

    // Find and update the restriction
    const restriction = await UserRestriction.findById(restrictionId);

    if (!restriction) {
      console.error(`❌ Restriction not found: ${restrictionId}`);
      return NextResponse.json(
        {
          success: false,
          message: "Restriction not found",
        },
        { status: 404 },
      );
    }

    // Update fields
    restriction.reason = reason;
    restriction.customReason = customReason;
    restriction.canTrade = canTrade;
    restriction.canEnterCompetitions = canEnterCompetitions;
    restriction.canDeposit = canDeposit;
    restriction.canWithdraw = canWithdraw;
    if (hideFromPublic !== undefined) {
      restriction.hideFromPublic = hideFromPublic;
    }

    if (expiresAt) {
      restriction.expiresAt = new Date(expiresAt);
    } else {
      restriction.expiresAt = undefined;
    }

    await restriction.save();

    // Invalidate leaderboard cache when hideFromPublic changed
    if (hideFromPublic !== undefined) {
      try {
        const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await fetch(`${mainAppUrl}/api/leaderboard/invalidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: process.env.INTERNAL_API_SECRET || "simulator-cleanup" }),
        });
      } catch {
        // Cache will expire naturally in 5 min
      }
    }

    console.log(
      `✅ Updated restriction ${restrictionId} for user ${restriction.userId}`,
    );

    return NextResponse.json({
      success: true,
      message: "Restriction updated successfully",
      restriction,
    });
  } catch (error) {
    console.error("Error updating restriction:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update restriction",
      },
      { status: 500 },
    );
  }
}
