/**
 * KYC Expiry Check Job
 * 
 * Runs daily to:
 * 1. Check for expiring KYC verifications (document expiry & data retention)
 * 2. Send reminder notifications (30 days, 7 days, 1 day before)
 * 3. Auto-reset KYC status when expired
 */

import { connectToDatabase } from '../config/database';
import CreditWallet from '../../database/models/trading/credit-wallet.model';
import KYCSession from '../../database/models/kyc-session.model';
import KYCSettings from '../../database/models/kyc-settings.model';
import Notification from '../../database/models/notification.model';

interface KYCExpiryResult {
  checkedUsers: number;
  expiringSoon30Days: number;
  expiringSoon7Days: number;
  expiringSoon1Day: number;
  expired: number;
  dataRetentionExpiring: number;
  notificationsSent: number;
  errors: string[];
}

export async function runKYCExpiryCheck(): Promise<KYCExpiryResult> {
  const result: KYCExpiryResult = {
    checkedUsers: 0,
    expiringSoon30Days: 0,
    expiringSoon7Days: 0,
    expiringSoon1Day: 0,
    expired: 0,
    dataRetentionExpiring: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Get KYC settings
    const settings = await KYCSettings.findOne();
    if (!settings?.enabled) {
      console.log('   KYC is disabled, skipping expiry check');
      return result;
    }

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find all verified users with KYC
    const verifiedWallets = await CreditWallet.find({
      kycVerified: true,
      kycExpiresAt: { $exists: true },
    }).lean();

    result.checkedUsers = verifiedWallets.length;

    for (const wallet of verifiedWallets) {
      try {
        const userId = wallet.userId;
        const expiresAt = new Date(wallet.kycExpiresAt!);

        // Check if already expired
        if (expiresAt <= now) {
          result.expired++;
          
          // Reset KYC status
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycVerified: false,
            kycStatus: 'expired',
          });

          // Send expired notification
          await sendKYCNotification(userId, 'kyc_expired', {
            expiryDate: expiresAt.toLocaleDateString(),
          });
          result.notificationsSent++;
          
          console.log(`   🔴 Expired KYC for user ${userId}`);
          continue;
        }

        // Check if expiring in 1 day
        if (expiresAt <= oneDayFromNow) {
          result.expiringSoon1Day++;
          
          // Check if we already sent this notification today
          const alreadyNotified = await hasRecentNotification(userId, 'kyc_expiring_1day', 1);
          if (!alreadyNotified) {
            await sendKYCNotification(userId, 'kyc_expiring_1day', {
              expiryDate: expiresAt.toLocaleDateString(),
              daysRemaining: 1,
            });
            result.notificationsSent++;
          }
          continue;
        }

        // Check if expiring in 7 days
        if (expiresAt <= sevenDaysFromNow) {
          result.expiringSoon7Days++;
          
          const alreadyNotified = await hasRecentNotification(userId, 'kyc_expiring_7days', 5);
          if (!alreadyNotified) {
            await sendKYCNotification(userId, 'kyc_expiring_7days', {
              expiryDate: expiresAt.toLocaleDateString(),
              daysRemaining: Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
            });
            result.notificationsSent++;
          }
          continue;
        }

        // Check if expiring in 30 days
        if (expiresAt <= thirtyDaysFromNow) {
          result.expiringSoon30Days++;
          
          const alreadyNotified = await hasRecentNotification(userId, 'kyc_expiring_30days', 25);
          if (!alreadyNotified) {
            await sendKYCNotification(userId, 'kyc_expiring_30days', {
              expiryDate: expiresAt.toLocaleDateString(),
              daysRemaining: Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
            });
            result.notificationsSent++;
          }
        }

      } catch (error) {
        result.errors.push(`Error processing user ${wallet.userId}: ${error}`);
      }
    }

    // Check for data retention expiry (Veriff deletes data after 2 years)
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringDataRetentionSessions = await KYCSession.find({
      status: 'approved',
      dataRetentionExpiresAt: { 
        $exists: true, 
        $lte: thirtyDaysAhead,
        $gt: now 
      },
    }).lean();

    for (const session of expiringDataRetentionSessions) {
      try {
        const userId = session.userId;
        const dataRetentionExpiry = new Date(session.dataRetentionExpiresAt!);
        const daysRemaining = Math.ceil((dataRetentionExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        result.dataRetentionExpiring++;

        // Send notification based on days remaining
        let notificationType: string;
        let checkDays: number;
        
        if (daysRemaining <= 1) {
          notificationType = 'kyc_data_retention_1day';
          checkDays = 1;
        } else if (daysRemaining <= 7) {
          notificationType = 'kyc_data_retention_7days';
          checkDays = 5;
        } else {
          notificationType = 'kyc_data_retention_30days';
          checkDays = 25;
        }

        const alreadyNotified = await hasRecentNotification(userId, notificationType, checkDays);
        if (!alreadyNotified) {
          await sendKYCNotification(userId, 'kyc_data_retention_expiring', {
            expiryDate: dataRetentionExpiry.toLocaleDateString(),
            daysRemaining,
          });
          result.notificationsSent++;
        }

      } catch (error) {
        result.errors.push(`Error processing data retention for session ${session._id}: ${error}`);
      }
    }

    // Handle data retention that has already expired
    const expiredDataRetentionSessions = await KYCSession.find({
      status: 'approved',
      dataRetentionExpiresAt: { $lte: now },
    }).lean();

    for (const session of expiredDataRetentionSessions) {
      try {
        const wallet = await CreditWallet.findOne({ userId: session.userId });
        if (wallet?.kycVerified) {
          // Reset KYC since Veriff no longer has the verification data
          await CreditWallet.findByIdAndUpdate(wallet._id, {
            kycVerified: false,
            kycStatus: 'expired',
          });

          await sendKYCNotification(session.userId, 'kyc_data_retention_expired', {
            expiryDate: new Date(session.dataRetentionExpiresAt!).toLocaleDateString(),
          });
          result.notificationsSent++;
          result.expired++;
          
          console.log(`   🔴 Data retention expired for user ${session.userId}, KYC reset`);
        }
      } catch (error) {
        result.errors.push(`Error handling expired data retention for ${session._id}: ${error}`);
      }
    }

  } catch (error) {
    result.errors.push(`Global error: ${error}`);
  }

  return result;
}

