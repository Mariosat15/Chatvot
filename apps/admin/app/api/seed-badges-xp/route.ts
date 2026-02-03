import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import { BADGES } from "@/lib/constants/badges";
import { BADGE_XP_VALUES, TITLE_LEVELS } from "@/lib/constants/levels";

/**
 * Shared function to reset and reseed badges/XP
 */
async function reseedBadgesAndXP() {
  console.log("🌱 Starting badge and XP seeding (FORCE RESET MODE)...");

  await connectToDatabase();
  console.log("✅ Connected to database");

  // Count existing before deletion
  const existingBadgesBefore = await BadgeConfig.countDocuments();
  const existingXPBefore = await XPConfig.countDocuments();
  console.log(`📊 Existing before reset - Badges: ${existingBadgesBefore}, XP Configs: ${existingXPBefore}`);

  // DELETE all existing badge configs
  console.log("🗑️ Deleting existing badge configurations...");
  const deletedBadges = await BadgeConfig.deleteMany({});
  console.log(`🗑️ Deleted ${deletedBadges.deletedCount} badges`);

  // DELETE all existing XP configs
  console.log("🗑️ Deleting existing XP configurations...");
  const deletedXP = await XPConfig.deleteMany({});
  console.log(`🗑️ Deleted ${deletedXP.deletedCount} XP configs`);

  // INSERT fresh badges from constants
  console.log(`🌱 Inserting ${BADGES.length} badges from constants...`);
  const badgesToInsert = BADGES.map((badge) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description,
    category: badge.category,
    icon: badge.icon,
    rarity: badge.rarity,
    condition: badge.condition,
    isActive: true,
  }));

  const insertedBadges = await BadgeConfig.insertMany(badgesToInsert);
  console.log(`✅ Inserted ${insertedBadges.length} badges`);

  // INSERT Badge XP values
  console.log("🌱 Creating Badge XP config...");
  const badgeXPDoc = await XPConfig.create({
    configType: "badge_xp",
    data: BADGE_XP_VALUES,
    isActive: true,
  });
  console.log("✅ Badge XP config created:", badgeXPDoc._id);

  // INSERT Level Progression (with 20 levels now!)
  console.log(`🌱 Creating Level Progression config with ${TITLE_LEVELS.length} levels...`);
  const levelsDoc = await XPConfig.create({
    configType: "level_progression",
    data: { levels: TITLE_LEVELS },
    isActive: true,
  });
  console.log("✅ Level Progression config created:", levelsDoc._id);

  // Final count
  const finalBadgeCount = await BadgeConfig.countDocuments();
  const finalXPCount = await XPConfig.countDocuments();

  console.log(
    `✅ Seeding complete! Badges: ${finalBadgeCount}, XP Configs: ${finalXPCount}, Levels: ${TITLE_LEVELS.length}`,
  );

  return {
    badges: finalBadgeCount,
    levels: TITLE_LEVELS.length,
    xpConfigs: finalXPCount,
    changes: {
      badgesDeleted: deletedBadges.deletedCount,
      badgesInserted: insertedBadges.length,
      xpConfigsDeleted: deletedXP.deletedCount,
    },
  };
}

/**
 * GET /api/seed-badges-xp
 * Reset and re-seed badge and XP configurations from constants (easy browser access)
 */
export async function GET() {
  try {
    const result = await reseedBadgesAndXP();

    return NextResponse.json({
      success: true,
      message: `Badge and XP configurations reset and re-seeded! ${BADGES.length} badges with UNIQUE icons, ${TITLE_LEVELS.length} levels.`,
      counts: result,
    });
  } catch (error) {
    console.error("❌ Error seeding configurations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed configurations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/seed-badges-xp
 * Reset and re-seed badge and XP configurations from constants
 * This will DELETE existing configs and INSERT fresh ones from the code
 */
export async function POST() {
  try {
    const result = await reseedBadgesAndXP();

    return NextResponse.json({
      success: true,
      message: `Badge and XP configurations reset and re-seeded! ${BADGES.length} badges with UNIQUE icons, ${TITLE_LEVELS.length} levels.`,
      counts: result,
    });
  } catch (error) {
    console.error("❌ Error seeding configurations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed configurations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
