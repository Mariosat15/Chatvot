import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import ReconciliationLog from '@/database/models/reconciliation-log.model';
import mongoose from 'mongoose';

interface ReconciliationIssue {
  type: 'balance_mismatch' | 'deposit_total_mismatch' | 'withdrawal_total_mismatch' | 
        'orphan_transaction' | 'orphan_withdrawal' | 'duplicate_transaction' |
        'missing_platform_transaction' | 'orphan_wallet' | string;
  severity: 'critical' | 'warning' | 'info';
  userId?: string;
  userEmail?: string;
  details: {
    expected?: number;
    actual?: number;
    difference?: number;
    transactionId?: string;
    withdrawalId?: string;
    description: string;
  };
}

interface UserReconciliationDetail {
  userId: string;
  userEmail: string;
  userName: string;
  wallet: {
    creditBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalWonFromCompetitions: number;
    totalWonFromChallenges: number;
    totalSpentOnCompetitions: number;
    totalSpentOnChallenges: number;
    totalSpentOnMarketplace: number;
  };
  calculated: {
    expectedBalance: number;
    balanceFromTransactions: number;
    depositTotal: number;
    withdrawalTotal: number;
    competitionWinTotal: number;
    challengeWinTotal: number;
    competitionSpentTotal: number;
    challengeSpentTotal: number;
    marketplaceSpentTotal: number;
  };
  transactionBreakdown: {
    deposits: number;
    withdrawals: number;
    competitionJoins: number;
    competitionWins: number;
    challengeJoins: number;
    challengeWins: number;
    marketplacePurchases: number;
    adminAdjustments: number;
    refunds: number;
    other: number;
  };
  issues: ReconciliationIssue[];
  healthy: boolean;
}

