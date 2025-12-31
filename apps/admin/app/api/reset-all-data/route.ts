import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import TradingOrder from '@/database/models/trading/trading-order.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import UserLevel from '@/database/models/user-level.model';
import UserBadge from '@/database/models/user-badge.model';
import UserRestriction from '@/database/models/user-restriction.model';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import { FraudHistory } from '@/database/models/fraud/fraud-history.model';
import SuspicionScore from '@/database/models/fraud/suspicion-score.model';
import PaymentFingerprint from '@/database/models/fraud/payment-fingerprint.model';
import BehavioralSimilarity from '@/database/models/fraud/behavioral-similarity.model';
import TradingBehaviorProfile from '@/database/models/fraud/trading-behavior-profile.model';
import { PlatformTransaction, PlatformBalanceSnapshot } from '@/database/models/platform-financials.model';
import VATPayment from '@/database/models/vat-payment.model';
import Invoice from '@/database/models/invoice.model';
import AuditLog from '@/database/models/audit-log.model';
import Notification from '@/database/models/notification.model';
import NotificationTemplate from '@/database/models/notification-template.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import NuveiUserPaymentOption from '@/database/models/nuvei-user-payment-option.model';
import ReconciliationLog from '@/database/models/reconciliation-log.model';
import KYCSession from '@/database/models/kyc-session.model';
import UserNote from '@/database/models/user-notes.model';
import PositionEvent from '@/database/models/position-event.model';
import UserNotificationPreferences from '@/database/models/user-notification-preferences.model';
import UserPresence from '@/database/models/user-presence.model';
import { resetBadgeAndXPConfigs } from '@/lib/services/badge-config-seed.service';
import { auditLogService } from '@/lib/services/audit-log.service';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * ⚠️ DANGER: Reset ALL trading data
 * This will DELETE everything except user accounts and settings:
 * - All competitions and competition participants
 * - All 1v1 challenges and challenge participants
 * - All trading positions
 * - All trade history
 * - All orders
 * - All wallet transactions (keeps wallets, resets balance)
 * - All user badges and XP progress
 * - All fraud alerts, device fingerprints, and fraud history
 * - All suspicion scores, payment fingerprints, behavioral similarity
 * - All trading behavior profiles
 * - All user restrictions
 * - All platform financial data (fees, unclaimed pools, earnings, etc.)
 * - All invoices
 * - All audit logs
 * - All sent notifications
 * - All marketplace user purchases (keeps items, removes user purchases)
 * - All withdrawal requests
 * - All user bank accounts
 * - All Nuvei payment options (stored UPOs)
 * - All auth sessions (Better Auth 'session' collection - keeps login credentials)
 * - All orphan credit wallets (where user no longer exists)
 * - All reconciliation logs (audit history)
 * - All KYC sessions and resets KYC status on all wallets
 * - All user notes (admin notes about users)
 * - All position events
 * - All user notification preferences
 * - All user presence data
 * 
 * ✅ PRESERVES (will NOT delete):
 * - User accounts (the actual users in 'user' collection)
 * - WhiteLabel settings (environment variables, API keys)
 * - Payment provider configurations
 * - Admin settings (including fee settings, challenge settings)
 * - Marketplace items created by admin (only resets purchase counts)
 * - Dashboard layouts and preferences
 * - All settings collections (appsettings, challengesettings, etc.)
 * - KYC settings configuration (provider settings stay, session data deleted)
 * 
 * ✅ RESETS TO DEFAULTS:
 * - Badge configurations
 * - XP and level progression settings
 * - Notification templates (reseeds defaults, preserves custom)
 * - Marketplace item purchase counts
 * - KYC verification status on all wallets (reset to 'none')
 * 
 * POST /api/admin/reset-all-data
 */
