/**
 * Internal Reconciliation Service
 * 
 * Verifies data integrity across the system:
 * - Wallet balances match transaction history
 * - Deposit/withdrawal totals are accurate
 * - Pending transactions have matching requests
 * - Platform fees are correctly recorded
 */

import mongoose from 'mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';

export interface ReconciliationIssue {
  type: 'balance_mismatch' | 'deposit_total_mismatch' | 'withdrawal_total_mismatch' | 
        'orphan_transaction' | 'orphan_withdrawal' | 'duplicate_transaction' |
        'fee_mismatch' | 'status_inconsistency' | 'missing_platform_transaction';
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

export interface ReconciliationResult {
  runAt: Date;
  duration: number;
  summary: {
    totalUsersChecked: number;
    totalTransactionsChecked: number;
    totalWithdrawalsChecked: number;
    issuesFound: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  balanceCheck: {
    usersWithMismatch: number;
    totalDiscrepancy: number;
  };
  issues: ReconciliationIssue[];
  healthy: boolean;
}

export interface UserReconciliationResult {
  userId: string;
  userEmail: string;
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
    marketplaceSpentTotal: number;
  };
  issues: ReconciliationIssue[];
  healthy: boolean;
}

/**
 * Run full system reconciliation
 */
export async function runFullReconciliation(): Promise<ReconciliationResult> {
  const startTime = Date.now();
  const issues: ReconciliationIssue[] = [];

  // Get all wallets
  const wallets = await CreditWallet.find({}).lean();
  let totalTransactions = 0;
  let totalWithdrawals = 0;
  let totalDiscrepancy = 0;
  let usersWithMismatch = 0;

  // Check each user's wallet
  for (const wallet of wallets) {
    const userIssues = await verifyUserWallet(wallet.userId, wallet.userEmail || 'Unknown');
    issues.push(...userIssues.issues);
    totalTransactions += userIssues.transactionCount;
    
    if (userIssues.balanceDifference !== 0) {
      usersWithMismatch++;
      totalDiscrepancy += Math.abs(userIssues.balanceDifference);
    }
  }

  // Check withdrawal requests consistency
  const withdrawalIssues = await verifyWithdrawalRequests();
  issues.push(...withdrawalIssues.issues);
  totalWithdrawals = withdrawalIssues.withdrawalCount;

  // Check platform transactions consistency
  const platformIssues = await verifyPlatformTransactions();
  issues.push(...platformIssues);

  // Check for duplicate transactions
  const duplicateIssues = await checkDuplicateTransactions();
  issues.push(...duplicateIssues);

  const duration = Date.now() - startTime;
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const warningIssues = issues.filter(i => i.severity === 'warning').length;
  const infoIssues = issues.filter(i => i.severity === 'info').length;

  return {
    runAt: new Date(),
    duration,
    summary: {
      totalUsersChecked: wallets.length,
      totalTransactionsChecked: totalTransactions,
      totalWithdrawalsChecked: totalWithdrawals,
      issuesFound: issues.length,
      criticalIssues,
      warningIssues,
      infoIssues,
    },
    balanceCheck: {
      usersWithMismatch,
      totalDiscrepancy,
    },
    issues,
    healthy: criticalIssues === 0,
  };
}

/**
 * Verify a single user's wallet integrity
 */
export async function verifyUserWallet(
  userId: string,
  userEmail: string
): Promise<{
  issues: ReconciliationIssue[];
  transactionCount: number;
  balanceDifference: number;
  pendingInfo?: {
    pendingDeposits: number;
    pendingDepositCredits: number;
    pendingWithdrawals: number;
    pendingWithdrawalCredits: number;
  };
}> {
  const issues: ReconciliationIssue[] = [];

  // Get wallet
  const wallet = await CreditWallet.findOne({ userId }).lean();
  if (!wallet) {
    return { issues: [], transactionCount: 0, balanceDifference: 0 };
  }

  // Get all completed transactions
  const completedTransactions = await WalletTransaction.find({
    userId,
    status: 'completed',
  }).lean();

  // Get pending transactions (withdrawals that have already deducted credits)
  const pendingWithdrawalTx = await WalletTransaction.find({
    userId,
    transactionType: 'withdrawal',
    status: { $in: ['pending', 'processing'] },
  }).lean();

  // Get pending deposits (not yet credited)
  const pendingDepositTx = await WalletTransaction.find({
    userId,
    transactionType: 'deposit',
    status: 'pending',
  }).lean();

  // Get pending withdrawal requests (credits already deducted from wallet)
  const pendingWithdrawalRequests = await WithdrawalRequest.find({
    userId,
    status: { $in: ['pending', 'approved', 'processing'] },
  }).lean();

  // Calculate balance from completed transactions
  const completedBalance = completedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  
  // Calculate pending withdrawal amount (these credits are already deducted from wallet)
  // We need to account for this when checking balance
  const pendingWithdrawalCredits = pendingWithdrawalRequests.reduce(
    (sum, w) => sum + (w.amountCredits || 0), 0
  );
  
  // Pending deposits not yet credited (don't affect wallet balance yet)
  const pendingDepositCredits = pendingDepositTx.reduce(
    (sum, tx) => sum + Math.abs(tx.amount || 0), 0
  );

  // The wallet balance should equal:
  // completed transactions sum MINUS pending withdrawals (already deducted)
  // Note: pending deposits don't affect balance until completed
  const expectedBalance = completedBalance - pendingWithdrawalCredits;
  const balanceDifference = Math.round((wallet.creditBalance - expectedBalance) * 100) / 100;
  
  // All transactions for counting
  const transactions = [...completedTransactions, ...pendingWithdrawalTx, ...pendingDepositTx];

  // Check 1: Balance matches expected (accounting for pending withdrawals)
  if (Math.abs(balanceDifference) > 0.01) {
    // Only flag as critical if there are NO pending transactions that could explain the difference
    const isPendingRelated = pendingWithdrawalCredits > 0 || pendingDepositCredits > 0;
    
    issues.push({
      type: 'balance_mismatch',
      severity: isPendingRelated ? 'info' : 'critical', // Downgrade severity if pending txns exist
      userId,
      userEmail,
      details: {
        expected: expectedBalance,
        actual: wallet.creditBalance,
        difference: balanceDifference,
        description: `Wallet balance (${wallet.creditBalance}) doesn't match expected (${expectedBalance})` +
          (pendingWithdrawalCredits > 0 ? `. Note: ${pendingWithdrawalCredits} credits in pending withdrawals.` : '') +
          (pendingDepositCredits > 0 ? `. Note: ${pendingDepositCredits} credits in pending deposits.` : ''),
      },
    });
  }

  // Calculate deposit total from COMPLETED transactions only
  const depositTransactions = completedTransactions.filter(tx => tx.transactionType === 'deposit');
  const calculatedDeposits = depositTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  // Check 2: Total deposited matches deposit transactions
  if (Math.abs((wallet.totalDeposited || 0) - calculatedDeposits) > 0.01) {
    issues.push({
      type: 'deposit_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: calculatedDeposits,
        actual: wallet.totalDeposited || 0,
        difference: (wallet.totalDeposited || 0) - calculatedDeposits,
        description: `totalDeposited (${wallet.totalDeposited || 0}) doesn't match deposit transactions (${calculatedDeposits})`,
      },
    });
  }

