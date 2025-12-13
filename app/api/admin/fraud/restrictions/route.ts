import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';
import { getUsersByIds } from '@/lib/utils/user-lookup';

/**
 * GET /api/admin/fraud/restrictions
 * Fetch all user restrictions with user info
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    console.log('🔍 API: Fetching all user restrictions...');
    
    // Fetch all restrictions, sorted by most recent first
    const restrictions = await UserRestriction.find({})
      .sort({ restrictedAt: -1 })
      .lean();

    console.log(`✅ API: Found ${restrictions.length} restriction(s)`);
    console.log('   Active:', restrictions.filter((r: any) => r.isActive).length);
    console.log('   Banned:', restrictions.filter((r: any) => r.restrictionType === 'banned' && r.isActive).length);
    console.log('   Suspended:', restrictions.filter((r: any) => r.restrictionType === 'suspended' && r.isActive).length);

    // Get unique user IDs
    const userIds = [...new Set(restrictions.map((r: any) => r.userId.toString()))];
    
    // Fetch user info for all users
    const usersMap = await getUsersByIds(userIds);
    
    // Attach user info to restrictions
    const restrictionsWithUserInfo = restrictions.map((r: any) => {
      const userInfo = usersMap.get(r.userId.toString());
      return {
        ...r,
        userInfo: userInfo || { id: r.userId.toString(), email: 'Unknown', name: 'Unknown User' },
      };
    });

    return NextResponse.json({
      success: true,
      restrictions: restrictionsWithUserInfo,
      total: restrictions.length,
    });

  } catch (error) {
    console.error('Error fetching restrictions:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch restrictions'
    }, { status: 500 });
  }
}

