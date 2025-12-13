import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserLevel from '@/database/models/user-level.model';
import UserBadge from '@/database/models/user-badge.model';
import { BADGES } from '@/lib/constants/badges';
import { TITLE_LEVELS } from '@/lib/constants/levels';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Get database connection
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // If userId provided, get specific user's data
    if (userId) {
      const [userLevel, userBadges, userDoc] = await Promise.all([
        UserLevel.findOne({ userId }).lean(),
        UserBadge.find({ userId }).lean(),
        db.collection('user').findOne({ id: userId }),
      ]);

      const user = userDoc ? {
        id: userDoc.id,
        name: userDoc.name,
        email: userDoc.email,
        image: userDoc.image || null,
      } : null;

      const badgesWithDetails = userBadges.map(ub => {
        const badge = BADGES.find(b => b.id === ub.badgeId);
        return {
          ...ub,
          badgeDetails: badge,
        };
      });

      return NextResponse.json({
        success: true,
        user: {
          id: userId,
          name: user?.name || 'Unknown',
          email: user?.email || '',
          image: user?.image || null,
        },
        level: userLevel || {
          userId,
          currentXP: 0,
          currentLevel: 1,
          currentTitle: 'Novice Trader',
          totalBadgesEarned: 0,
        },
        badges: badgesWithDetails,
      });
    }

    // Get all users with badge/XP data
    const allUserLevels = await UserLevel.find({}).sort({ currentXP: -1 }).lean();
    const allUsersArray = await db.collection('user').find({}).toArray();

    // Create user map - handle both 'id' and '_id' fields from Better Auth
    const userMap = new Map(allUsersArray.map((u: any) => {
      const userId = u.id || u._id?.toString();
      return [userId, {
        id: userId,
        name: u.name,
        email: u.email,
        image: u.image || null,
      }];
    }));

    const usersWithLevels = allUserLevels.map(ul => {
      const user = userMap.get(ul.userId);
      
      return {
        userId: ul.userId,
        name: user?.name || user?.email?.split('@')[0] || `User ${ul.userId.slice(-4)}`,
        email: user?.email || 'No email',
        image: user?.image || null,
        currentXP: ul.currentXP,
        currentLevel: ul.currentLevel,
        currentTitle: ul.currentTitle,
        totalBadgesEarned: ul.totalBadgesEarned,
        lastXPGain: ul.lastXPGain,
      };
    });
    
    console.log(`📊 Returning ${usersWithLevels.length} users with levels`);

    return NextResponse.json({
      success: true,
      users: usersWithLevels,
      stats: {
        totalUsers: usersWithLevels.length,
        totalXPAwarded: allUserLevels.reduce((sum, ul) => sum + ul.currentXP, 0),
        totalBadgesAwarded: allUserLevels.reduce((sum, ul) => sum + ul.totalBadgesEarned, 0),
        averageLevel: allUserLevels.length > 0 
          ? allUserLevels.reduce((sum, ul) => sum + ul.currentLevel, 0) / allUserLevels.length 
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching badges/XP data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