export async function POST(request: Request) {
  try {
    const { confirmationCode } = await request.json();

    // Require confirmation code to prevent accidental deletion
    if (confirmationCode !== 'RESET_ALL_DATA') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid confirmation code. Must be exactly: RESET_ALL_DATA',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    console.log('🚨🚨🚨 STARTING FULL DATA RESET 🚨🚨🚨');

    // Get collections directly via mongoose (for collections without explicit models)
    const sessionCollection = mongoose.connection.collection('session'); // Auth sessions (NOT account - that has credentials!)
    const userCollection = mongoose.connection.collection('user');
    const alertsCollection = mongoose.connection.collection('alerts');
    const botExecutionsCollection = mongoose.connection.collection('botexecutions');
    
    // Get all existing user IDs
    const existingUsers = await userCollection.find({}, { projection: { _id: 1 } }).toArray();
    const existingUserIds = new Set(existingUsers.map(u => u._id.toString()));
    
    // Count orphan wallets (wallets where userId doesn't exist in user collection)
    const allWallets = await CreditWallet.find({}, { userId: 1 }).lean();
    const orphanWalletIds = allWallets
      .filter(w => !existingUserIds.has(w.userId.toString()))
      .map(w => w._id);

    // Count documents before deletion
    const before = {
      competitions: await Competition.countDocuments(),
      participants: await CompetitionParticipant.countDocuments(),
      challenges: await Challenge.countDocuments(),
      challengeParticipants: await ChallengeParticipant.countDocuments(),
      positions: await TradingPosition.countDocuments(),
      tradeHistory: await TradeHistory.countDocuments(),
      orders: await TradingOrder.countDocuments(),
      walletTransactions: await WalletTransaction.countDocuments(),
      wallets: await CreditWallet.countDocuments(),
      orphanWallets: orphanWalletIds.length,
      userLevels: await UserLevel.countDocuments(),
      userBadges: await UserBadge.countDocuments(),
      fraudAlerts: await FraudAlert.countDocuments(),
      deviceFingerprints: await DeviceFingerprint.countDocuments(),
      userRestrictions: await UserRestriction.countDocuments(),
      fraudHistory: await FraudHistory.countDocuments(),
      suspicionScores: await SuspicionScore.countDocuments(),
      paymentFingerprints: await PaymentFingerprint.countDocuments(),
      behavioralSimilarity: await BehavioralSimilarity.countDocuments(),
      tradingBehaviorProfiles: await TradingBehaviorProfile.countDocuments(),
      platformTransactions: await PlatformTransaction.countDocuments(),
      platformSnapshots: await PlatformBalanceSnapshot.countDocuments(),
      vatPayments: await VATPayment.countDocuments(),
      invoices: await Invoice.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      notifications: await Notification.countDocuments(),
      marketplacePurchases: await UserPurchase.countDocuments(),
      withdrawalRequests: await WithdrawalRequest.countDocuments(),
      userBankAccounts: await UserBankAccount.countDocuments(),
      nuveiPaymentOptions: await NuveiUserPaymentOption.countDocuments(),
      authSessions: await sessionCollection.countDocuments(),
      alerts: await alertsCollection.countDocuments(),
      botExecutions: await botExecutionsCollection.countDocuments(),
      reconciliationLogs: await ReconciliationLog.countDocuments(),
      kycSessions: await KYCSession.countDocuments(),
      userNotes: await UserNote.countDocuments(),
      positionEvents: await PositionEvent.countDocuments(),
      notificationPreferences: await UserNotificationPreferences.countDocuments(),
      userPresence: await UserPresence.countDocuments(),
    };

    console.log('📊 Before deletion:', before);

    // Delete all trading data
    await Competition.deleteMany({});
    console.log('✅ Deleted all competitions');

    await CompetitionParticipant.deleteMany({});
    console.log('✅ Deleted all competition participants');

    // Delete all challenge data
    await Challenge.deleteMany({});
    console.log('✅ Deleted all 1v1 challenges');

    await ChallengeParticipant.deleteMany({});
    console.log('✅ Deleted all challenge participants');

    await TradingPosition.deleteMany({});
    console.log('✅ Deleted all positions');

    await TradeHistory.deleteMany({});
    console.log('✅ Deleted all trade history');

    await TradingOrder.deleteMany({});
    console.log('✅ Deleted all orders');

    await WalletTransaction.deleteMany({});
    console.log('✅ Deleted all wallet transactions');

    // Delete user progress data
    await UserLevel.deleteMany({});
    console.log('✅ Deleted all user XP and levels');

    await UserBadge.deleteMany({});
    console.log('✅ Deleted all user badges');

    // Delete fraud detection data
    await FraudAlert.deleteMany({});
    console.log('✅ Deleted all fraud alerts');

    await DeviceFingerprint.deleteMany({});
    console.log('✅ Deleted all device fingerprints');

    await UserRestriction.deleteMany({});
    console.log('✅ Deleted all user restrictions');

    // Delete fraud history
    await FraudHistory.deleteMany({});
    console.log('✅ Deleted all fraud history');

    // Delete suspicion scores
    await SuspicionScore.deleteMany({});
    console.log('✅ Deleted all suspicion scores');

    // Delete payment fingerprints
    await PaymentFingerprint.deleteMany({});
    console.log('✅ Deleted all payment fingerprints');

    // Delete behavioral similarity
    await BehavioralSimilarity.deleteMany({});
    console.log('✅ Deleted all behavioral similarity records');

    // Delete trading behavior profiles
    await TradingBehaviorProfile.deleteMany({});
    console.log('✅ Deleted all trading behavior profiles');

    // Delete platform financial data (fees, unclaimed pools, etc.)
    await PlatformTransaction.deleteMany({});
    console.log('✅ Deleted all platform transactions (fees, unclaimed pools)');

    await PlatformBalanceSnapshot.deleteMany({});
    console.log('✅ Deleted all platform balance snapshots');

    // Delete VAT payments
    await VATPayment.deleteMany({});
    console.log('✅ Deleted all VAT payments');

    // Delete invoices
    await Invoice.deleteMany({});
    console.log('✅ Deleted all invoices');

    // Delete audit logs
    await AuditLog.deleteMany({});
    console.log('✅ Deleted all audit logs');

    // Delete notifications (sent notifications, NOT templates)
    await Notification.deleteMany({});
    console.log('✅ Deleted all notifications');

    // Delete marketplace user purchases (keeps marketplace items, just clears user purchases)
    await UserPurchase.deleteMany({});
    console.log('✅ Deleted all marketplace user purchases');

    // Delete all withdrawal requests
    await WithdrawalRequest.deleteMany({});
    console.log('✅ Deleted all withdrawal requests');

    // Delete all user bank accounts
    await UserBankAccount.deleteMany({});
    console.log('✅ Deleted all user bank accounts');

    // Delete all Nuvei payment options (stored UPOs)
    await NuveiUserPaymentOption.deleteMany({});
    console.log('✅ Deleted all Nuvei payment options');

    // Delete all auth sessions (Better Auth 'session' collection - NOT 'account' which has credentials!)
    const authSessionsDeleted = await sessionCollection.deleteMany({});
    console.log(`✅ Deleted ${authSessionsDeleted.deletedCount} auth sessions`);

    // Delete alerts collection data (price alerts, system alerts)
    const alertsDeleted = await alertsCollection.deleteMany({});
    console.log(`✅ Deleted ${alertsDeleted.deletedCount} alerts`);

    // Delete bot executions collection data
    const botExecutionsDeleted = await botExecutionsCollection.deleteMany({});
    console.log(`✅ Deleted ${botExecutionsDeleted.deletedCount} bot executions`);

    // Delete reconciliation logs (audit data)
    await ReconciliationLog.deleteMany({});
    console.log('✅ Deleted all reconciliation logs');

    // Delete ALL KYC sessions
    await KYCSession.deleteMany({});
    console.log('✅ Deleted all KYC sessions');

    // Delete all user notes
    await UserNote.deleteMany({});
    console.log('✅ Deleted all user notes');

    // Delete all position events
    await PositionEvent.deleteMany({});
    console.log('✅ Deleted all position events');

    // Delete all user notification preferences
    await UserNotificationPreferences.deleteMany({});
    console.log('✅ Deleted all user notification preferences');

    // Delete all user presence data
    await UserPresence.deleteMany({});
    console.log('✅ Deleted all user presence data');

    // Delete orphan credit wallets (where user no longer exists)
    if (orphanWalletIds.length > 0) {
      const orphanDeleteResult = await CreditWallet.deleteMany({ _id: { $in: orphanWalletIds } });
      console.log(`✅ Deleted ${orphanDeleteResult.deletedCount} orphan credit wallets`);
    }

    // Reset marketplace item purchase counts
    await MarketplaceItem.updateMany({}, { $set: { totalPurchases: 0 } });
    console.log('✅ Reset marketplace item purchase counts');

    // Reseed default notification templates (preserves custom templates)
    await NotificationTemplate.seedDefaults();
    console.log('✅ Reseeded default notification templates');

    // Reset all wallet balances to 0 (keep wallets, just reset all financial data)
    const walletResetResult = await CreditWallet.updateMany(
      {},
      {
        $set: {
          creditBalance: 0,                   // Reset current balance
          totalDeposited: 0,                  // Reset total deposits
          totalWithdrawn: 0,                  // Reset total withdrawals
          totalSpentOnCompetitions: 0,        // Reset competition spending
          totalWonFromCompetitions: 0,        // Reset competition winnings (Volt Won)
          totalSpentOnChallenges: 0,          // Reset challenge spending
          totalWonFromChallenges: 0,          // Reset challenge winnings
          totalSpentOnMarketplace: 0,         // Reset marketplace spending
          // Reset KYC status fields
          kycVerified: false,
          kycStatus: 'none',
          kycAttempts: 0,
        },
        $unset: {
          kycVerifiedAt: '',
          kycExpiresAt: '',
          lastKYCSessionId: '',
        },
      }
    );
    console.log(`✅ Reset ${walletResetResult.modifiedCount} wallet balances to 0 (including balances, competition/challenge winnings, KYC status)`);

    // Reset badge and XP configurations to defaults
    await resetBadgeAndXPConfigs();
    console.log('✅ Reset badge and XP configurations to defaults');

    // Count documents after deletion
    const after = {
      competitions: await Competition.countDocuments(),
      participants: await CompetitionParticipant.countDocuments(),
      challenges: await Challenge.countDocuments(),
      challengeParticipants: await ChallengeParticipant.countDocuments(),
      positions: await TradingPosition.countDocuments(),
      tradeHistory: await TradeHistory.countDocuments(),
      orders: await TradingOrder.countDocuments(),
      walletTransactions: await WalletTransaction.countDocuments(),
      wallets: await CreditWallet.countDocuments(),
      orphanWallets: 0, // All orphans deleted
      userLevels: await UserLevel.countDocuments(),
      userBadges: await UserBadge.countDocuments(),
      fraudAlerts: await FraudAlert.countDocuments(),
      deviceFingerprints: await DeviceFingerprint.countDocuments(),
      userRestrictions: await UserRestriction.countDocuments(),
      fraudHistory: await FraudHistory.countDocuments(),
      suspicionScores: await SuspicionScore.countDocuments(),
      paymentFingerprints: await PaymentFingerprint.countDocuments(),
      behavioralSimilarity: await BehavioralSimilarity.countDocuments(),
      tradingBehaviorProfiles: await TradingBehaviorProfile.countDocuments(),
      platformTransactions: await PlatformTransaction.countDocuments(),
      platformSnapshots: await PlatformBalanceSnapshot.countDocuments(),
      vatPayments: await VATPayment.countDocuments(),
      invoices: await Invoice.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      notifications: await Notification.countDocuments(),
      marketplacePurchases: await UserPurchase.countDocuments(),
      withdrawalRequests: await WithdrawalRequest.countDocuments(),
      userBankAccounts: await UserBankAccount.countDocuments(),
      nuveiPaymentOptions: await NuveiUserPaymentOption.countDocuments(),
      authSessions: await sessionCollection.countDocuments(),
      alerts: await alertsCollection.countDocuments(),
      botExecutions: await botExecutionsCollection.countDocuments(),
      reconciliationLogs: await ReconciliationLog.countDocuments(),
      kycSessions: await KYCSession.countDocuments(),
      userNotes: await UserNote.countDocuments(),
      positionEvents: await PositionEvent.countDocuments(),
      notificationPreferences: await UserNotificationPreferences.countDocuments(),
      userPresence: await UserPresence.countDocuments(),
    };

    console.log('📊 After deletion:', after);
    console.log('🎉 DATA RESET COMPLETE');

    // Log this action to audit log
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logDatabaseReset(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          before
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'All trading data has been reset and badge/XP configs restored to defaults',
      before,
      after,
      deleted: {
        competitions: before.competitions,
        participants: before.participants,
        challenges: before.challenges,
        challengeParticipants: before.challengeParticipants,
        positions: before.positions,
        tradeHistory: before.tradeHistory,
        orders: before.orders,
        walletTransactions: before.walletTransactions,
        orphanWallets: before.orphanWallets,
        userLevels: before.userLevels,
        userBadges: before.userBadges,
        fraudAlerts: before.fraudAlerts,
        deviceFingerprints: before.deviceFingerprints,
        userRestrictions: before.userRestrictions,
        fraudHistory: before.fraudHistory,
        suspicionScores: before.suspicionScores,
        paymentFingerprints: before.paymentFingerprints,
        behavioralSimilarity: before.behavioralSimilarity,
        tradingBehaviorProfiles: before.tradingBehaviorProfiles,
        platformTransactions: before.platformTransactions,
        platformSnapshots: before.platformSnapshots,
        vatPayments: before.vatPayments,
        invoices: before.invoices,
        auditLogs: before.auditLogs,
        marketplacePurchases: before.marketplacePurchases,
        withdrawalRequests: before.withdrawalRequests,
        userBankAccounts: before.userBankAccounts,
        nuveiPaymentOptions: before.nuveiPaymentOptions,
        authSessions: before.authSessions,
        alerts: before.alerts,
        botExecutions: before.botExecutions,
        reconciliationLogs: before.reconciliationLogs,
        kycSessions: before.kycSessions,
        userNotes: before.userNotes,
        positionEvents: before.positionEvents,
        notificationPreferences: before.notificationPreferences,
        userPresence: before.userPresence,
      },
      walletsReset: walletResetResult.modifiedCount,
    });
  } catch (error) {
    console.error('❌ Error resetting data:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to reset data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
