import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import ChallengeSettings from '@/database/models/trading/challenge-settings.model';

// GET - Get challenge settings for users
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const settings = await ChallengeSettings.getSingleton();

    // Return only user-relevant settings (trading settings come from TradingRiskSettings)
    return NextResponse.json({
      settings: {
        challengesEnabled: settings.challengesEnabled,
        platformFeePercentage: settings.platformFeePercentage,
        minEntryFee: settings.minEntryFee,
        maxEntryFee: settings.maxEntryFee,
        defaultStartingCapital: settings.defaultStartingCapital,
        minStartingCapital: settings.minStartingCapital,
        maxStartingCapital: settings.maxStartingCapital,
        minDurationMinutes: settings.minDurationMinutes,
        maxDurationMinutes: settings.maxDurationMinutes,
        defaultDurationMinutes: settings.defaultDurationMinutes,
        acceptDeadlineMinutes: settings.acceptDeadlineMinutes,
        defaultAssetClasses: settings.defaultAssetClasses,
      },
    });
  } catch (error) {
    console.error('Error fetching challenge settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

