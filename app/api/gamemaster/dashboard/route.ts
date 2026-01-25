import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';
import GameMasterEarning from '@/database/models/gamemaster/gamemaster-earning.model';
import UserReferral from '@/database/models/user-referral.model';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/**
 * GET /api/gamemaster/dashboard
 * Get Game Master dashboard data for the authenticated user
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Get the user's Game Master subscription
    const subscription = await GameMasterSubscription.findOne({ userId }).lean();
    
    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          subscription: null,
          referredUsers: [],
          recentEarnings: [],
        },
      });
    }
    
    // Get referred users from UserReferral collection
    const referredUsers = await UserReferral.find({
      gameMasterId: userId,
    })
      .select('userName userEmail referredAt userId')
      .sort({ referredAt: -1 })
      .limit(50)
      .lean()
      .then(users => users.map(u => ({
        _id: u.userId,
        name: u.userName || 'Unknown',
        email: u.userEmail,
        createdAt: u.referredAt,
      })));
    
    // Get recent earnings
    const recentEarnings = await GameMasterEarning.find({
      gameMasterId: userId,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // IMPORTANT: Get CURRENT package settings (not cached subscription limits)
    // This ensures if admin changes package, all GMs with that package see the update
    let currentPackageLimits = subscription.limits || {};
    
    if (subscription.packageId) {
      const currentPackage = await MarketplaceItem.findById(subscription.packageId).lean();
      if (currentPackage?.gameMasterConfig) {
        // Use current package settings
        currentPackageLimits = {
          maxCompetitionsPerDay: currentPackage.gameMasterConfig.maxCompetitionsPerDay,
          maxUsersPerCompetition: currentPackage.gameMasterConfig.maxUsersPerCompetition,
          referralFeePercentage: currentPackage.gameMasterConfig.referralFeePercentage,
          canCreateCompetitions: currentPackage.gameMasterConfig.canCreateCompetitions !== false,
        };
        console.log(`[GM Dashboard] Using current package settings for ${subscription.packageName}:`, currentPackageLimits);
      }
    }
    
    const canCreateCompetitions = currentPackageLimits.canCreateCompetitions !== false;
    
    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          ...subscription,
          limits: currentPackageLimits, // Use current package limits
          canCreateCompetitions, // Based on current package setting
        },
        referredUsers,
        recentEarnings,
      },
    });
  } catch (error) {
    console.error('Error fetching GM dashboard:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
