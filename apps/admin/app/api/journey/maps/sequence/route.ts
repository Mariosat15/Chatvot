import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import { guardSection } from "@/lib/admin/section-route-guard";

export async function GET(request: NextRequest) {
  try {
    const guard = await guardSection("journey-map");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
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