/**
 * GET /api/reconciliation
 * Run full system reconciliation check OR get history
 * Query params:
 * - action=run (default) - Run new reconciliation
 * - action=history - Get reconciliation history
 * - limit=10 - Number of history records to return
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'run';

    // GET HISTORY
    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const search = searchParams.get('search') || '';
      const statusFilter = searchParams.get('status') || 'all';
      const severityFilter = searchParams.get('severity') || 'all';

      // Build query
      const query: any = {};
      
      if (statusFilter === 'healthy') {
        query.healthy = true;
      } else if (statusFilter === 'issues') {
        query.healthy = false;
      }

      let history = await ReconciliationLog.find(query)
        .sort({ runAt: -1 })
        .limit(limit)
        .lean();

      // Filter by search (user email in issues)
      if (search) {
        const searchLower = search.toLowerCase();
        history = history.filter(h => 
          h.runByEmail?.toLowerCase().includes(searchLower) ||
          h.issues?.some((i: any) => 
            i.userEmail?.toLowerCase().includes(searchLower) ||
            i.userId?.toLowerCase().includes(searchLower)
          )
        );
      }

      // Filter by severity (in issues)
      if (severityFilter !== 'all') {
        history = history.filter(h => 
          h.issues?.some((i: any) => i.severity === severityFilter)
        );
      }

      return NextResponse.json({
        success: true,
        history: history.map(h => ({
          _id: h._id,
          runAt: h.runAt,
          runBy: h.runBy,
          runByEmail: h.runByEmail,
          duration: h.duration,
          summary: h.summary,
          balanceCheck: h.balanceCheck,
          healthy: h.healthy,
          status: h.status,
          issues: h.issues || [], // Include full issues
          issueCount: h.issues?.length || 0,
        })),
      });
    }

    // RUN NEW RECONCILIATION
    const startTime = Date.now();
    const issues: ReconciliationIssue[] = [];
    const userDetails: UserReconciliationDetail[] = [];

    // Get actual users from the user collection (Better Auth users)
    const userCollection = mongoose.connection.collection('user');
    const allUsers = await userCollection.find({}).toArray();
    
    // Also get wallets to find orphans
    const wallets = await CreditWallet.find({}).lean();
    const walletUserIds = new Set(wallets.map(w => w.userId.toString()));
    const userIds = new Set(allUsers.map(u => u._id.toString()));

    let totalTransactions = 0;
    let totalWithdrawals = 0;
    let totalDiscrepancy = 0;
    let usersWithMismatch = 0;

    // Check each actual user
    for (const user of allUsers) {
      const userId = user._id.toString();
      const userEmail = user.email || 'Unknown Email';
      const userName = user.name || user.email?.split('@')[0] || 'Unknown Name';
      
      const userDetail = await getDetailedUserReconciliation(userId, userEmail, userName);
      
      userDetails.push(userDetail);
      issues.push(...userDetail.issues);
      totalTransactions += Object.values(userDetail.transactionBreakdown).reduce((a, b) => a + b, 0);

      if (!userDetail.healthy) {
        usersWithMismatch++;
        const diff = Math.abs(userDetail.wallet.creditBalance - userDetail.calculated.balanceFromTransactions);
        totalDiscrepancy += diff;
      }
    }

    // Check for orphan wallets (wallets without users)
    const orphanWallets = wallets.filter(w => !userIds.has(w.userId.toString()));
    if (orphanWallets.length > 0) {
      issues.push({
        type: 'orphan_wallet',
        severity: 'warning',
        details: {
          description: `Found ${orphanWallets.length} orphan wallets (wallets without existing users). These will be cleaned on next database reset.`,
        },
      });
    }

    // Check withdrawal requests consistency
    const withdrawalResult = await verifyWithdrawalRequests();
    issues.push(...withdrawalResult.issues);
    totalWithdrawals = withdrawalResult.withdrawalCount;

    // Check for duplicates
    const duplicateIssues = await checkDuplicateTransactions();
    issues.push(...duplicateIssues);

    const duration = Date.now() - startTime;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const warningIssues = issues.filter(i => i.severity === 'warning').length;
    const infoIssues = issues.filter(i => i.severity === 'info').length;

    const reconciliationResult = {
      runAt: new Date(),
      runBy: admin.adminId || 'unknown',
      runByEmail: admin.email || 'unknown',
      duration,
      summary: {
        totalUsersChecked: allUsers.length,
        totalTransactionsChecked: totalTransactions,
        totalWithdrawalsChecked: totalWithdrawals,
        issuesFound: issues.length,
        criticalIssues,
        warningIssues,
        infoIssues,
        orphanWallets: orphanWallets.length,
      },
      balanceCheck: {
        usersWithMismatch,
        totalDiscrepancy: Math.round(totalDiscrepancy * 100) / 100,
      },
      issues,
      userDetails, // Include detailed per-user breakdown
      healthy: criticalIssues === 0,
      status: 'completed' as const,
    };

    // Save to history (without userDetails to save space - they can be regenerated)
    const historyRecord = { ...reconciliationResult };
    delete (historyRecord as any).userDetails;
    await ReconciliationLog.create(historyRecord);

    // Log the reconciliation run
    await auditLogService.logSystemAction(
      { id: admin.adminId || 'unknown', email: admin.email || 'unknown' },
      'reconciliation_run',
      `Ran system reconciliation: ${allUsers.length} users, ${issues.length} issues found (${criticalIssues} critical)`,
      { issuesFound: issues.length, criticalIssues, warningIssues, infoIssues, usersChecked: allUsers.length, orphanWallets: orphanWallets.length }
    );

    return NextResponse.json({
      success: true,
      runAt: reconciliationResult.runAt.toISOString(),
      duration,
      summary: reconciliationResult.summary,
      balanceCheck: reconciliationResult.balanceCheck,
      issues,
      userDetails, // Return detailed breakdown
      healthy: criticalIssues === 0,
    });
  } catch (error) {
    console.error('Error running reconciliation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run reconciliation' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reconciliation
 * Fix a specific reconciliation issue
 */
