import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import KYCSettings from '@/database/models/kyc-settings.model';
import KYCSession from '@/database/models/kyc-session.model';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get KYC settings
    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    // Get user wallet with KYC status
    const wallet = await CreditWallet.findOne({ userId: session.user.id });

    // Get latest KYC session
    const latestSession = await KYCSession.findOne({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // Check if KYC is expired
    let kycStatus = wallet?.kycStatus || 'none';
    let kycVerified = wallet?.kycVerified || false;

    if (kycVerified && wallet?.kycExpiresAt && new Date() > wallet.kycExpiresAt) {
      kycStatus = 'expired';
      kycVerified = false;
      // Update wallet
      await CreditWallet.findByIdAndUpdate(wallet._id, {
        kycVerified: false,
        kycStatus: 'expired',
      });
    }

    return NextResponse.json({
      enabled: settings.enabled,
      required: settings.requiredForWithdrawal || settings.requiredForDeposit,
      requiredForWithdrawal: settings.requiredForWithdrawal,
      requiredForDeposit: settings.requiredForDeposit,
      requiredAmount: settings.requiredAmount,
      
      userStatus: {
        verified: kycVerified,
        status: kycStatus,
        verifiedAt: wallet?.kycVerifiedAt,
        expiresAt: wallet?.kycExpiresAt,
        attempts: wallet?.kycAttempts || 0,
        maxAttempts: settings.maxVerificationAttempts,
      },
      
      latestSession: latestSession ? {
        id: latestSession._id,
        status: latestSession.status,
        createdAt: latestSession.createdAt,
        completedAt: latestSession.completedAt,
      } : null,
      
      messages: {
        required: settings.kycRequiredMessage,
        pending: settings.kycPendingMessage,
        approved: settings.kycApprovedMessage,
        declined: settings.kycDeclinedMessage,
      },
    });
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    return NextResponse.json({ error: 'Failed to fetch KYC status' }, { status: 500 });
  }
}

