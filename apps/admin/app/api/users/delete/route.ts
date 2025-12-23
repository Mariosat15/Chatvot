import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import TradingOrder from '@/database/models/trading/trading-order.model';
import UserBadge from '@/database/models/user-badge.model';
import UserLevel from '@/database/models/user-level.model';
// Fraud-related models
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import UserRestriction from '@/database/models/user-restriction.model';
import SuspicionScore from '@/database/models/fraud/suspicion-score.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import PaymentFingerprint from '@/database/models/fraud/payment-fingerprint.model';
import BehavioralSimilarity from '@/database/models/fraud/behavioral-similarity.model';
import TradingBehaviorProfile from '@/database/models/fraud/trading-behavior-profile.model';
import { FraudHistory } from '@/database/models/fraud/fraud-history.model';
// Invoice model
import Invoice from '@/database/models/invoice.model';
// Platform financials (for user-specific transactions)
import { PlatformTransaction } from '@/database/models/platform-financials.model';
// Withdrawal models
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import { ObjectId } from 'mongodb';
import { getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * DELETE /api/admin/users/delete
 * Delete user and ALL their data from the database
 * 
 * This deletes from:
 * - better-auth collections: user, session, account
 * - Trading: wallet, transactions, participants, positions, orders, trade history
 * - Progression: badges, levels
 * - Fraud: device fingerprints, restrictions, suspicion scores, alerts, 
 *          payment fingerprints, behavioral similarity, trading profiles, fraud history
 * - Invoices
 * - Platform transactions (user-specific)
 * - Withdrawal requests
 * - User bank accounts
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    console.log(`🗑️ Starting FULL deletion of user ${userId} and all related data...`);

    // Get mongoose connection for Better Auth collections
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Track what was deleted
    const deletionResults: Record<string, number> = {};

    // ============================================
    // 1. DELETE FROM BETTER-AUTH COLLECTIONS
    // ============================================
    
    // Try multiple ways to find and delete the user (better-auth uses 'id' field)
    let userDeleteResult = await db.collection('user').deleteOne({ id: userId });
    
    // If not found by 'id', try by '_id' as ObjectId
    if (userDeleteResult.deletedCount === 0) {
      try {
        if (ObjectId.isValid(userId)) {
          userDeleteResult = await db.collection('user').deleteOne({ _id: new ObjectId(userId) });
        }
      } catch {
        // Not a valid ObjectId
      }
    }
    
    // If still not found, try by '_id' as string
    if (userDeleteResult.deletedCount === 0) {
      userDeleteResult = await db.collection('user').deleteOne({ _id: userId });
    }
    
    deletionResults.user = userDeleteResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.user} user record`);

    // Delete sessions (try both userId formats)
    const sessionDeleteResult = await db.collection('session').deleteMany({ 
      $or: [{ userId }, { userId: userId }] 
    });
    deletionResults.sessions = sessionDeleteResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.sessions} sessions`);

    // Delete accounts (OAuth providers - better-auth stores these)
    const accountDeleteResult = await db.collection('account').deleteMany({ userId });
    deletionResults.accounts = accountDeleteResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.accounts} accounts (OAuth)`);

    // ============================================
    // 2. DELETE TRADING DATA
    // ============================================

    // Delete wallet
    const walletResult = await CreditWallet.deleteOne({ userId });
    deletionResults.wallet = walletResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.wallet} wallet`);

    // Delete wallet transactions
    const walletTxResult = await WalletTransaction.deleteMany({ userId });
    deletionResults.walletTransactions = walletTxResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.walletTransactions} wallet transactions`);

    // Delete competition participants
    const participantsResult = await CompetitionParticipant.deleteMany({ userId });
    deletionResults.competitionParticipants = participantsResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.competitionParticipants} competition participants`);

    // Delete trading positions
    const positionsResult = await TradingPosition.deleteMany({ userId });
    deletionResults.tradingPositions = positionsResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.tradingPositions} trading positions`);

    // Delete trade history
    const tradeHistoryResult = await TradeHistory.deleteMany({ userId });
    deletionResults.tradeHistory = tradeHistoryResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.tradeHistory} trade history records`);

    // Delete trading orders
    const ordersResult = await TradingOrder.deleteMany({ userId });
    deletionResults.tradingOrders = ordersResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.tradingOrders} trading orders`);

    // ============================================
    // 3. DELETE PROGRESSION DATA
    // ============================================

    // Delete user badges
    const badgesResult = await UserBadge.deleteMany({ userId });
    deletionResults.userBadges = badgesResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.userBadges} user badges`);

    // Delete user level data
    const levelResult = await UserLevel.deleteOne({ userId });
    deletionResults.userLevel = levelResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.userLevel} user level record`);

    // ============================================
    // 4. DELETE FRAUD DATA
    // ============================================

    // Delete device fingerprints
    const deviceResult = await DeviceFingerprint.deleteMany({ userId });
    deletionResults.deviceFingerprints = deviceResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.deviceFingerprints} device fingerprints`);

    // Delete user restrictions
    const restrictionResult = await UserRestriction.deleteMany({ userId });
    deletionResults.userRestrictions = restrictionResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.userRestrictions} user restrictions`);

    // Delete suspicion scores
    const suspicionResult = await SuspicionScore.deleteMany({ userId });
    deletionResults.suspicionScores = suspicionResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.suspicionScores} suspicion scores`);

    // Delete fraud alerts where user is involved
    const alertResult = await FraudAlert.deleteMany({ 
      $or: [
        { suspiciousUserIds: userId },
        { 'metadata.userId': userId }
      ]
    });
    deletionResults.fraudAlerts = alertResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.fraudAlerts} fraud alerts`);

    // Delete payment fingerprints
    const paymentFpResult = await PaymentFingerprint.deleteMany({ userId });
    deletionResults.paymentFingerprints = paymentFpResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.paymentFingerprints} payment fingerprints`);

    // Delete behavioral similarity data
    const behavioralResult = await BehavioralSimilarity.deleteMany({
      $or: [{ userId1: userId }, { userId2: userId }]
    });
    deletionResults.behavioralSimilarity = behavioralResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.behavioralSimilarity} behavioral similarities`);

    // Delete trading behavior profile
    const tradingProfileResult = await TradingBehaviorProfile.deleteMany({ userId });
    deletionResults.tradingBehaviorProfiles = tradingProfileResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.tradingBehaviorProfiles} trading behavior profiles`);

    // Delete fraud history
    const fraudHistoryResult = await FraudHistory.deleteMany({ userId });
    deletionResults.fraudHistory = fraudHistoryResult.deletedCount;
    console.log(`✅ Deleted ${deletionResults.fraudHistory} fraud history records`);

    // ============================================
    // 5. DELETE INVOICES
    // ============================================

    // Delete invoices (try with both string and ObjectId)
    let invoiceResult;
    try {
      if (ObjectId.isValid(userId)) {
        invoiceResult = await Invoice.deleteMany({ 
          $or: [{ userId }, { userId: new ObjectId(userId) }] 
        });
      } else {
        invoiceResult = await Invoice.deleteMany({ userId });
      }
      deletionResults.invoices = invoiceResult.deletedCount;
      console.log(`✅ Deleted ${deletionResults.invoices} invoices`);
    } catch (e) {
      console.log(`⚠️ No invoices to delete or Invoice model not found`);
      deletionResults.invoices = 0;
    }

    // ============================================
    // 6. DELETE PLATFORM TRANSACTIONS (user-specific)
    // ============================================

    try {
      const platformTxResult = await PlatformTransaction.deleteMany({ userId });
      deletionResults.platformTransactions = platformTxResult.deletedCount;
      console.log(`✅ Deleted ${deletionResults.platformTransactions} platform transactions`);
    } catch (e) {
      console.log(`⚠️ No platform transactions to delete`);
      deletionResults.platformTransactions = 0;
    }

    // ============================================
    // 7. DELETE WITHDRAWAL DATA
    // ============================================

    // Delete withdrawal requests
    try {
      const withdrawalResult = await WithdrawalRequest.deleteMany({ userId });
      deletionResults.withdrawalRequests = withdrawalResult.deletedCount;
      console.log(`✅ Deleted ${deletionResults.withdrawalRequests} withdrawal requests`);
    } catch (e) {
      console.log(`⚠️ No withdrawal requests to delete`);
      deletionResults.withdrawalRequests = 0;
    }

    // Delete user bank accounts
    try {
      const bankAccountResult = await UserBankAccount.deleteMany({ userId });
      deletionResults.userBankAccounts = bankAccountResult.deletedCount;
      console.log(`✅ Deleted ${deletionResults.userBankAccounts} user bank accounts`);
    } catch (e) {
      console.log(`⚠️ No user bank accounts to delete`);
      deletionResults.userBankAccounts = 0;
    }

    console.log('');
    console.log('🎉 User deletion complete!');
    console.log('📊 Summary:', deletionResults);

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logUserDeleted(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          userId,
          'Deleted User',
          userId
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'User and all related data deleted successfully',
      deletionResults,
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

