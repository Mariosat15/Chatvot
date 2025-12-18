import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
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
import { PlatformTransaction, PlatformBalanceSnapshot } from '@/database/models/platform-financials.model';
import VATPayment from '@/database/models/vat-payment.model';
import Invoice from '@/database/models/invoice.model';
import AuditLog from '@/database/models/audit-log.model';
import Notification from '@/database/models/notification.model';
import NotificationTemplate from '@/database/models/notification-template.model';
import { UserPurchase } from '@/database/models/marketplace/user-purchase.model';
import { MarketplaceItem } from '@/database/models/marketplace/marketplace-item.model';
import { resetBadgeAndXPConfigs } from '@/lib/services/badge-config-seed.service';
import { auditLogService } from '@/lib/services/audit-log.service';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * ⚠️ DANGER: Reset ALL trading data
 * This will DELETE everything except user accounts:
 * - All competitions and competition participants
 * - All 1v1 challenges and challenge participants
 * - All trading positions
 * - All trade history
 * - All orders
 * - All wallet transactions (keeps wallets, resets balance)
 * - All user badges and XP progress
 * - All fraud alerts, device fingerprints, and fraud history
 * - All user restrictions
 * - All platform financial data (fees, unclaimed pools, earnings, etc.)
 * - All invoices
 * - All audit logs
 * - All sent notifications
 * - All marketplace user purchases (keeps items, removes user purchases)
 * 
 * ✅ PRESERVES (will NOT delete):
 * - User accounts
 * - WhiteLabel settings (environment variables, API keys)
 * - Payment provider configurations
 * - Admin settings (including fee settings, challenge settings)
 * - Marketplace items created by admin (only resets purchase counts)
 * 
 * ✅ RESETS TO DEFAULTS:
 * - Badge configurations
 * - XP and level progression settings
 * - Notification templates (reseeds defaults, preserves custom)
 * - Marketplace item purchase counts
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
      userLevels: await UserLevel.countDocuments(),
      userBadges: await UserBadge.countDocuments(),
      fraudAlerts: await FraudAlert.countDocuments(),
      deviceFingerprints: await DeviceFingerprint.countDocuments(),
      userRestrictions: await UserRestriction.countDocuments(),
      fraudHistory: await FraudHistory.countDocuments(),
      platformTransactions: await PlatformTransaction.countDocuments(),
      platformSnapshots: await PlatformBalanceSnapshot.countDocuments(),
      vatPayments: await VATPayment.countDocuments(),
      invoices: await Invoice.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      notifications: await Notification.countDocuments(),
      marketplacePurchases: await UserPurchase.countDocuments(),
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
        },
      }
    );
    console.log(`✅ Reset ${walletResetResult.modifiedCount} wallet balances to 0 (including balances, competition/challenge winnings)`);

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
      userLevels: await UserLevel.countDocuments(),
      userBadges: await UserBadge.countDocuments(),
      fraudAlerts: await FraudAlert.countDocuments(),
      deviceFingerprints: await DeviceFingerprint.countDocuments(),
      userRestrictions: await UserRestriction.countDocuments(),
      fraudHistory: await FraudHistory.countDocuments(),
      platformTransactions: await PlatformTransaction.countDocuments(),
      platformSnapshots: await PlatformBalanceSnapshot.countDocuments(),
      vatPayments: await VATPayment.countDocuments(),
      invoices: await Invoice.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      notifications: await Notification.countDocuments(),
      marketplacePurchases: await UserPurchase.countDocuments(),
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
        userLevels: before.userLevels,
        userBadges: before.userBadges,
        fraudAlerts: before.fraudAlerts,
        deviceFingerprints: before.deviceFingerprints,
        userRestrictions: before.userRestrictions,
        fraudHistory: before.fraudHistory,
        platformTransactions: before.platformTransactions,
        platformSnapshots: before.platformSnapshots,
        vatPayments: before.vatPayments,
        invoices: before.invoices,
        auditLogs: before.auditLogs,
        marketplacePurchases: before.marketplacePurchases,
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