  // Calculate withdrawal total from completed withdrawal requests
  const completedWithdrawals = await WithdrawalRequest.find({
    userId,
    status: 'completed',
  }).lean();
  const calculatedWithdrawals = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);

  // Check 3: Total withdrawn matches completed withdrawals
  if (Math.abs((wallet.totalWithdrawn || 0) - calculatedWithdrawals) > 0.01) {
    issues.push({
      type: 'withdrawal_total_mismatch',
      severity: 'warning',
      userId,
      userEmail,
      details: {
        expected: calculatedWithdrawals,
        actual: wallet.totalWithdrawn || 0,
        difference: (wallet.totalWithdrawn || 0) - calculatedWithdrawals,
        description: `totalWithdrawn (${wallet.totalWithdrawn || 0}) doesn't match completed withdrawals (${calculatedWithdrawals})`,
      },
    });
  }

  // Check 4: Pending withdrawals have matching wallet transactions
  const pendingWithdrawals = await WithdrawalRequest.find({
    userId,
    status: { $in: ['pending', 'approved', 'processing'] },
  }).lean();

  for (const withdrawal of pendingWithdrawals) {
    const matchingTx = await WalletTransaction.findOne({
      userId,
      transactionType: 'withdrawal',
      'metadata.withdrawalRequestId': withdrawal._id.toString(),
    }).lean();

    if (!matchingTx) {
      // Also check by amount and date range
      const txByAmount = await WalletTransaction.findOne({
        userId,
        transactionType: 'withdrawal',
        amount: -withdrawal.amountCredits,
        createdAt: {
          $gte: new Date(withdrawal.requestedAt.getTime() - 60000), // Within 1 minute
          $lte: new Date(withdrawal.requestedAt.getTime() + 60000),
        },
      }).lean();

      if (!txByAmount) {
        issues.push({
          type: 'orphan_withdrawal',
          severity: 'warning',
          userId,
          userEmail,
          details: {
            withdrawalId: withdrawal._id.toString(),
            description: `Withdrawal request ${withdrawal._id} has no matching wallet transaction`,
          },
        });
      }
    }
  }

  return {
    issues,
    transactionCount: transactions.length,
    balanceDifference,
    pendingInfo: {
      pendingDeposits: pendingDepositTx.length,
      pendingDepositCredits,
      pendingWithdrawals: pendingWithdrawalRequests.length,
      pendingWithdrawalCredits,
    },
  };
}

