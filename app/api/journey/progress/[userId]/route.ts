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

    // Retroactively check and complete milestones based on current user stats
    // This ensures past actions (e.g., winning trades before the fix) are recognized
    try {
      const { checkAndCompleteMilestones, getFirstActiveMapId } = await import("@/lib/services/journey-progress.service");
      const activeMapId = userProgress.mapId || await getFirstActiveMapId();
      // #region agent log
      const mapIdCounts: Record<string, number> = {};
      for (const m of milestones) { mapIdCounts[(m as any).mapId] = (mapIdCounts[(m as any).mapId] || 0) + 1; }
      fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'journey-progress-api:120',message:'JOURNEY DATA MISMATCH DEBUG',data:{userId,userProgressMapId:userProgress.mapId,resolvedMapId:activeMapId,mapConfigMapIds:maps.map((m:any)=>m.mapId),milestonesByMapId:mapIdCounts,completedMilestoneIds:completedMilestoneIds.slice(0,20),totalMaps:maps.length,totalMilestones:milestones.length},timestamp:Date.now(),hypothesisId:'HA-HB-HC',runId:'unified'})}).catch(()=>{});
      console.log(`🔍 [JOURNEY-RETRO] Triggering retroactive milestone check for user ${userId} mapId=${activeMapId}`);
      // #endregion
      const retroResult = await checkAndCompleteMilestones(userId, activeMapId);
      // #region agent log
      console.log(`🔍 [JOURNEY-RETRO] Result: completed=${JSON.stringify(retroResult.completed)} unlocked=${JSON.stringify(retroResult.unlocked)} xp=${retroResult.totalXPEarned}`);
      // #endregion
    } catch (err) {
      // Non-critical -- don't block page load
      console.warn("Failed to retroactively check milestones:", err);
    }

    // Re-fetch progress after retroactive check (it may have changed)
    const refreshedProgress = await UserJourneyProgress.findOne({ userId }).lean();
    const activeProgress = refreshedProgress || userProgress;

    // Calculate per-milestone progress for progress bars in the UI
    let milestoneProgressData: Array<{ milestoneId: string; currentValue: number; targetValue: number }> = [];
    try {
      const { calculateMilestoneProgress } = await import("@/lib/services/journey-progress.service");
      const { getFirstActiveMapId: getMapId } = await import("@/lib/services/journey-progress.service");
      milestoneProgressData = await calculateMilestoneProgress(userId, activeProgress.mapId || await getMapId());
    } catch (err) {
      // Non-critical -- fall back to empty progress
      console.warn("Failed to calculate milestone progress:", err);
    }

    // Re-extract completed milestones from refreshed data
    const finalCompletedMilestones = (activeProgress.completedMilestones || []).map((item: any) => {
      if (typeof item === "string") {
        return { milestoneId: item, completedAt: new Date(), rewards: { xp: 0 } };
      }
      return item;
    });

    // Re-extract completed IDs for map progress
    const finalCompletedIds: string[] = [];
    if (Array.isArray(activeProgress.completedMilestones)) {
      for (const item of activeProgress.completedMilestones) {
        if (typeof item === "string") {
          finalCompletedIds.push(item);
        } else if (item && typeof item === "object" && item.milestoneId) {
          finalCompletedIds.push(item.milestoneId);
        }
      }
    }

    // Rebuild map progress with refreshed data
    const finalMapProgress = maps.map((map: any) => {
      const mapMilestones = milestones.filter((m: any) => m.mapId === map.mapId);
      const completedInMap = finalCompletedIds.filter((completedId) =>
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
          activeProgress.completedMaps?.includes(map.mapId) ||
          (completedInMap.length > 0 && completedInMap.length >= mapMilestones.length),
      };
    });

    return NextResponse.json({
      success: true,
      currentMapIndex: activeProgress.currentMapIndex || currentMapIndex,
      mapProgress: finalMapProgress,
      totalXP: activeProgress.totalXPFromJourney || activeProgress.allMapsXP || activeProgress.totalXP || 0,
      mapsCompleted: activeProgress.totalMapsCompleted || finalMapProgress.filter((p: any) => p.isComplete).length,
      completedMilestones: finalCompletedMilestones,
      unlockedMilestones: activeProgress.unlockedMilestones || [],
      currentMilestone: activeProgress.currentMilestone || "",
      journeyStartedAt: activeProgress.journeyStartedAt,
      lastProgressAt: activeProgress.lastProgressAt,
      milestoneProgress: milestoneProgressData,
    });
  } catch (error) {
    console.error("Error fetching user journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey progress" },
      { status: 500 }
    );
  }
}
