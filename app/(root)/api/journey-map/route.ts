import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

/**
 * GET /api/journey-map
 * Get the journey map configuration (public read)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get("mapId") || "traders_journey";

    const mapConfig = await JourneyMapConfig.findOne({ mapId, isActive: true }).lean();

    if (!mapConfig) {
      return NextResponse.json({
        success: false,
        error: "Map not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      mapConfig,
    });
  } catch (error) {
    console.error("Error fetching journey map:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journey map" },
      { status: 500 }
    );
  }
}
