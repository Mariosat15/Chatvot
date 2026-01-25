import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';

/**
 * POST /api/gamemaster/pause
 * Pause or unpause a Game Master subscription
 * When paused, GM won't earn referral fees but can still access dashboard
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { action } = body; // 'pause' or 'resume'

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find user's subscription
    const subscription = await GameMasterSubscription.findOne({ userId });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No Game Master subscription found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active subscriptions can be paused/resumed' },
        { status: 400 }
      );
    }

    if (action === 'pause') {
      if (subscription.isPaused) {
        return NextResponse.json(
          { error: 'Subscription is already paused' },
          { status: 400 }
        );
      }

      subscription.isPaused = true;
      subscription.pausedAt = new Date();
      subscription.pauseReason = 'User requested pause';
      await subscription.save();

      console.log(`⏸️ [GM PAUSE] User ${userId} paused their Game Master subscription`);

      return NextResponse.json({
        success: true,
        message: 'Subscription paused. You will not receive referral fees while paused.',
        isPaused: true,
        pausedAt: subscription.pausedAt,
      });
    } else {
      // Resume
      if (!subscription.isPaused) {
        return NextResponse.json(
          { error: 'Subscription is not paused' },
          { status: 400 }
        );
      }

      subscription.isPaused = false;
      subscription.pausedAt = undefined;
      subscription.pauseReason = undefined;
      await subscription.save();

      console.log(`▶️ [GM RESUME] User ${userId} resumed their Game Master subscription`);

      return NextResponse.json({
        success: true,
        message: 'Subscription resumed. You will now receive referral fees again.',
        isPaused: false,
      });
    }
  } catch (error) {
    console.error('Error pausing/resuming GM subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gamemaster/pause
 * Get current pause status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const subscription = await GameMasterSubscription.findOne({ userId: session.user.id });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No Game Master subscription found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      isPaused: subscription.isPaused,
      pausedAt: subscription.pausedAt,
      canEarnFees: subscription.status === 'active' && !subscription.isPaused && subscription.endDate > new Date(),
    });
  } catch (error) {
    console.error('Error getting pause status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
