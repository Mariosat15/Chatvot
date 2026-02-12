import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import { BADGES } from "@/lib/constants/badges";
import { BADGE_XP_VALUES, TITLE_LEVELS } from "@/lib/constants/levels";
import { connectToDatabase } from "@/database/mongoose";
import { getDefaultBadges, getDefaultXPConfig } from "@/lib/services/whitelabel-defaults-reader";

/**
 * Seed default badge configurations to database
 */
export async function seedBadgeConfigs() {
  try {
    await connectToDatabase();

    // Check if badges already exist
    const existingCount = await BadgeConfig.countDocuments();

    if (existingCount === 0) {
      // Prefer saved white-label defaults over hardcoded constants
      const savedDefaults = getDefaultBadges();
      if (savedDefaults && savedDefaults.length > 0) {
        console.log(`🌱 Seeding badge configs from saved white-label defaults (${savedDefaults.length} badges)...`);
        await BadgeConfig.insertMany(savedDefaults);
        console.log(`✅ Seeded ${savedDefaults.length} badges from saved defaults`);
      } else {
        console.log("🌱 Seeding default badge configurations from constants...");
        await BadgeConfig.insertMany(
          BADGES.map((badge) => ({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            category: badge.category,
            icon: badge.icon,
            rarity: badge.rarity,
            condition: badge.condition,
            minLevel: badge.minLevel || 0,
            isActive: true,
          })),
        );
        console.log(`✅ Seeded ${BADGES.length} default badges from constants`);
      }
    } else {
      // Sync: upsert any badges from constants that are missing or outdated in DB
      const existingBadges = await BadgeConfig.find({}).lean();
      const existingIds = new Set(existingBadges.map((b: any) => b.id));

      let added = 0;
      let updated = 0;

      for (const badge of BADGES) {
        if (!existingIds.has(badge.id)) {
          // New badge not in DB yet - insert it
          await BadgeConfig.create({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            category: badge.category,
            icon: badge.icon,
            rarity: badge.rarity,
            condition: badge.condition,
            minLevel: badge.minLevel || 0,
            isActive: true,
          });
          added++;
        } else {
          // Badge exists - update condition and metadata in case constants changed
          const existing = existingBadges.find((b: any) => b.id === badge.id) as any;
          const conditionChanged = JSON.stringify(existing?.condition) !== JSON.stringify(badge.condition);
          if (conditionChanged) {
            await BadgeConfig.updateOne(
              { id: badge.id },
              {
                $set: {
                  condition: badge.condition,
                  name: badge.name,
                  description: badge.description,
                  category: badge.category,
                  icon: badge.icon,
                  rarity: badge.rarity,
                  minLevel: badge.minLevel || 0,
                },
              },
            );
            updated++;
          }
        }
      }

      if (added > 0 || updated > 0) {
        console.log(`🔄 Badge sync: ${added} added, ${updated} updated (${existingCount} existed)`);
      } else {
        console.log(`ℹ️ Badges already synced (${existingCount} badges found)`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding badge configs:", error);
    throw error;
  }
}

/**
 * Seed default XP configurations to database
 */
export async function seedXPConfigs() {
  try {
    await connectToDatabase();

    // Check if XP configs already exist
    const existingBadgeXP = await XPConfig.findOne({ configType: "badge_xp" });
    const existingLevels = await XPConfig.findOne({
      configType: "level_progression",
    });

    // Prefer saved white-label defaults over hardcoded constants
    const savedXP = getDefaultXPConfig();

    if (!existingBadgeXP) {
      const xpData = savedXP?.badgeXP || BADGE_XP_VALUES;
      const source = savedXP?.badgeXP ? "saved defaults" : "constants";
      console.log(`🌱 Seeding Badge XP values from ${source}...`);
      await XPConfig.create({
        configType: "badge_xp",
        data: xpData,
        isActive: true,
      });
      console.log(`✅ Seeded Badge XP values from ${source}`);
    } else {
      console.log("ℹ️ Badge XP values already seeded");
    }

    if (!existingLevels) {
      const levelsData = savedXP?.levels || TITLE_LEVELS;
      const source = savedXP?.levels ? "saved defaults" : "constants";
      console.log(`🌱 Seeding Level Progression from ${source}...`);
      await XPConfig.create({
        configType: "level_progression",
        data: { levels: levelsData },
        isActive: true,
      });
      console.log(
        `✅ Seeded Level Progression from ${source} with`,
        levelsData.length,
        "levels",
      );
    } else {
      console.log("ℹ️ Level Progression already seeded");
    }
  } catch (error) {
    console.error("❌ Error seeding XP configs:", error);
    throw error;
  }
}

/**
 * Reset badge and XP configurations to defaults
 */
export async function resetBadgeAndXPConfigs() {
  try {
    await connectToDatabase();

    console.log("🔄 Resetting badge and XP configurations to defaults...");

    // Delete all existing configs
    await BadgeConfig.deleteMany({});
    await XPConfig.deleteMany({});

    // Reseed defaults
    await seedBadgeConfigs();
    await seedXPConfigs();

    console.log("✅ Badge and XP configurations reset to defaults");

    return { success: true };
  } catch (error) {
    console.error("❌ Error resetting configs:", error);
    throw error;
  }
}

/**
 * Get all badges from database (fallback to constants if DB is empty)
 */
export async function getBadgesFromDB() {
  try {
    await connectToDatabase();

    let badges = await BadgeConfig.find({ isActive: true }).lean();

    // If no badges in DB, seed and return
    if (badges.length === 0) {
      await seedBadgeConfigs();
      badges = await BadgeConfig.find({ isActive: true }).lean();
    }

    // #region agent log
    const constantBadgeIds = new Set(BADGES.map(b => b.id));
    const dbBadgeIds = new Set(badges.map((b: any) => b.id));
    const missingFromDB = BADGES.filter(b => !dbBadgeIds.has(b.id)).map(b => b.id);
    const extraInDB = badges.filter((b: any) => !constantBadgeIds.has(b.id)).map((b: any) => b.id);
    if (missingFromDB.length > 0 || extraInDB.length > 0) {
      console.log(`🔍 [BADGE-DEBUG] DB SYNC ISSUE: dbCount=${badges.length} constantsCount=${BADGES.length} missingFromDB=${JSON.stringify(missingFromDB)} extraInDB=${JSON.stringify(extraInDB)}`);
    }
    // #endregion

    // Convert to plain objects, removing MongoDB-specific fields
    return badges.map((badge: any) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      icon: badge.icon,
      rarity: badge.rarity,
      condition: badge.condition,
      minLevel: badge.minLevel || 0,
      isActive: badge.isActive,
    }));
  } catch (error) {
    console.error("Error fetching badges from DB, using constants:", error);
    return BADGES;
  }
}

/**
 * Get XP configuration from database (fallback to constants if DB is empty)
 */
export async function getXPConfigFromDB() {
  try {
    await connectToDatabase();

    const badgeXP = await XPConfig.findOne({
      configType: "badge_xp",
      isActive: true,
    }).lean();
    const levels = await XPConfig.findOne({
      configType: "level_progression",
      isActive: true,
    }).lean();

    // If configs don't exist, seed them
    if (!badgeXP || !levels) {
      await seedXPConfigs();
      const newBadgeXP = await XPConfig.findOne({
        configType: "badge_xp",
        isActive: true,
      }).lean();
      const newLevels = await XPConfig.findOne({
        configType: "level_progression",
        isActive: true,
      }).lean();

      return {
        badgeXP: newBadgeXP?.data || BADGE_XP_VALUES,
        levels: newLevels?.data?.levels || TITLE_LEVELS,
      };
    }

    return {
      badgeXP: badgeXP.data,
      levels: levels.data.levels,
    };
  } catch (error) {
    console.error("Error fetching XP config from DB, using constants:", error);
    return {
      badgeXP: BADGE_XP_VALUES,
      levels: TITLE_LEVELS,
    };
  }
}
