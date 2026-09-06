import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import { BADGES } from "@/lib/constants/badges";
import { BADGE_XP_VALUES, TITLE_LEVELS } from "@/lib/constants/levels";
import { getDefaultBadges, getDefaultXPConfig } from "@/lib/services/whitelabel-defaults.service";

/**
 * Shared function to reset and reseed badges/XP
 * Prefers saved white-label defaults, falls back to hardcoded constants
 */
async function reseedBadgesAndXP() {
  console.log("🌱 Starting badge and XP seeding (FORCE RESET MODE)...");

  await connectToDatabase();
  console.log("✅ Connected to database");

  // Check for saved defaults
  const savedBadges = getDefaultBadges();
  const savedXP = getDefaultXPConfig();
  const badgeSource = (savedBadges && savedBadges.length > 0) ? "saved defaults" : "constants";
  const xpSource = savedXP?.badgeXP ? "saved defaults" : "constants";
  console.log(`📦 Badge source: ${badgeSource}, XP source: ${xpSource}`);

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

  // INSERT badges from saved defaults or constants
  let insertedBadgesCount: number;
  if (savedBadges && savedBadges.length > 0) {
    console.log(`🌱 Inserting ${savedBadges.length} badges from saved defaults...`);
    const insertedBadges = await BadgeConfig.insertMany(savedBadges);
    insertedBadgesCount = insertedBadges.length;
  } else {
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
    insertedBadgesCount = insertedBadges.length;
  }
  console.log(`✅ Inserted ${insertedBadgesCount} badges from ${badgeSource}`);

  // INSERT Badge XP values
  const badgeXPData = savedXP?.badgeXP || BADGE_XP_VALUES;
  console.log(`🌱 Creating Badge XP config from ${xpSource}...`);
  const badgeXPDoc = await XPConfig.create({
    configType: "badge_xp",
    data: badgeXPData,
    isActive: true,
  });
  console.log("✅ Badge XP config created:", badgeXPDoc._id);

  // INSERT Level Progression
  const levelsData = savedXP?.levels || TITLE_LEVELS;
  const levelsSource = savedXP?.levels ? "saved defaults" : "constants";
  console.log(`🌱 Creating Level Progression config from ${levelsSource} with ${levelsData.length} levels...`);
  const levelsDoc = await XPConfig.create({
    configType: "level_progression",
    data: { levels: levelsData },
    isActive: true,
  });
  console.log("✅ Level Progression config created:", levelsDoc._id);

  // Final count
  const finalBadgeCount = await BadgeConfig.countDocuments();
  const finalXPCount = await XPConfig.countDocuments();

  console.log(
    `✅ Seeding complete! Badges: ${finalBadgeCount}, XP Configs: ${finalXPCount}, Levels: ${levelsData.length} (source: ${badgeSource})`,
  );

  return {
    badges: finalBadgeCount,
    levels: levelsData.length,
    xpConfigs: finalXPCount,
    source: badgeSource,
    changes: {
      badgesDeleted: deletedBadges.deletedCount,
      badgesInserted: insertedBadgesCount,
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
      message: `Badge and XP configurations re-seeded from ${result.source}! ${result.badges} badges, ${result.levels} levels.`,
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
      message: `Badge and XP configurations re-seeded from ${result.source}! ${result.badges} badges, ${result.levels} levels.`,
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
