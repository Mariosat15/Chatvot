import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
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

    // Get pending withdrawals
    const pendingWithdrawals = await WalletTransaction.find({
      transactionType: 'withdrawal',
      status: 'pending',
    })
      .sort({ createdAt: -1 })
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

    const txUserIds = [...new Set(recentTransactions.map(t => t.userId).filter(id => id !== 'platform'))];
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
    const pendingWithdrawalsTotal = pendingWithdrawals.reduce((sum, w) => sum + Math.abs(w.amount), 0);
    const pendingWithdrawalsEUR = pendingWithdrawalsTotal / conversionRate;

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
        pendingWithdrawals: pendingWithdrawals.map((t) => {
          const userInfo = txUsersMap.get(t.userId);
          return {
            _id: t._id,
            userId: t.userId,
            userName: userInfo?.name || 'Unknown',
            userEmail: userInfo?.email || 'Unknown',
            amount: t.amount,
            createdAt: t.createdAt,
            metadata: t.metadata,
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
        recentTransactions: recentTransactions.slice(0, 20).map((t) => {
          const userInfo = t.userId === 'platform' 
            ? { name: 'Platform', email: 'system' }
            : txUsersMap.get(t.userId);
          return {
            _id: t._id,
            userId: t.userId,
            userName: userInfo?.name || 'Unknown',
            userEmail: userInfo?.email || 'Unknown',
            transactionType: t.transactionType,
            amount: t.amount,
            status: t.status,
            createdAt: t.createdAt,
            description: t.description,
            competitionId: t.competitionId,
            paymentMethod: t.paymentMethod,
            metadata: t.metadata,
          };
        }),
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

