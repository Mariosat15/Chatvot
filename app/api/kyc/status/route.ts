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

    // Determine the actual KYC status
    let kycStatus = wallet?.kycStatus || 'none';
    let kycVerified = wallet?.kycVerified || false;

    // Check if KYC is expired by date
    if (kycVerified && wallet?.kycExpiresAt && new Date() > wallet.kycExpiresAt) {
      kycStatus = 'expired';
      kycVerified = false;
      // Update wallet
      await CreditWallet.findByIdAndUpdate(wallet._id, {
        kycVerified: false,
        kycStatus: 'expired',
      });
    }
    
    // Sync status from latest session if wallet status is out of sync
    // This handles cases where webhook didn't update the wallet properly
    if (latestSession) {
      const sessionStatus = latestSession.status;
      
      // If session is approved but wallet isn't verified, sync it
      if (sessionStatus === 'approved' && !kycVerified) {
        kycVerified = true;
        kycStatus = 'approved';
        // Update wallet
        if (wallet) {
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycVerified: true,
            kycStatus: 'approved',
            kycVerifiedAt: latestSession.completedAt || new Date(),
          });
        }
      }
      
      // If session is declined/expired/abandoned but wallet shows pending, sync it
      if (['declined', 'expired', 'abandoned', 'resubmission_requested'].includes(sessionStatus) && kycStatus === 'pending') {
        kycStatus = sessionStatus === 'resubmission_requested' ? 'declined' : sessionStatus;
        // Update wallet
        if (wallet) {
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycStatus: kycStatus,
          });
        }
      }
      
      // Check if session has been pending too long (over 1 hour) - likely abandoned
      if (sessionStatus === 'created' || sessionStatus === 'started') {
        const sessionAge = Date.now() - new Date(latestSession.createdAt).getTime();
        const oneHour = 60 * 60 * 1000;
        
        if (sessionAge > oneHour) {
          // Mark as expired so user can retry
          await KYCSession.findByIdAndUpdate(latestSession._id, { status: 'expired' });
          if (kycStatus === 'pending') {
            kycStatus = 'expired';
            if (wallet) {
              await CreditWallet.findByIdAndUpdate(wallet._id, { kycStatus: 'expired' });
            }
          }
        }
      }
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

