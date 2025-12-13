import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import XPConfig from '@/database/models/xp-config.model';
import { getXPConfigFromDB } from '@/lib/services/badge-config-seed.service';

/**
 * GET /api/admin/badges-xp/manage
 * Get badge XP values and level progression configuration from database
 */
export async function GET() {
  try {
    await connectToDatabase();
    const config = await getXPConfigFromDB();
    
    return NextResponse.json({
      success: true,
      badgeXP: config.badgeXP,
      levels: config.levels,
    });
  } catch (error) {
    console.error('Error fetching XP configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch XP configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/badges-xp/manage
 * Update badge XP values and/or level progression in database
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { badgeXP, levels } = await request.json();

    // Update badge XP values if provided
    if (badgeXP) {
      await XPConfig.findOneAndUpdate(
        { configType: 'badge_xp' },
        { data: badgeXP },
        { upsert: true, new: true }
      );
    }

    // Update level progression if provided
    if (levels) {
      await XPConfig.findOneAndUpdate(
        { configType: 'level_progression' },
        { data: { levels } },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully!',
      badgeXP,
      levels,
    });
  } catch (error) {
    console.error('Error updating XP configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update XP configuration' },
      { status: 500 }
    );
  }
}
