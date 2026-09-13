import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

interface RouteParams {
  params: Promise<{ mapId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();

    const { mapId } = await params;

    if (!mapId) {
      return NextResponse.json(
        { success: false, error: "Map ID is required" },
        { status: 400 }
      );
    }

    // Get map config
    const mapConfig = await JourneyMapConfig.findOne({ mapId }).lean();

    // Get milestones for this map
    const milestones = await JourneyMilestone.find({ mapId, isActive: true })
      .sort({ order: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      mapConfig: mapConfig || null,
      milestones,
      totalMilestones: milestones.length,
    });
  } catch (error) {
    console.error("Error fetching map milestones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch map milestones" },
      { status: 500 }
    );
  }
}
