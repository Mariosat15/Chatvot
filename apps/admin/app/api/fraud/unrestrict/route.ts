import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";
import { Admin } from "@/database/models/admin.model";
import { invalidateLeaderboardCache } from "../../../../../../lib/services/leaderboard-cache.invalidator";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/fraud/unrestrict
 * Unrestrict users (unban/unsuspend)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth();

    const { userIds, adminPassword } = await request.json();

    console.log("🔓 Unrestrict request:", {
      userIds,
      hasPassword: !!adminPassword,
    });

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "User IDs required (must be an array)" },
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
      return NextResponse.json(
        { success: false, message: "Invalid admin password" },
        { status: 401 },
      );
    }

    // Reason: checked BEFORE the update so we only bust the leaderboard
    // cache when we actually un-hid somebody. Keeps the happy-path HTTP
    // call off the hot path when admins are just clearing trade-blocks.
    const hadHiddenRestriction = await UserRestriction.exists({
      userId: { $in: userIds },
      isActive: true,
      hideFromPublic: true,
    });

    // Unrestrict all specified users by marking restrictions as inactive
    const result = await UserRestriction.updateMany(
      {
        userId: { $in: userIds },
        isActive: true,
      },
      {
        $set: { isActive: false },
        $currentDate: { updatedAt: true },
      },
    );

    console.log(`✅ Unrestricted ${result.modifiedCount} user(s): ${JSON.stringify(userIds)}`);

    if (result.modifiedCount > 0 && hadHiddenRestriction) {
      // Fire-and-forget; never block the response on cache invalidation.
      void invalidateLeaderboardCache();
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No active restrictions found for these users",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unrestricted ${result.modifiedCount} user(s)`,
      unrestrictedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Error unrestricting users:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