export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueType, userId } = await request.json();

    if (!issueType || !userId) {
      await session.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Missing issueType or userId' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    let result: { success: boolean; message: string };

    switch (issueType) {
      case 'balance_mismatch': {
        const transactions = await WalletTransaction.find({
          userId,
          status: 'completed',
        }).session(session);

        const correctBalance = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const wallet = await CreditWallet.findOne({ userId }).session(session);
        const previousBalance = wallet?.creditBalance || 0;

        await CreditWallet.updateOne(
          { userId },
          { $set: { creditBalance: Math.round(correctBalance * 100) / 100 } },
          { session }
        );

        result = {
          success: true,
          message: `Balance corrected from ${previousBalance} to ${Math.round(correctBalance * 100) / 100} credits`,
        };
        break;
      }

      case 'deposit_total_mismatch': {
        const depositTx = await WalletTransaction.find({
          userId,
          transactionType: 'deposit',
          status: 'completed',
        }).session(session);

        const correctTotal = depositTx.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

        await CreditWallet.updateOne(
          { userId },
          { $set: { totalDeposited: Math.round(correctTotal * 100) / 100 } },
          { session }
        );

        result = {
          success: true,
          message: `Total deposited corrected to ${Math.round(correctTotal * 100) / 100} credits`,
        };
        break;
      }

      case 'withdrawal_total_mismatch': {
        const completedWithdrawals = await WithdrawalRequest.find({
          userId,
          status: 'completed',
        }).session(session);

        const correctTotal = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);

        await CreditWallet.updateOne(
          { userId },
          { $set: { totalWithdrawn: Math.round(correctTotal * 100) / 100 } },
          { session }
        );

        result = {
          success: true,
          message: `Total withdrawn corrected to ${Math.round(correctTotal * 100) / 100} credits`,
        };
        break;
      }

      case 'marketplace_spent_mismatch': {
        const marketplaceTx = await WalletTransaction.find({
          userId,
          transactionType: 'marketplace_purchase',
          status: 'completed',
        }).session(session);

        const correctTotal = marketplaceTx.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

        await CreditWallet.updateOne(
          { userId },
          { $set: { totalSpentOnMarketplace: Math.round(correctTotal * 100) / 100 } },
          { session }
        );

        result = {
          success: true,
          message: `Marketplace spent corrected to ${Math.round(correctTotal * 100) / 100} credits`,
        };
        break;
      }

      default:
        await session.abortTransaction();
        return NextResponse.json(
          { success: false, error: `Auto-fix not available for issue type: ${issueType}` },
          { status: 400 }
        );
    }

    await session.commitTransaction();

    // Log the fix
    await auditLogService.logSystemAction(
      { id: admin.adminId || 'unknown', email: admin.email || 'unknown' },
      'reconciliation_fix',
      `Fixed ${issueType} for user ${userId}: ${result.message}`,
      { issueType, userId }
    );

    return NextResponse.json(result);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error fixing reconciliation issue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fix reconciliation issue' },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}

// Helper functions

async function verifyUserWallet(userId: string, userEmail: string) {
  const issues: ReconciliationIssue[] = [];

  const wallet = await CreditWallet.findOne({ userId }).lean();
  if (!wallet) {
    return { issues: [], transactionCount: 0, balanceDifference: 0 };
  }

  const transactions = await WalletTransaction.find({
    userId,
    status: 'completed',
  }).lean();

  // Check balance
  const calculatedBalance = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const balanceDifference = Math.round((wallet.creditBalance - calculatedBalance) * 100) / 100;

  if (Math.abs(balanceDifference) > 0.01) {
    issues.push({
      type: 'balance_mismatch',
      severity: 'critical',
      userId,
      userEmail,
      details: {
        expected: Math.round(calculatedBalance * 100) / 100,
        actual: wallet.creditBalance,
        difference: balanceDifference,
        description: `Wallet balance (${wallet.creditBalance}) doesn't match transactions (${Math.round(calculatedBalance * 100) / 100})`,
      },
    });
  }

  // Check deposit total
  const depositTx = transactions.filter(tx => tx.transactionType === 'deposit');
  const calculatedDeposits = depositTx.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  if (Math.abs((wallet.totalDeposited || 0) - calculatedDeposits) > 0.01) {
    issues.push({
      type: 'deposit_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(calculatedDeposits * 100) / 100,
        actual: wallet.totalDeposited || 0,
        difference: Math.round(((wallet.totalDeposited || 0) - calculatedDeposits) * 100) / 100,
        description: `totalDeposited mismatch`,
      },
    });
  }

  // Check withdrawal total
  const completedWithdrawals = await WithdrawalRequest.find({
    userId,
    status: 'completed',
  }).lean();
  const calculatedWithdrawals = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);

  if (Math.abs((wallet.totalWithdrawn || 0) - calculatedWithdrawals) > 0.01) {
    issues.push({
      type: 'withdrawal_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(calculatedWithdrawals * 100) / 100,
        actual: wallet.totalWithdrawn || 0,
        difference: Math.round(((wallet.totalWithdrawn || 0) - calculatedWithdrawals) * 100) / 100,
        description: `totalWithdrawn mismatch`,
      },
    });
  }

  return {
    issues,
    transactionCount: transactions.length,
    balanceDifference,
  };
}

