import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import { DEFAULT_MAP_CONFIG, DEFAULT_MILESTONES } from "@/lib/constants/journey-map-template";

/**
 * @deprecated — Use the Gamification Wizard to generate milestones instead.
 * This seeds from the LEGACY traders_journey template.
 * The wizard uses milestone-blueprint.ts as the single source of truth.
 */
async function seedJourneyMap() {
  await connectToDatabase();

  console.log("🗺️ [SEED] Starting journey map seed...");
  console.log("📦 [SEED] Map config:", DEFAULT_MAP_CONFIG.mapId);
  console.log("📦 [SEED] Milestones count:", DEFAULT_MILESTONES.length);

  // Delete ALL existing milestones for this map first
  const deleteResult = await JourneyMilestone.deleteMany({ mapId: DEFAULT_MAP_CONFIG.mapId });
  console.log(`🗑️ [SEED] Deleted ${deleteResult.deletedCount} existing milestones`);

  // Check if map already exists
  const existingMap = await JourneyMapConfig.findOne({ mapId: DEFAULT_MAP_CONFIG.mapId });
  
  if (existingMap) {
    // Update existing map
    await JourneyMapConfig.findOneAndUpdate(
      { mapId: DEFAULT_MAP_CONFIG.mapId },
      {
        name: DEFAULT_MAP_CONFIG.name,
        description: DEFAULT_MAP_CONFIG.description,
        zones: DEFAULT_MAP_CONFIG.zones,
        defaultStartNode: DEFAULT_MAP_CONFIG.defaultStartNode,
        backgroundColor: DEFAULT_MAP_CONFIG.backgroundColor,
        backgroundImage: DEFAULT_MAP_CONFIG.backgroundImage,
        isActive: DEFAULT_MAP_CONFIG.isActive,
        $inc: { version: 1 },
      }
    );
    console.log("📝 [SEED] Updated existing map configuration");
  } else {
    // Create new map
    await JourneyMapConfig.create({
      mapId: DEFAULT_MAP_CONFIG.mapId,
      name: DEFAULT_MAP_CONFIG.name,
      description: DEFAULT_MAP_CONFIG.description,
      zones: DEFAULT_MAP_CONFIG.zones,
      defaultStartNode: DEFAULT_MAP_CONFIG.defaultStartNode,
      backgroundColor: DEFAULT_MAP_CONFIG.backgroundColor,
      backgroundImage: DEFAULT_MAP_CONFIG.backgroundImage,
      isActive: DEFAULT_MAP_CONFIG.isActive,
      version: 1,
    });
    console.log("✨ [SEED] Created new map configuration");
  }

  // Drop the legacy global unique index on `id` if it exists.
  // The new schema uses a compound unique index on { id, mapId } instead.
  try {
    const collection = JourneyMilestone.collection;
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find(
      (idx: any) => idx.key && idx.key.id === 1 && !idx.key.mapId && idx.unique
    );
    if (legacyIndex) {
      await collection.dropIndex(legacyIndex.name!);
      console.log(`🔧 [SEED] Dropped legacy unique index "${legacyIndex.name}" on id field`);
    }
  } catch (indexErr) {
    // Index may not exist or already dropped — safe to ignore
    console.log("ℹ️ [SEED] No legacy id index to drop (or already removed)");
  }

  // Create all milestones fresh (upsert to avoid duplicate key errors)
  let created = 0;

  for (const milestone of DEFAULT_MILESTONES) {
    try {
      const milestoneData = {
        id: milestone.id,
        mapId: DEFAULT_MAP_CONFIG.mapId,
        name: milestone.name,
        description: milestone.description,
        shortDescription: milestone.shortDescription,
        zoneId: milestone.zoneId,
        position: milestone.position,
        nodeType: milestone.nodeType,
        icon: milestone.icon,
        color: milestone.color,
        size: milestone.size,
        unlockCondition: milestone.unlockCondition,
        completeCondition: milestone.completeCondition,
        rewards: milestone.rewards,
        connectedTo: milestone.connectedTo,
        connectedFrom: milestone.connectedFrom,
        isRequired: milestone.isRequired,
        isAutoComplete: milestone.isAutoComplete,
        order: milestone.order,
        tooltipText: milestone.tooltipText,
        celebrationText: milestone.celebrationText,
        isActive: true,
      };
      
      await JourneyMilestone.findOneAndUpdate(
        { id: milestone.id, mapId: DEFAULT_MAP_CONFIG.mapId },
        { $set: milestoneData },
        { upsert: true, new: true }
      );
      created++;
    } catch (err) {
      console.error(`Error seeding milestone ${milestone.id}:`, err);
    }
  }

  console.log(`✅ [SEED] Complete: ${created} milestones created (${deleteResult.deletedCount} deleted)`);

  return {
    mapId: DEFAULT_MAP_CONFIG.mapId,
    mapName: DEFAULT_MAP_CONFIG.name,
    zonesCount: DEFAULT_MAP_CONFIG.zones.length,
    milestonesDeleted: deleteResult.deletedCount,
    milestonesCreated: created,
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
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
        error: "Failed to reset journey map",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
