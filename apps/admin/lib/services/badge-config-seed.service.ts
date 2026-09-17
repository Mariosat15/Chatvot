import BadgeConfig from "@/database/models/badge-config.model";
import XPConfig from "@/database/models/xp-config.model";
import { BADGES } from "@/lib/constants/badges";
import { BADGE_XP_VALUES, TITLE_LEVELS } from "@/lib/constants/levels";
import { connectToDatabase } from "@/database/mongoose";
import { getDefaultBadges, getDefaultXPConfig } from "@/lib/services/whitelabel-defaults.service";
import {
  clearDefaultsSuppression,
  getDefaultsSuppression,
} from "@/lib/services/gamification-defaults-state.service";

/**
 * Seed default badge configurations to database
 */
export async function seedBadgeConfigs() {
  try {
    await connectToDatabase();

    // Reason: an operator who deliberately wiped the catalogue to start from
    // scratch must not have it restored by the next read. The gate covers BOTH
    // branches below — after a wipe the add-only sync is indistinguishable from
    // a first seed, so guarding only the empty case restores everything anyway.
    const { badgeDefaultsSuppressed } = await getDefaultsSuppression();
    if (badgeDefaultsSuppressed) {
      console.log(
        "⏭️ Badge defaults are suppressed (catalogue was reset from scratch) — not seeding.",
      );
      return;
    }

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
            // Reason: X7 step 4 — scope travels with the badge; omit and schema
            // defaults to ["trading"] while getBadgesFromDB would invent platform.
            gameTypes: Array.isArray(badge.gameTypes)
              ? badge.gameTypes
              : ["trading"],
            isActive: true,
          })),
        );
        console.log(`✅ Seeded ${BADGES.length} default badges from constants`);
      }
    } else {
      // Reason (R99): sync is ADD-ONLY. Existing rows are operator-owned (and may
      // have been seeded from data/defaults/badges.json, which disagrees with
      // BADGES on six ids and on most thresholds). Overwriting `condition` when
      // constants differ silently undoes admin tuning. Intentional reset remains
      // resetBadgeAndXPConfigs / seed-badges-xp (delete + reseed, JSON preferred).
      const existingBadges = await BadgeConfig.find({}).lean();
      const existingIds = new Set(existingBadges.map((b: any) => b.id));

      let added = 0;

      for (const badge of BADGES) {
        if (!existingIds.has(badge.id)) {
          await BadgeConfig.create({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            category: badge.category,
            icon: badge.icon,
            rarity: badge.rarity,
            condition: badge.condition,
            minLevel: badge.minLevel || 0,
            gameTypes: Array.isArray(badge.gameTypes)
              ? badge.gameTypes
              : ["trading"],
            isActive: true,
          });
          added++;
        }
      }

      if (added > 0) {
        console.log(`🔄 Badge sync: ${added} added (${existingCount} existed, existing rows untouched)`);
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

    // Reason: same as badges — a deliberately emptied ladder must stay empty
    // until the operator builds one, or "Novice Trader" reappears on a games
    // platform on the next page load.
    const { xpDefaultsSuppressed } = await getDefaultsSuppression();
    if (xpDefaultsSuppressed) {
      console.log(
        "⏭️ XP defaults are suppressed (levels were reset from scratch) — not seeding.",
      );
      return;
    }

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

    const savedBadges = getDefaultBadges();
    const savedXP = getDefaultXPConfig();
    const source = (savedBadges && savedBadges.length > 0) ? "saved white-label defaults" : "hardcoded constants";
    console.log(`🔄 Resetting badge and XP configurations from ${source}...`);

    // Delete all existing configs
    await BadgeConfig.deleteMany({});
    await XPConfig.deleteMany({});

    // Reason: restoring defaults is the inverse of starting from scratch, so it
    // must lift the suppression in the same operation. Left set, the reseed
    // below writes nothing and reports success — a restore that restored
    // nothing.
    await clearDefaultsSuppression();

    // Reseed defaults (seedBadgeConfigs / seedXPConfigs already check saved defaults first)
    await seedBadgeConfigs();
    await seedXPConfigs();

    console.log(`✅ Badge and XP configurations reset from ${source}`);

    return { success: true, source };
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

    // Convert to plain objects, removing MongoDB-specific fields
    return badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      icon: badge.icon,
      rarity: badge.rarity,
      condition: badge.condition,
      minLevel: badge.minLevel ?? 0,
      // Reason: X7 step 4 — consumers need the stored scope to filter and stamp XP.
      gameTypes: Array.isArray(badge.gameTypes) ? badge.gameTypes : ["trading"],
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