/**
 * Verify withdrawal requests consistency
 */
async function verifyWithdrawalRequests(): Promise<{
  issues: ReconciliationIssue[];
  withdrawalCount: number;
}> {
  const issues: ReconciliationIssue[] = [];
  const withdrawals = await WithdrawalRequest.find({}).lean();

  for (const withdrawal of withdrawals) {
    // Check: Completed withdrawals should have platform transaction for fee
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
            description: `Completed withdrawal ${withdrawal._id} (fee: €${withdrawal.platformFee}) has no platform transaction record`,
          },
        });
      }
    }

    // Check: Wallet balance after should make sense
    if (withdrawal.walletBalanceBefore !== undefined && withdrawal.walletBalanceAfter !== undefined) {
      const expectedAfter = withdrawal.walletBalanceBefore - withdrawal.amountCredits;
      if (Math.abs(expectedAfter - withdrawal.walletBalanceAfter) > 0.01) {
        issues.push({
          type: 'balance_mismatch',
          severity: 'info',
          userId: withdrawal.userId,
          userEmail: withdrawal.userEmail,
          details: {
            expected: expectedAfter,
            actual: withdrawal.walletBalanceAfter,
            withdrawalId: withdrawal._id.toString(),
            description: `Withdrawal ${withdrawal._id} balance after (${withdrawal.walletBalanceAfter}) doesn't match expected (${expectedAfter})`,
          },
        });
      }
    }
  }

  return { issues, withdrawalCount: withdrawals.length };
}

/**
 * Verify platform transactions consistency
 */
async function verifyPlatformTransactions(): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  // Check for deposit fees without matching deposits
  const depositFees = await PlatformTransaction.find({
    transactionType: 'deposit_fee',
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
            description: `Deposit fee ${fee._id} references non-existent deposit ${fee.sourceId}`,
          },
        });
      }
    }
  }

  return issues;
}

/**
 * Check for duplicate transactions (same paymentId)
 */
