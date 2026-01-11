import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import KYCSession from '@/database/models/kyc-session.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';

/**
 * POST /api/kyc/cancel
 * 
 * Allows users to manually cancel/abandon a pending KYC session
 * so they can immediately restart verification without waiting
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const userId = session.user.id;

    // Find the latest pending/created/started session
    const latestSession = await KYCSession.findOne({
      userId,
      status: { $in: ['created', 'started', 'pending'] }
    }).sort({ createdAt: -1 });

    if (!latestSession) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active verification session found' 
      });
    }

    // Mark session as abandoned
    await KYCSession.findByIdAndUpdate(latestSession._id, {
      status: 'abandoned',
      completedAt: new Date(),
    });

    // Reset wallet KYC status to 'none' so user can retry
    await CreditWallet.findOneAndUpdate(
      { userId },
      { kycStatus: 'none' }
    );

    console.log(`✅ [KYC] User ${userId} cancelled verification session ${latestSession._id}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Verification cancelled. You can now start a new verification.' 
    });

  } catch (error) {
    console.error('Error cancelling KYC:', error);
    return NextResponse.json(
      { error: 'Failed to cancel verification' },
      { status: 500 }
    );
  }
}

