import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import BadgeConfig from '@/database/models/badge-config.model';
import XPConfig from '@/database/models/xp-config.model';
import { BADGES } from '@/lib/constants/badges';
import { BADGE_XP_VALUES, TITLE_LEVELS } from '@/lib/constants/levels';

/**
 * POST /api/admin/seed-badges-xp
 * Manually seed badge and XP configurations (useful for first-time setup)
 */
export async function POST() {
  try {
    console.log('🌱 Starting badge and XP seeding...');
    
    await connectToDatabase();
    console.log('✅ Connected to database');

    // Count existing badges
    const existingBadges = await BadgeConfig.countDocuments();
    console.log(`📊 Existing badges: ${existingBadges}`);

    // Seed badges
    if (existingBadges === 0) {
      console.log(`🌱 Inserting ${BADGES.length} badges...`);
      
      const badgesToInsert = BADGES.map(badge => ({
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
    } else {
      console.log('ℹ️ Badges already exist, skipping badge seeding');
    }

    // Count existing XP configs
    const existingBadgeXP = await XPConfig.findOne({ configType: 'badge_xp' });
    const existingLevels = await XPConfig.findOne({ configType: 'level_progression' });
    
    console.log(`📊 Existing badge_xp config: ${existingBadgeXP ? 'Yes' : 'No'}`);
    console.log(`📊 Existing level_progression config: ${existingLevels ? 'Yes' : 'No'}`);

    // Seed Badge XP values
    if (!existingBadgeXP) {
      console.log('🌱 Creating Badge XP config...');
      const badgeXPDoc = await XPConfig.create({
        configType: 'badge_xp',
        data: BADGE_XP_VALUES,
        isActive: true,
      });
      console.log('✅ Badge XP config created:', badgeXPDoc._id);
    } else {
      console.log('ℹ️ Badge XP config already exists');
    }

    // Seed Level Progression
    if (!existingLevels) {
      console.log('🌱 Creating Level Progression config...');
      const levelsDoc = await XPConfig.create({
        configType: 'level_progression',
        data: { levels: TITLE_LEVELS },
        isActive: true,
      });
      console.log('✅ Level Progression config created:', levelsDoc._id);
    } else {
      console.log('ℹ️ Level Progression config already exists');
    }

    // Final count
    const finalBadgeCount = await BadgeConfig.countDocuments();
    const finalXPCount = await XPConfig.countDocuments();

    console.log(`✅ Seeding complete! Badges: ${finalBadgeCount}, XP Configs: ${finalXPCount}`);

    return NextResponse.json({
      success: true,
      message: 'Badge and XP configurations seeded successfully!',
      counts: {
        badges: finalBadgeCount,
        xpConfigs: finalXPCount,
      },
    });
  } catch (error) {
    console.error('❌ Error seeding configurations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed configurations',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

