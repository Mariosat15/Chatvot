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

    // Get milestones for counting (need both _id and custom id field)
    const milestones = await JourneyMilestone.find({
      ...(whitelabelId ? { whitelabelId } : {}),
      isActive: true,
    })
      .select(["_id", "id", "mapId"])
      .lean();

    // Extract completed milestone IDs (handle both formats: string array or object array)
    const completedMilestoneIds: string[] = [];
    if (Array.isArray(userProgress.completedMilestones)) {
      for (const item of userProgress.completedMilestones) {
        if (typeof item === "string") {
          completedMilestoneIds.push(item);
        } else if (item && typeof item === "object" && item.milestoneId) {
          completedMilestoneIds.push(item.milestoneId);
        }
      }
    }

    // Build progress per map
    const mapProgress = maps.map((map: any) => {
      const mapMilestones = milestones.filter((m: any) => m.mapId === map.mapId);
      
      // Match by custom id field OR _id
      const completedInMap = completedMilestoneIds.filter((completedId) =>
        mapMilestones.some((m: any) => 
          m.id === completedId || 
          m._id?.toString() === completedId ||
          completedId.includes(m.id)
        )
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

    // Format completed milestones for frontend (always as objects)
    const formattedCompletedMilestones = (userProgress.completedMilestones || []).map((item: any) => {
      if (typeof item === "string") {
        return { milestoneId: item, completedAt: new Date(), rewards: { xp: 0 } };
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      currentMapIndex: userProgress.currentMapIndex || currentMapIndex,
      mapProgress,
      totalXP: userProgress.totalXPFromJourney || userProgress.allMapsXP || userProgress.totalXP || 0,
      mapsCompleted: userProgress.totalMapsCompleted || mapProgress.filter((p: any) => p.isComplete).length,
      completedMilestones: formattedCompletedMilestones,
      unlockedMilestones: userProgress.unlockedMilestones || [],
      currentMilestone: userProgress.currentMilestone || "",
      journeyStartedAt: userProgress.journeyStartedAt,
      lastProgressAt: userProgress.lastProgressAt,
    });
  } catch (error) {
    console.error("Error fetching user journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey progress" },
      { status: 500 }
    );
  }
}