async function checkDuplicateTransactions(): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  // Find duplicate payment IDs
  const duplicates = await WalletTransaction.aggregate([
    { $match: { paymentId: { $exists: true, $ne: null } } },
    { $group: { _id: '$paymentId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const dup of duplicates) {
    issues.push({
      type: 'duplicate_transaction',
      severity: 'critical',
      details: {
        transactionId: dup.docs.map((d: mongoose.Types.ObjectId) => d.toString()).join(', '),
        description: `Duplicate transactions found with paymentId: ${dup._id} (${dup.count} records)`,
      },
    });
  }

  return issues;
}

/**
 * Get detailed reconciliation for a single user
 */
export async function getUserReconciliation(userId: string): Promise<UserReconciliationResult | null> {
  const wallet = await CreditWallet.findOne({ userId }).lean();
  if (!wallet) return null;

  const completedTransactions = await WalletTransaction.find({ userId, status: 'completed' }).lean();
  
  // Get pending withdrawals (credits already deducted from wallet)
  const pendingWithdrawals = await WithdrawalRequest.find({
    userId,
    status: { $in: ['pending', 'approved', 'processing'] },
  }).lean();
  const pendingWithdrawalCredits = pendingWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);
  
  // Get pending deposits
  const pendingDeposits = await WalletTransaction.find({
    userId,
    transactionType: 'deposit',
    status: 'pending',
  }).lean();
  const pendingDepositCredits = pendingDeposits.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  
  const balanceFromCompletedTransactions = completedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  
  // Actual expected balance = completed transactions - pending withdrawals (already deducted)
  const balanceFromTransactions = balanceFromCompletedTransactions - pendingWithdrawalCredits;
  
  const depositTotal = completedTransactions
    .filter(tx => tx.transactionType === 'deposit')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  
  // Calculate marketplace purchases from transactions
  const marketplaceSpentTotal = completedTransactions
    .filter(tx => tx.transactionType === 'marketplace_purchase')
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  
  const completedWithdrawals = await WithdrawalRequest.find({
    userId,
    status: 'completed',
  }).lean();
  const withdrawalTotal = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);

  const verifyResult = await verifyUserWallet(userId, wallet.userEmail || 'Unknown');

  // Calculate expected balance (including marketplace purchases and pending)
  const expectedBalance = 
    (wallet.totalDeposited || 0) - 
    (wallet.totalWithdrawn || 0) + 
    (wallet.totalWonFromCompetitions || 0) + 
    (wallet.totalWonFromChallenges || 0) - 
    (wallet.totalSpentOnCompetitions || 0) - 
    (wallet.totalSpentOnChallenges || 0) -
    ((wallet as any).totalSpentOnMarketplace || 0) -
    pendingWithdrawalCredits; // Account for pending withdrawals

  return {
    userId,
    userEmail: wallet.userEmail || 'Unknown',
    wallet: {
      creditBalance: wallet.creditBalance,
      totalDeposited: wallet.totalDeposited || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      totalWonFromCompetitions: wallet.totalWonFromCompetitions || 0,
      totalWonFromChallenges: wallet.totalWonFromChallenges || 0,
      totalSpentOnCompetitions: wallet.totalSpentOnCompetitions || 0,
      totalSpentOnChallenges: wallet.totalSpentOnChallenges || 0,
      totalSpentOnMarketplace: (wallet as any).totalSpentOnMarketplace || 0,
    },
    calculated: {
      expectedBalance,
      balanceFromTransactions,
      depositTotal,
      withdrawalTotal,
      marketplaceSpentTotal,
      // Add pending info for visibility
      pendingWithdrawalCredits,
      pendingDepositCredits,
    } as any,
    issues: verifyResult.issues,
    healthy: verifyResult.issues.filter(i => i.severity === 'critical').length === 0,
  };
}

/**
 * Fix common reconciliation issues
 */
export async function fixReconciliationIssue(
  issueType: ReconciliationIssue['type'],
  userId: string,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    switch (issueType) {
      case 'balance_mismatch': {
        // Recalculate balance from completed transactions
        const completedTx = await WalletTransaction.find({
          userId,
          status: 'completed',
        }).session(session);
        
        // Also account for pending withdrawals (credits already deducted)
        const pendingWithdrawals = await WithdrawalRequest.find({
          userId,
          status: { $in: ['pending', 'approved', 'processing'] },
        }).session(session);
        
        const pendingWithdrawalCredits = pendingWithdrawals.reduce(
          (sum, w) => sum + (w.amountCredits || 0), 0
        );
        
        const completedBalance = completedTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const correctBalance = completedBalance - pendingWithdrawalCredits;
        
        await CreditWallet.updateOne(
          { userId },
          { 
            $set: { creditBalance: correctBalance },
            $push: {
              adjustmentHistory: {
                date: new Date(),
                reason: `Reconciliation fix - balance recalculated from transactions (${pendingWithdrawals.length} pending withdrawals accounted for)`,
                adjustedBy: adminId,
                previousBalance: undefined, // Will be set by pre-save
                newBalance: correctBalance,
              }
            }
          },
          { session }
        );
        
        await session.commitTransaction();
        return { success: true, message: `Balance corrected to ${correctBalance} credits (including ${pendingWithdrawalCredits} in pending withdrawals)` };
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
          { $set: { totalDeposited: correctTotal } },
          { session }
        );
        
        await session.commitTransaction();
        return { success: true, message: `Total deposited corrected to ${correctTotal} credits` };
      }

      case 'withdrawal_total_mismatch': {
        const completedWithdrawals = await WithdrawalRequest.find({
          userId,
          status: 'completed',
        }).session(session);
        
        const correctTotal = completedWithdrawals.reduce((sum, w) => sum + (w.amountCredits || 0), 0);
        
        await CreditWallet.updateOne(
          { userId },
          { $set: { totalWithdrawn: correctTotal } },
          { session }
        );
        
        await session.commitTransaction();
        return { success: true, message: `Total withdrawn corrected to ${correctTotal} credits` };
      }

      default:
        await session.abortTransaction();
        return { success: false, message: `Auto-fix not available for issue type: ${issueType}` };
    }
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export default {
  runFullReconciliation,
  verifyUserWallet,
  getUserReconciliation,
  fixReconciliationIssue,
};

