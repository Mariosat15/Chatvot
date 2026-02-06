import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/database/mongoose";
import { JourneyMilestone } from "@/database/models/journey-milestone.model";
import { JourneyMapConfig } from "@/database/models/journey-map-config.model";

interface RouteParams {
  params: Promise<{ mapId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const { mapId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const whitelabelId = searchParams.get("whitelabelId");

    if (!mapId) {
      return NextResponse.json(
        { success: false, error: "Map ID is required" },
        { status: 400 }
      );
    }

    // Get map config
    const mapQuery: Record<string, unknown> = { mapId, isActive: true };
    if (whitelabelId) {
      mapQuery.whitelabelId = whitelabelId;
    }

    const mapConfig = await JourneyMapConfig.findOne(mapQuery).lean();

    if (!mapConfig) {
      return NextResponse.json(
        { success: false, error: "Map not found" },
        { status: 404 }
      );
    }

    // Get milestones for this map
    const milestoneQuery: Record<string, unknown> = { mapId, isActive: true };
    if (whitelabelId) {
      milestoneQuery.whitelabelId = whitelabelId;
    }

    const milestones = await JourneyMilestone.find(milestoneQuery)
      .sort({ orderInMap: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      mapConfig,
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