async function verifyWithdrawalRequests() {
  const issues: ReconciliationIssue[] = [];
  const withdrawals = await WithdrawalRequest.find({}).lean();

  for (const withdrawal of withdrawals) {
    // Check completed withdrawals have platform transaction
    if (withdrawal.status === 'completed' && (withdrawal.platformFee || 0) > 0) {
      const platformTx = await PlatformTransaction.findOne({
        transactionType: 'withdrawal_fee',
        sourceId: withdrawal._id.toString(),
      }).lean();

      if (!platformTx) {
        issues.push({
          type: 'missing_platform_transaction',
          severity: 'warning',
          userId: withdrawal.userId,
          userEmail: withdrawal.userEmail,
          details: {
            withdrawalId: withdrawal._id.toString(),
            description: `Completed withdrawal missing platform fee record (€${withdrawal.platformFee})`,
          },
        });
      }
    }
  }

  return { issues, withdrawalCount: withdrawals.length };
}

async function verifyPlatformTransactions() {
  const issues: ReconciliationIssue[] = [];

  const depositFees = await PlatformTransaction.find({
    transactionType: 'deposit_fee',
    sourceId: { $exists: true, $ne: null },
  }).lean();

  for (const fee of depositFees) {
    if (fee.sourceId) {
      const deposit = await WalletTransaction.findById(fee.sourceId).lean();
      if (!deposit) {
        issues.push({
          type: 'orphan_transaction',
          severity: 'info',
          details: {
            transactionId: fee._id.toString(),
            description: `Deposit fee references non-existent deposit ${fee.sourceId}`,
          },
        });
      }
    }
  }

  return issues;
}

