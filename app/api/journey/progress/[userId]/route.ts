import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();

    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const whitelabelId = searchParams.get("whitelabelId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user's journey progress
    const userProgress = await UserJourneyProgress.findOne({ userId }).lean();

    if (!userProgress) {
      // Return default progress if no record exists
      return NextResponse.json({
        success: true,
        currentMapIndex: 1,
        mapProgress: [],
        totalXP: 0,
        mapsCompleted: 0,
      });
    }

    // Build query for maps
    const mapQuery: Record<string, unknown> = { isActive: true };
    if (whitelabelId) {
      mapQuery.whitelabelId = whitelabelId;
    }

    // Get all maps to build progress info
    const maps = await JourneyMapConfig.find(mapQuery)
      .sort({ sequenceOrder: 1 })
      .select(["mapId", "sequenceOrder", "totalMilestones"])
      .lean();

    // Get milestones for counting
    const milestones = await JourneyMilestone.find({
      ...(whitelabelId ? { whitelabelId } : {}),
    })
      .select(["_id", "mapId"])
      .lean();

    // Build progress per map
    const mapProgress = maps.map((map) => {
      const mapMilestones = milestones.filter((m) => m.mapId === map.mapId);
      const completedInMap = userProgress.completedMilestones.filter(
        (id: string) => mapMilestones.some((m) => m._id.toString() === id)
      );

      return {
        mapId: map.mapId,
        sequenceOrder: map.sequenceOrder,
        totalMilestones: mapMilestones.length || map.totalMilestones || 0,
        completedMilestones: completedInMap,
        isComplete:
          userProgress.completedMaps?.includes(map.mapId) ||
          (completedInMap.length > 0 &&
            completedInMap.length >= mapMilestones.length),
      };
    });

    // Determine current map based on progress
    let currentMapIndex = 1;
    for (const progress of mapProgress) {
      if (!progress.isComplete) {
        currentMapIndex = progress.sequenceOrder;
        break;
      }
      currentMapIndex = progress.sequenceOrder + 1;
    }

    // Cap at max maps
    if (currentMapIndex > maps.length) {
      currentMapIndex = maps.length;
    }

    return NextResponse.json({
      success: true,
      currentMapIndex: userProgress.currentMapIndex || currentMapIndex,
      mapProgress,
      totalXP: userProgress.allMapsXP || userProgress.totalXP || 0,
      mapsCompleted: userProgress.totalMapsCompleted || mapProgress.filter((p) => p.isComplete).length,
      completedMilestones: userProgress.completedMilestones || [],
      unlockedMilestones: userProgress.unlockedMilestones || [],
    });
  } catch (error) {
    console.error("Error fetching user journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey progress" },
      { status: 500 }
    );
  }
}
