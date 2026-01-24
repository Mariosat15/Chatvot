import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';

/**
 * GET /api/gamemaster/status
 * Get current user's game master status
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

    // Find user's subscription (active or expired)
    const subscription = await GameMasterSubscription.findOne({
      userId,
    }).sort({ createdAt: -1 });  // Get most recent
    
    if (!subscription) {
      return NextResponse.json({
        success: true,
        isGameMaster: false,
        subscription: null,
      });
    }

    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      success: true,
      isGameMaster: subscription.status === 'active' && endDate > now,
      subscription: {
        id: subscription._id.toString(),
        status: subscription.status,
        packageName: subscription.packageName,
        referralCode: subscription.referralCode,
        referralLink: subscription.referralLink,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextRenewalDate: subscription.nextRenewalDate,
        autoRenew: subscription.autoRenew,
        renewalPrice: subscription.renewalPrice,
        daysRemaining,
        limits: subscription.limits,
        stats: {
          totalReferredUsers: subscription.totalReferredUsers,
          activeReferredUsers: subscription.activeReferredUsers,
          totalEarnings: subscription.totalEarnings,
          pendingEarnings: subscription.pendingEarnings,
          totalCompetitionsCreated: subscription.totalCompetitionsCreated,
          currentPeriodCompetitionsCreated: subscription.currentPeriodCompetitionsCreated,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching game master status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