/**
 * Check if user has received a similar notification recently
 */
async function hasRecentNotification(
  userId: string, 
  notificationType: string, 
  withinDays: number
): Promise<boolean> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - withinDays);

  const existing = await Notification.findOne({
    userId,
    type: notificationType,
    createdAt: { $gte: sinceDate },
  });

  return !!existing;
}

/**
 * Send a KYC-related notification
 */
async function sendKYCNotification(
  userId: string,
  type: string,
  metadata: Record<string, any>
): Promise<void> {
  const notificationMessages: Record<string, { title: string; message: string }> = {
    kyc_expired: {
      title: '⚠️ Identity Verification Expired',
      message: `Your identity verification expired on ${metadata.expiryDate}. Please re-verify to continue using withdrawal features.`,
    },
    kyc_expiring_1day: {
      title: '🔔 Identity Verification Expiring Tomorrow',
      message: `Your identity verification will expire on ${metadata.expiryDate}. Please re-verify soon to avoid interruption.`,
    },
    kyc_expiring_7days: {
      title: '📅 Identity Verification Expiring Soon',
      message: `Your identity verification will expire in ${metadata.daysRemaining} days (${metadata.expiryDate}). Please plan to re-verify.`,
    },
    kyc_expiring_30days: {
      title: '📆 Identity Verification Reminder',
      message: `Your identity verification will expire in ${metadata.daysRemaining} days (${metadata.expiryDate}). You will need to re-verify to continue withdrawals.`,
    },
    kyc_data_retention_expiring: {
      title: '📋 Re-verification Required Soon',
      message: `Your verification records will be removed in ${metadata.daysRemaining} days (${metadata.expiryDate}) due to data retention policy. You will need to re-verify your identity.`,
    },
    kyc_data_retention_expired: {
      title: '🔄 Re-verification Required',
      message: `Your verification records have been removed due to data retention policy. Please re-verify your identity to continue using withdrawal features.`,
    },
  };

  const notification = notificationMessages[type] || {
    title: 'KYC Update',
    message: 'Your identity verification status has been updated.',
  };

  await Notification.create({
    userId,
    type,
    title: notification.title,
    message: notification.message,
    priority: type.includes('expired') || type.includes('1day') ? 'high' : 'normal',
    metadata,
    read: false,
    channels: ['in_app'],
  });
}

