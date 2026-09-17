import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";

/** Maps the owner does not want on the player carousel — blank or legacy. */
const HIDDEN_MAP_IDS = new Set(["platform_journey", "getting_started"]);
const HIDDEN_MAP_NAMES = new Set(["getting started"]);

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const whitelabelId = searchParams.get("whitelabelId");

    // Build query based on whitelabel
    const query: Record<string, unknown> = { isActive: true };
    if (whitelabelId) {
      query.whitelabelId = whitelabelId;
    }

    // Fetch all maps sorted by sequence order
    const maps = await JourneyMapConfig.find(query)
      .sort({ sequenceOrder: 1 })
      .select([
        "_id",
        "mapId",
        "name",
        "description",
        "theme",
        "sequenceOrder",
        "difficulty",
        "estimatedXP",
        "previousMapId",
        "nextMapId",
        "zones",
        "backgroundColor",
        "backgroundImage",
        "totalMilestones",
        "requiredLevelToStart",
        "completionRequirement",
      ])
      .lean();

    // Reason: a map with zero milestone rows renders as a blank canvas while
    // the carousel still offers it (Getting Started after R103). Count real
    // rows rather than trusting `totalMilestones`, which a bad write can leave
    // at 12 with nothing stored underneath.
    const mapIds = maps
      .map((m) => m.mapId)
      .filter((id): id is string => typeof id === "string");
    const counts = await JourneyMilestone.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { mapId: { $in: mapIds }, isActive: { $ne: false } } },
      { $group: { _id: "$mapId", count: { $sum: 1 } } },
    ]);
    const countByMap = new Map(counts.map((c) => [c._id, c.count]));

    const visible = maps.filter((m) => {
      const id = typeof m.mapId === "string" ? m.mapId : "";
      const name =
        typeof m.name === "string" ? m.name.trim().toLowerCase() : "";
      if (HIDDEN_MAP_IDS.has(id) || HIDDEN_MAP_NAMES.has(name)) return false;
      return (countByMap.get(id) ?? 0) > 0;
    });

    return NextResponse.json({
      success: true,
      maps: visible,
      totalMaps: visible.length,
    });
  } catch (error) {
    console.error("Error fetching map sequence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch map sequence" },
      { status: 500 }
    );
  }
}
