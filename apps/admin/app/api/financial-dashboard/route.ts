import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import { PlatformFinancialsService } from '@/lib/services/platform-financials.service';
import { getUsersByIds } from '@/lib/utils/user-lookup';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production'
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get all user wallets
    const wallets = await CreditWallet.find()
      .sort({ creditBalance: -1 })
      .limit(100)
      .lean();

    // Get user info for wallets
    const userIds = wallets.map(w => w.userId);
    const usersMap = await getUsersByIds(userIds);

    // Get pending withdrawals from WithdrawalRequest (source of truth)
    const pendingWithdrawalRequests = await WithdrawalRequest.find({
      status: { $in: ['pending', 'approved', 'processing'] },
    })
      .sort({ requestedAt: -1 })
      .lean();

    // Get conversion settings
    const conversionSettings = await CreditConversionSettings.getSingleton();

    // Get comprehensive platform financial stats
    const platformFinancialStats = await PlatformFinancialsService.getFinancialStats();
    const unclaimedPoolsSummary = await PlatformFinancialsService.getUnclaimedPoolsSummary();

    // Get total platform fees earned (from wallet transactions)
    const platformFees = await WalletTransaction.aggregate([
      {
        $match: { transactionType: 'platform_fee' },
      },
      {
        $group: {
          _id: null,
          totalFees: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent transactions (last 50) with user info
    const recentTransactions = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Collect all user IDs from transactions and withdrawal requests
    const withdrawalUserIds = pendingWithdrawalRequests.map(w => w.userId);
    const txUserIds = [...new Set([
      ...recentTransactions.map(t => t.userId).filter(id => id !== 'platform'),
      ...withdrawalUserIds,
    ])];
    const txUsersMap = await getUsersByIds(txUserIds);

    // Calculate totals from wallets (including both competitions and challenges)
    const totalCreditsInCirculation = wallets.reduce((sum, w) => sum + (w.creditBalance || 0), 0);
    const totalDeposited = wallets.reduce((sum, w) => sum + (w.totalDeposited || 0), 0);
    const totalWithdrawn = wallets.reduce((sum, w) => sum + (w.totalWithdrawn || 0), 0);
    const totalWonFromCompetitions = wallets.reduce((sum, w) => sum + (w.totalWonFromCompetitions || 0), 0);
    const totalSpentOnCompetitions = wallets.reduce((sum, w) => sum + (w.totalSpentOnCompetitions || 0), 0);
    const totalWonFromChallenges = wallets.reduce((sum, w) => sum + (w.totalWonFromChallenges || 0), 0);
    const totalSpentOnChallenges = wallets.reduce((sum, w) => sum + (w.totalSpentOnChallenges || 0), 0);

    // Calculate liability metrics
    const conversionRate = conversionSettings.eurToCreditsRate;
    const totalLiabilityEUR = totalCreditsInCirculation / conversionRate;
    // Use WithdrawalRequest for accurate pending amounts (in EUR)
    const pendingWithdrawalsEUR = pendingWithdrawalRequests.reduce((sum, w) => sum + (w.amountEUR || 0), 0);
    const pendingWithdrawalsTotal = pendingWithdrawalsEUR * conversionRate; // Convert back to credits for display

    return NextResponse.json({
      success: true,
      data: {
        wallets: wallets.map((w) => {
          const userInfo = usersMap.get(w.userId);
          return {
            userId: w.userId,
            userName: userInfo?.name || 'Unknown',
            userEmail: userInfo?.email || 'Unknown',
            creditBalance: w.creditBalance,
            totalDeposited: w.totalDeposited,
            totalWithdrawn: w.totalWithdrawn,
            totalWonFromCompetitions: w.totalWonFromCompetitions || 0,
            totalSpentOnCompetitions: w.totalSpentOnCompetitions || 0,
            totalWonFromChallenges: w.totalWonFromChallenges || 0,
            totalSpentOnChallenges: w.totalSpentOnChallenges || 0,
          };
        }),
        pendingWithdrawals: pendingWithdrawalRequests.map((w) => {
          const userInfo = txUsersMap.get(w.userId);
          return {
            _id: w._id,
            userId: w.userId,
            userName: w.userName || userInfo?.name || 'Unknown',
            userEmail: w.userEmail || userInfo?.email || 'Unknown',
            amount: -(w.amountCredits || 0), // Negative for display consistency
            amountEUR: w.amountEUR || 0,
            status: w.status,
            createdAt: w.requestedAt,
            // Fee details
            platformFee: w.platformFee || 0,
            bankFee: w.bankFee || 0,
            netAmountEUR: w.netAmountEUR || 0,
            metadata: {
              netAmountEUR: w.netAmountEUR,
              platformFee: w.platformFee,
              bankFee: w.bankFee,
              amountEUR: w.amountEUR,
            },
          };
        }),
        platformStats: {
          totalCreditsInCirculation,
          totalDeposited,
          totalWithdrawn,
          totalWonFromCompetitions,
          totalSpentOnCompetitions,
          totalWonFromChallenges,
          totalSpentOnChallenges,
          totalPlatformFees: platformFees[0]?.totalFees || 0,
          totalFeeTransactions: platformFees[0]?.count || 0,
        },
        // NEW: Enhanced platform financial metrics
        platformFinancials: {
          ...platformFinancialStats,
          unclaimedPools: unclaimedPoolsSummary,
        },
        // NEW: Liability tracking for bank reconciliation
        liabilityMetrics: {
          totalUserCredits: totalCreditsInCirculation,
          totalUserCreditsEUR: totalLiabilityEUR,
          pendingWithdrawals: pendingWithdrawalsTotal,
          pendingWithdrawalsEUR: pendingWithdrawalsEUR,
          totalLiability: totalLiabilityEUR + pendingWithdrawalsEUR,
          // What should be in bank: User Deposits - User Withdrawals - Admin Withdrawals
          theoreticalBankBalance: platformFinancialStats.theoreticalBankBalance,
          // Coverage ratio: Can we pay all users if they withdraw?
          coverageRatio: platformFinancialStats.coverageRatio,
          // Net platform position (earnings minus admin withdrawals)
          platformNetCredits: platformFinancialStats.platformNetCredits,
          platformNetEUR: platformFinancialStats.platformNetEUR,
        },
        recentTransactions: await Promise.all(recentTransactions.slice(0, 20).map(async (t) => {
          const userInfo = t.userId === 'platform' 
            ? { name: 'Platform', email: 'system' }
            : txUsersMap.get(t.userId);
          
          // For withdrawals, get actual status and fee details from WithdrawalRequest (source of truth)
          let actualStatus = t.status;
          let enrichedMetadata = { ...t.metadata };
          
          if (t.transactionType === 'withdrawal' && t.metadata?.withdrawalRequestId) {
            const withdrawalReq = await WithdrawalRequest.findById(t.metadata.withdrawalRequestId).lean();
            if (withdrawalReq) {
              // Map withdrawal request status to wallet transaction status
              if (withdrawalReq.status === 'completed') actualStatus = 'completed';
              else if (withdrawalReq.status === 'rejected' || withdrawalReq.status === 'failed') actualStatus = 'failed';
              else if (withdrawalReq.status === 'cancelled') actualStatus = 'cancelled';
              else actualStatus = 'pending'; // pending, approved, processing all show as pending
              
              // Enrich metadata with fee details
              enrichedMetadata = {
                ...enrichedMetadata,
                amountEUR: withdrawalReq.amountEUR,
                platformFee: withdrawalReq.platformFee,
                bankFee: withdrawalReq.bankFee,
                netAmountEUR: withdrawalReq.netAmountEUR,
                withdrawalStatus: withdrawalReq.status,
              };
            }
          }
          
          return {
            _id: t._id,
            userId: t.userId,
            userName: userInfo?.name || 'Unknown',
            userEmail: userInfo?.email || 'Unknown',
            transactionType: t.transactionType,
            amount: t.amount,
            status: actualStatus,
            createdAt: t.createdAt,
            description: t.description,
            competitionId: t.competitionId,
            paymentMethod: t.paymentMethod,
            metadata: enrichedMetadata,
          };
        })),
        conversionRate: conversionSettings.eurToCreditsRate,
      },
    });
  } catch (error) {
    console.error('Error fetching financial dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

