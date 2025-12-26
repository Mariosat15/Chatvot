import BadgeConfig from '@/database/models/badge-config.model';
import XPConfig from '@/database/models/xp-config.model';
import { BADGES } from '@/lib/constants/badges';
import { BADGE_XP_VALUES, TITLE_LEVELS } from '@/lib/constants/levels';
import { connectToDatabase } from '@/database/mongoose';

/**
 * Seed default badge configurations to database
 */
export async function seedBadgeConfigs() {
  try {
    await connectToDatabase();
    
    // Check if badges already exist
    const existingCount = await BadgeConfig.countDocuments();
    
    if (existingCount === 0) {
      console.log('🌱 Seeding default badge configurations...');
      
      // Insert all default badges
      await BadgeConfig.insertMany(BADGES.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        rarity: badge.rarity,
        condition: badge.condition,
        isActive: true,
      })));
      
      console.log(`✅ Seeded ${BADGES.length} default badges`);
    } else {
      console.log(`ℹ️ Badges already seeded (${existingCount} badges found)`);
    }
  } catch (error) {
    console.error('❌ Error seeding badge configs:', error);
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
    const existingBadgeXP = await XPConfig.findOne({ configType: 'badge_xp' });
    const existingLevels = await XPConfig.findOne({ configType: 'level_progression' });
    
    if (!existingBadgeXP) {
      console.log('🌱 Seeding default Badge XP values...');
      await XPConfig.create({
        configType: 'badge_xp',
        data: BADGE_XP_VALUES,
        isActive: true,
      });
      console.log('✅ Seeded Badge XP values');
    } else {
      console.log('ℹ️ Badge XP values already seeded');
    }
    
    if (!existingLevels) {
      console.log('🌱 Seeding default Level Progression...');
      console.log('Level data to seed:', TITLE_LEVELS);
      await XPConfig.create({
        configType: 'level_progression',
        data: { levels: TITLE_LEVELS },
        isActive: true,
      });
      console.log('✅ Seeded Level Progression with', TITLE_LEVELS.length, 'levels');
    } else {
      console.log('ℹ️ Level Progression already seeded');
    }
  } catch (error) {
    console.error('❌ Error seeding XP configs:', error);
    throw error;
  }
}

/**
 * Reset badge and XP configurations to defaults
 */
export async function resetBadgeAndXPConfigs() {
  try {
    await connectToDatabase();
    
    console.log('🔄 Resetting badge and XP configurations to defaults...');
    
    // Delete all existing configs
    await BadgeConfig.deleteMany({});
    await XPConfig.deleteMany({});
    
    // Reseed defaults
    await seedBadgeConfigs();
    await seedXPConfigs();
    
    console.log('✅ Badge and XP configurations reset to defaults');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error resetting configs:', error);
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
    return badges.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      icon: badge.icon,
      rarity: badge.rarity,
      condition: badge.condition,
      isActive: badge.isActive,
    }));
  } catch (error) {
    console.error('Error fetching badges from DB, using constants:', error);
    return BADGES;
  }
}

/**
 * Get XP configuration from database (fallback to constants if DB is empty)
 */
export async function getXPConfigFromDB() {
  try {
    await connectToDatabase();
    
    const badgeXP = await XPConfig.findOne({ configType: 'badge_xp', isActive: true }).lean();
    const levels = await XPConfig.findOne({ configType: 'level_progression', isActive: true }).lean();
    
    // If configs don't exist, seed them
    if (!badgeXP || !levels) {
      await seedXPConfigs();
      const newBadgeXP = await XPConfig.findOne({ configType: 'badge_xp', isActive: true }).lean();
      const newLevels = await XPConfig.findOne({ configType: 'level_progression', isActive: true }).lean();
      
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
    console.error('Error fetching XP config from DB, using constants:', error);
    return {
      badgeXP: BADGE_XP_VALUES,
      levels: TITLE_LEVELS,
    };
  }
}

