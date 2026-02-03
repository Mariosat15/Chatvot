import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";

/**
 * GET /api/journey-milestones
 * Get all milestones for a map (public read)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get("mapId") || "traders_journey";
    const zoneId = searchParams.get("zoneId");

    // Build query
    const query: any = { mapId, isActive: true };
    if (zoneId) query.zoneId = zoneId;

    const milestones = await JourneyMilestone.find(query)
      .sort({ order: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      milestones,
      total: milestones.length,
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch milestones" },
      { status: 500 }
    );
  }
}
