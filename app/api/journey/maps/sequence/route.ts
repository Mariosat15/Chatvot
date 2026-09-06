import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

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

    return NextResponse.json({
      success: true,
      maps,
      totalMaps: maps.length,
    });
  } catch (error) {
    console.error("Error fetching map sequence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch map sequence" },
      { status: 500 }
    );
  }
}
