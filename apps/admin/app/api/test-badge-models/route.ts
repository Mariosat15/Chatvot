import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import mongoose from "mongoose";

/**
 * GET /api/test-badge-models
 * Test that badge and XP models are working correctly
 */
export async function GET() {
  try {
    await connectToDatabase();

    // Get list of collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections.map((c) => c.name);

    // Count badges
    const badgeCount = await BadgeConfig.countDocuments();

    // Count XP configs
    const xpConfigCount = await XPConfig.countDocuments();

    // Get a sample badge to verify structure
    const sampleBadge = await BadgeConfig.findOne().lean();

    // Get XP configs to verify structure
    const badgeXP = await XPConfig.findOne({ configType: "badge_xp" }).lean();
    const levelProgression = await XPConfig.findOne({
      configType: "level_progression",
    }).lean();

    return NextResponse.json({
      success: true,
      message: "Badge models are working correctly!",
      details: {
        collections: collectionNames.filter(
          (name) =>
            name.includes("badge") ||
            name.includes("xp") ||
            name.includes("config"),
        ),
        counts: {
          badges: badgeCount,
          xpConfigs: xpConfigCount,
        },
        sampleBadge: sampleBadge
          ? {
              id: sampleBadge.id,
              name: sampleBadge.name,
              icon: sampleBadge.icon,
              category: sampleBadge.category,
            }
          : null,
        xpConfigsFound: {
          badgeXP: !!badgeXP,
          levelProgression: !!levelProgression,
          levelCount: levelProgression?.data?.levels?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error testing badge models:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test badge models",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
