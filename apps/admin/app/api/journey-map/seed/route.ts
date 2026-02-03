import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import { DEFAULT_MAP_CONFIG, DEFAULT_MILESTONES } from "@/lib/constants/journey-map-template";

/**
 * Seed the default journey map and milestones
 */
async function seedJourneyMap() {
  await connectToDatabase();

  console.log("🗺️ [SEED] Starting journey map seed...");

  // Check if map already exists
  const existingMap = await JourneyMapConfig.findOne({ mapId: DEFAULT_MAP_CONFIG.mapId });
  
  if (existingMap) {
    // Update existing map
    await JourneyMapConfig.findOneAndUpdate(
      { mapId: DEFAULT_MAP_CONFIG.mapId },
      {
        ...DEFAULT_MAP_CONFIG,
        $inc: { version: 1 },
      }
    );
    console.log("📝 [SEED] Updated existing map configuration");
  } else {
    // Create new map
    await JourneyMapConfig.create(DEFAULT_MAP_CONFIG);
    console.log("✨ [SEED] Created new map configuration");
  }

  // Upsert all milestones
  let created = 0;
  let updated = 0;

  for (const milestone of DEFAULT_MILESTONES) {
    const existing = await JourneyMilestone.findOne({ id: milestone.id });
    
    if (existing) {
      await JourneyMilestone.findOneAndUpdate(
        { id: milestone.id },
        { ...milestone, isActive: true }
      );
      updated++;
    } else {
      await JourneyMilestone.create({
        ...milestone,
        mapId: DEFAULT_MAP_CONFIG.mapId,
        isActive: true,
      });
      created++;
    }
  }

  console.log(`✅ [SEED] Complete: ${created} milestones created, ${updated} updated`);

  return {
    mapId: DEFAULT_MAP_CONFIG.mapId,
    mapName: DEFAULT_MAP_CONFIG.name,
    zonesCount: DEFAULT_MAP_CONFIG.zones.length,
    milestonesCreated: created,
    milestonesUpdated: updated,
    totalMilestones: DEFAULT_MILESTONES.length,
  };
}

/**
 * GET /api/journey-map/seed
 * Seed the journey map (accessible via browser for easy seeding)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await seedJourneyMap();

    return NextResponse.json({
      success: true,
      message: "Journey map seeded successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error seeding journey map:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to seed journey map",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journey-map/seed
 * Seed the journey map (POST method)
 */
export async function POST(request: NextRequest) {
  try {
    const result = await seedJourneyMap();

    return NextResponse.json({
      success: true,
      message: "Journey map seeded successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error seeding journey map:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to seed journey map",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journey-map/seed
 * Reset the journey map (delete all milestones and map config)
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();

    const mapId = DEFAULT_MAP_CONFIG.mapId;

    // Delete all milestones for this map
    const milestoneResult = await JourneyMilestone.deleteMany({ mapId });
    
    // Delete the map config
    const mapResult = await JourneyMapConfig.deleteOne({ mapId });

    return NextResponse.json({
      success: true,
      message: "Journey map reset successfully",
      milestonesDeleted: milestoneResult.deletedCount,
      mapDeleted: mapResult.deletedCount > 0,
    });
  } catch (error) {
    console.error("Error resetting journey map:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to reset journey map"
      },
      { status: 500 }
    );
  }
}
