import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import { getUserJourneyProgress, checkAndCompleteMilestones } from "@/lib/services/journey-progress.service";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";

/**
 * GET /api/journey-progress
 * Get user journey progress
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");
    const mapId = searchParams.get("mapId") || "traders_journey";

    // If no userId provided, try to get from session
    if (!userId) {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session?.user?.id) {
        userId = session.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    const data = await getUserJourneyProgress(userId, mapId);

    return NextResponse.json({
      success: true,
      progress: data.progress,
      mapConfig: data.mapConfig,
      milestones: data.milestones,
      completedIds: data.completedIds,
      unlockedIds: data.unlockedIds,
    });
  } catch (error) {
    console.error("Error fetching journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey progress" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journey-progress
 * Check and complete milestones for current user
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Get mapId from request body if provided
    let mapId = "traders_journey";
    try {
      const body = await request.json();
      if (body.mapId) {
        mapId = body.mapId;
      }
    } catch {
      // No body or invalid JSON, use default mapId
    }

    // Check and complete any eligible milestones (also checks unlocks first)
    const result = await checkAndCompleteMilestones(userId, mapId);

    return NextResponse.json({
      success: true,
      completed: result.completed,
      unlocked: result.unlocked,
      totalXPEarned: result.totalXPEarned,
    });
  } catch (error) {
    console.error("Error checking milestones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check milestones" },
      { status: 500 }
    );
  }
}
