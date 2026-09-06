import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserLevel from "@/database/models/user-level.model";

/**
 * GET /api/user-level
 * Get user's current level and XP
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get or create user level
    let userLevel = await UserLevel.findOne({ userId }).lean();

    if (!userLevel) {
      // Create default level 1
      userLevel = await UserLevel.create({
        userId,
        currentXP: 0,
        currentLevel: 1,
        lifetimeXP: 0,
      });
    }

    return NextResponse.json({
      success: true,
      userLevel: {
        currentLevel: (userLevel as any).currentLevel || 1,
        currentXP: (userLevel as any).currentXP || 0,
        lifetimeXP: (userLevel as any).lifetimeXP || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user level:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user level" },
      { status: 500 }
    );
  }
}