async function checkDuplicateTransactions() {
  const issues: ReconciliationIssue[] = [];

  const duplicates = await WalletTransaction.aggregate([
    { $match: { paymentId: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$paymentId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const dup of duplicates) {
    issues.push({
      type: 'duplicate_transaction',
      severity: 'critical',
      details: {
        transactionId: dup.docs.map((d: mongoose.Types.ObjectId) => d.toString()).join(', '),
        description: `Duplicate paymentId: ${dup._id} (${dup.count} records)`,
      },
    });
  }

  return issues;
}

/**
 * Get detailed reconciliation for a single user
 * Returns actual values for comparison
 * 
 * CORRECT BALANCE FORMULA:
 * Balance = Deposits - Withdrawals + Competition Wins + Challenge Wins - Competition Joins - Challenge Joins
 */
async function getDetailedUserReconciliation(
  userId: string,
  userEmail: string,
  userName: string
): Promise<UserReconciliationDetail> {
  const issues: ReconciliationIssue[] = [];

  // Get wallet with correct field names
  const wallet = await CreditWallet.findOne({ userId }).lean();
  
  const walletData = {
    creditBalance: wallet?.creditBalance || 0,
    totalDeposited: wallet?.totalDeposited || 0,
    totalWithdrawn: wallet?.totalWithdrawn || 0,
    totalWonFromCompetitions: wallet?.totalWonFromCompetitions || 0,
    totalWonFromChallenges: wallet?.totalWonFromChallenges || 0,
    totalSpentOnCompetitions: wallet?.totalSpentOnCompetitions || 0,
    totalSpentOnChallenges: wallet?.totalSpentOnChallenges || 0,
    totalSpentOnMarketplace: (wallet as any)?.totalSpentOnMarketplace || 0,
  };

  // Get all completed transactions
  const transactions = await WalletTransaction.find({
    userId,
    status: 'completed',
  }).lean();

  // Calculate totals from transactions
  let depositTotal = 0;
  let withdrawalTxTotal = 0; // From wallet transactions
  let competitionWinTotal = 0;
  let challengeWinTotal = 0;
  let competitionSpentTotal = 0;
  let challengeSpentTotal = 0;
  let marketplaceSpentTotal = 0;

  // Transaction breakdown by type
  const breakdown = {
    deposits: 0,
    withdrawals: 0,
    competitionJoins: 0,
    competitionWins: 0,
    challengeJoins: 0,
    challengeWins: 0,
    marketplacePurchases: 0,
    adminAdjustments: 0,
    refunds: 0,
    other: 0,
  };

  for (const tx of transactions) {
    const amount = tx.amount || 0;
    const type = tx.transactionType;

    switch (type) {
      case 'deposit':
        depositTotal += Math.abs(amount);
        breakdown.deposits++;
        break;
      case 'withdrawal':
        withdrawalTxTotal += Math.abs(amount);
        breakdown.withdrawals++;
        break;
      case 'competition_join':
      case 'competition_entry':
        competitionSpentTotal += Math.abs(amount);
        breakdown.competitionJoins++;
        break;
      case 'competition_win':
      case 'competition_prize':
      case 'competition_refund':
        competitionWinTotal += Math.abs(amount);
        breakdown.competitionWins++;
        break;
      case 'challenge_join':
      case 'challenge_entry':
        challengeSpentTotal += Math.abs(amount);
        breakdown.challengeJoins++;
        break;
      case 'challenge_win':
      case 'challenge_prize':
        challengeWinTotal += Math.abs(amount);
        breakdown.challengeWins++;
        break;
      case 'marketplace_purchase':
        marketplaceSpentTotal += Math.abs(amount);
        breakdown.marketplacePurchases++;
        break;
      case 'refund':
      case 'challenge_refund':
        breakdown.refunds++;
        break;
      case 'admin_adjustment':
        breakdown.adminAdjustments++;
        break;
      default:
        breakdown.other++;
    }
  }

  // Calculate balance from transactions (this includes all credit changes)
  const balanceFromTransactions = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Get completed withdrawals from WithdrawalRequest (source of truth for withdrawals)
  const completedWithdrawals = await WithdrawalRequest.find({
    userId,
    status: 'completed',
  }).lean();
  const withdrawalFromRequests = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);

  // Calculate EXPECTED balance using the formula:
  // Balance = Deposits - Withdrawals + Wins - Spends - Marketplace
  const expectedBalance = 
    walletData.totalDeposited - 
    walletData.totalWithdrawn + 
    walletData.totalWonFromCompetitions + 
    walletData.totalWonFromChallenges - 
    walletData.totalSpentOnCompetitions - 
    walletData.totalSpentOnChallenges -
    walletData.totalSpentOnMarketplace;

  // Check for issues - compare stored balance with expected balance (not just transaction sum)
  // This is more accurate because it accounts for all the wallet fields
  const balanceDiff = Math.abs(walletData.creditBalance - expectedBalance);
  if (balanceDiff > 0.01) {
    // Only flag if both methods disagree
    const txBalanceDiff = Math.abs(walletData.creditBalance - balanceFromTransactions);
    if (txBalanceDiff > 0.01) {
      issues.push({
        type: 'balance_mismatch',
        severity: 'critical',
        userId,
        userEmail,
        details: {
          expected: Math.round(balanceFromTransactions * 100) / 100,
          actual: walletData.creditBalance,
          difference: Math.round((walletData.creditBalance - balanceFromTransactions) * 100) / 100,
          description: `Balance mismatch: stored ${walletData.creditBalance}, from transactions ${Math.round(balanceFromTransactions * 100) / 100}, expected ${Math.round(expectedBalance * 100) / 100}`,
        },
      });
    }
  }

  // Check deposit total
  const depositDiff = Math.abs(walletData.totalDeposited - depositTotal);
  if (depositDiff > 0.01) {
    issues.push({
      type: 'deposit_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(depositTotal * 100) / 100,
        actual: walletData.totalDeposited,
        difference: Math.round((walletData.totalDeposited - depositTotal) * 100) / 100,
        description: `Deposit total mismatch: stored ${walletData.totalDeposited}, calculated ${Math.round(depositTotal * 100) / 100}`,
      },
    });
  }

  // Check withdrawal total against WithdrawalRequest (more reliable)
  const withdrawalDiff = Math.abs(walletData.totalWithdrawn - withdrawalFromRequests);
  if (withdrawalDiff > 0.01) {
    issues.push({
      type: 'withdrawal_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(withdrawalFromRequests * 100) / 100,
        actual: walletData.totalWithdrawn,
        difference: Math.round((walletData.totalWithdrawn - withdrawalFromRequests) * 100) / 100,
        description: `Withdrawal total mismatch: stored ${walletData.totalWithdrawn}, from requests ${Math.round(withdrawalFromRequests * 100) / 100}`,
      },
    });
  }

  // Check competition wins
  const compWinDiff = Math.abs(walletData.totalWonFromCompetitions - competitionWinTotal);
  if (compWinDiff > 0.01) {
    issues.push({
      type: 'competition_win_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(competitionWinTotal * 100) / 100,
        actual: walletData.totalWonFromCompetitions,
        difference: Math.round((walletData.totalWonFromCompetitions - competitionWinTotal) * 100) / 100,
        description: `Competition wins mismatch: stored ${walletData.totalWonFromCompetitions}, calculated ${Math.round(competitionWinTotal * 100) / 100}`,
      },
    });
  }

  // Check challenge wins
  const chalWinDiff = Math.abs(walletData.totalWonFromChallenges - challengeWinTotal);
  if (chalWinDiff > 0.01) {
    issues.push({
      type: 'challenge_win_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(challengeWinTotal * 100) / 100,
        actual: walletData.totalWonFromChallenges,
        difference: Math.round((walletData.totalWonFromChallenges - challengeWinTotal) * 100) / 100,
        description: `Challenge wins mismatch: stored ${walletData.totalWonFromChallenges}, calculated ${Math.round(challengeWinTotal * 100) / 100}`,
      },
    });
  }

  // Check competition spent
  const compSpentDiff = Math.abs(walletData.totalSpentOnCompetitions - competitionSpentTotal);
  if (compSpentDiff > 0.01) {
    issues.push({
      type: 'competition_spent_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(competitionSpentTotal * 100) / 100,
        actual: walletData.totalSpentOnCompetitions,
        difference: Math.round((walletData.totalSpentOnCompetitions - competitionSpentTotal) * 100) / 100,
        description: `Competition spent mismatch: stored ${walletData.totalSpentOnCompetitions}, calculated ${Math.round(competitionSpentTotal * 100) / 100}`,
      },
    });
  }

  // Check challenge spent
  const chalSpentDiff = Math.abs(walletData.totalSpentOnChallenges - challengeSpentTotal);
  if (chalSpentDiff > 0.01) {
    issues.push({
      type: 'challenge_spent_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(challengeSpentTotal * 100) / 100,
        actual: walletData.totalSpentOnChallenges,
        difference: Math.round((walletData.totalSpentOnChallenges - challengeSpentTotal) * 100) / 100,
        description: `Challenge spent mismatch: stored ${walletData.totalSpentOnChallenges}, calculated ${Math.round(challengeSpentTotal * 100) / 100}`,
      },
    });
  }

  // Check marketplace spent
  const marketSpentDiff = Math.abs(walletData.totalSpentOnMarketplace - marketplaceSpentTotal);
  if (marketSpentDiff > 0.01) {
    issues.push({
      type: 'marketplace_spent_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: Math.round(marketplaceSpentTotal * 100) / 100,
        actual: walletData.totalSpentOnMarketplace,
        difference: Math.round((walletData.totalSpentOnMarketplace - marketplaceSpentTotal) * 100) / 100,
        description: `Marketplace spent mismatch: stored ${walletData.totalSpentOnMarketplace}, calculated ${Math.round(marketplaceSpentTotal * 100) / 100}`,
      },
    });
  }

  return {
    userId,
    userEmail,
    userName,
    wallet: walletData,
    calculated: {
      expectedBalance: Math.round(expectedBalance * 100) / 100,
      balanceFromTransactions: Math.round(balanceFromTransactions * 100) / 100,
      depositTotal: Math.round(depositTotal * 100) / 100,
      withdrawalTotal: Math.round(withdrawalFromRequests * 100) / 100,
      competitionWinTotal: Math.round(competitionWinTotal * 100) / 100,
      challengeWinTotal: Math.round(challengeWinTotal * 100) / 100,
      competitionSpentTotal: Math.round(competitionSpentTotal * 100) / 100,
      challengeSpentTotal: Math.round(challengeSpentTotal * 100) / 100,
      marketplaceSpentTotal: Math.round(marketplaceSpentTotal * 100) / 100,
    },
    transactionBreakdown: breakdown,
    issues,
    healthy: issues.filter(i => i.severity === 'critical').length === 0,
  };
}

