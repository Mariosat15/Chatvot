/**
 * Internal Reconciliation Service
 *
 * Verifies data integrity across the system:
 * - Wallet balances match transaction history
 * - Deposit/withdrawal totals are accurate
 * - Pending transactions have matching requests
 * - Platform fees are correctly recorded
 */

import mongoose from "mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import {
  computeExpectedBalanceFromRequests,
  isWithdrawalFlowTransaction,
  balanceDifference as calcBalanceDifference,
  isBalanceMismatch,
  classifyBalanceMismatchSeverity,
} from "@/lib/services/reconciliation-math";

export interface ReconciliationIssue {
  type:
    | "balance_mismatch"
    | "deposit_total_mismatch"
    | "withdrawal_total_mismatch"
    | "orphan_transaction"
    | "orphan_withdrawal"
    | "duplicate_transaction"
    | "fee_mismatch"
    | "status_inconsistency"
    | "missing_platform_transaction";
  severity: "critical" | "warning" | "info";
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
    totalAdminCredits: number;
    totalAdminDebits: number;
    totalIncidentCompensation: number;
    totalGmEarnings: number;
    totalRefunded: number;
  };
  calculated: {
    expectedBalance: number;
    balanceFromTransactions: number;
    depositTotal: number;
    withdrawalTotal: number;
    marketplaceSpentTotal: number;
    adminAdjustmentNet: number;
    incidentCompensationTotal: number;
    gmEarningsTotal: number;
    refundTotal: number;
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

  // Get wallets (capped to prevent OOM on very large user bases)
  const wallets = await CreditWallet.find({}).select("userId creditBalance").limit(5000).lean();
  let totalTransactions = 0;
  let totalWithdrawals = 0;
  let totalDiscrepancy = 0;
  let usersWithMismatch = 0;

  // Check each user's wallet
  for (const wallet of wallets) {
    const userIssues = await verifyUserWallet(
      wallet.userId,
      wallet.userEmail || "Unknown",
    );
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
  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const warningIssues = issues.filter((i) => i.severity === "warning").length;
  const infoIssues = issues.filter((i) => i.severity === "info").length;

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
  userEmail: string,
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
  const wallet = (await CreditWallet.findOne({ userId }).lean()) as {
    creditBalance: number;
    totalDeposited?: number;
    totalWithdrawn?: number;
    totalWonFromCompetitions?: number;
    totalWonFromChallenges?: number;
    totalSpentOnCompetitions?: number;
    totalSpentOnChallenges?: number;
    userEmail?: string;
  } | null;
  if (!wallet) {
    return { issues: [], transactionCount: 0, balanceDifference: 0 };
  }

  // Fetch all independent transaction queries in parallel
  const [completedTransactions, pendingWithdrawalTx, pendingDepositTx, pendingWithdrawalRequests, completedWithdrawals] = await Promise.all([
    // All completed transactions
    WalletTransaction.find({
      userId,
      status: "completed",
    }).lean(),
    // Pending withdrawals (already deducted credits)
    WalletTransaction.find({
      userId,
      transactionType: "withdrawal",
      status: { $in: ["pending", "processing"] },
    }).lean(),
    // Pending deposits (not yet credited)
    WalletTransaction.find({
      userId,
      transactionType: "deposit",
      status: "pending",
    }).lean(),
    // Pending withdrawal requests (credits already deducted from wallet)
    WithdrawalRequest.find({
      userId,
      status: { $in: ["pending", "approved", "processing"] },
    }).lean(),
    // Completed withdrawal requests (for withdrawal total check)
    WithdrawalRequest.find({
      userId,
      status: "completed",
    }).lean(),
  ]);

  // Calculate pending withdrawal amount (these credits are already deducted from wallet)
  // We need to account for this when checking balance
  const pendingWithdrawalCredits = pendingWithdrawalRequests.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  // Completed withdrawal credits (source of truth for finished withdrawals).
  const completedWithdrawalCredits = completedWithdrawals.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  // Pending deposits not yet credited (don't affect wallet balance yet)
  const pendingDepositCredits = pendingDepositTx.reduce(
    (sum, tx) => sum + Math.abs(tx.amount || 0),
    0,
  );

  // Reason: WithdrawalRequest is the single source of truth for withdrawals.
  // We sum the completed ledger EXCLUDING every withdrawal-flow tx (the debit
  // and any reversal refund), then subtract all non-refunded withdrawal request
  // credits (pending/approved/processing/completed). This makes the expected
  // balance correct for manual & automatic, bank & card withdrawals even when a
  // withdrawal's WalletTransaction was never flipped out of "pending" — which
  // previously produced phantom balance_mismatch criticals (masked as "info" by
  // any later pending withdrawal). See reconciliation-math.ts.
  const ledgerExcludingWithdrawalFlows = completedTransactions.reduce(
    (sum, tx) => (isWithdrawalFlowTransaction(tx) ? sum : sum + (tx.amount || 0)),
    0,
  );
  const expectedBalance = computeExpectedBalanceFromRequests(
    ledgerExcludingWithdrawalFlows,
    pendingWithdrawalCredits + completedWithdrawalCredits,
  );
  const balanceDifference = calcBalanceDifference(
    wallet.creditBalance,
    expectedBalance,
  );

  // All transactions for counting
  const transactions = [
    ...completedTransactions,
    ...pendingWithdrawalTx,
    ...pendingDepositTx,
  ];

  // Check 1: Balance matches expected (accounting for pending withdrawals)
  if (isBalanceMismatch(wallet.creditBalance, expectedBalance)) {
    issues.push({
      type: "balance_mismatch",
      // Downgrade severity if pending txns can explain the difference
      severity: classifyBalanceMismatchSeverity({
        pendingWithdrawalCredits,
        pendingDepositCredits,
      }),
      userId,
      userEmail,
      details: {
        expected: expectedBalance,
        actual: wallet.creditBalance,
        difference: balanceDifference,
        description:
          `Wallet balance (${wallet.creditBalance}) doesn't match expected (${expectedBalance})` +
          (pendingWithdrawalCredits > 0
            ? `. Note: ${pendingWithdrawalCredits} credits in pending withdrawals.`
            : "") +
          (pendingDepositCredits > 0
            ? `. Note: ${pendingDepositCredits} credits in pending deposits.`
            : ""),
      },
    });
  }

  // Calculate deposit total from COMPLETED transactions only
  // Reason: Include deposit + manual_deposit_credit types.
  // Legacy data may also include positive admin_adjustment amounts in totalDeposited,
  // so we account for those to avoid false-positive mismatches.
  const depositTransactions = completedTransactions.filter(
    (tx) => tx.transactionType === "deposit" || tx.transactionType === "manual_deposit_credit",
  );
  const calculatedDeposits = depositTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount || 0),
    0,
  );

  // Account for legacy admin adjustments that were stored in totalDeposited
  const legacyAdminCreditsInDeposits = completedTransactions
    .filter((tx) => tx.transactionType === "admin_adjustment" && (tx.amount || 0) > 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  // Subtract what's now tracked separately in totalAdminCredits
  const adminCreditsField = (wallet as { totalAdminCredits?: number }).totalAdminCredits || 0;
  const legacyAdminInDeposits = Math.max(0, legacyAdminCreditsInDeposits - adminCreditsField);
  const expectedDeposits = calculatedDeposits + legacyAdminInDeposits;

  // Check 2: Total deposited matches deposit transactions (+ legacy admin credits)
  if (Math.abs((wallet.totalDeposited || 0) - expectedDeposits) > 0.01) {
    issues.push({
      type: "deposit_total_mismatch",
      severity: "warning",
      userId,
      userEmail,
      details: {
        expected: expectedDeposits,
        actual: wallet.totalDeposited || 0,
        difference: (wallet.totalDeposited || 0) - expectedDeposits,
        description: `totalDeposited (${wallet.totalDeposited || 0}) doesn't match deposit transactions (${expectedDeposits})` +
          (legacyAdminInDeposits > 0 ? ` (includes ${legacyAdminInDeposits} legacy admin credits)` : ""),
      },
    });
  }

  // Calculate withdrawal total from completed withdrawal requests (fetched in parallel above)
  const calculatedWithdrawals = completedWithdrawals.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  // Account for legacy admin debits that were stored in totalWithdrawn
  const legacyAdminDebitsInWithdrawals = completedTransactions
    .filter((tx) => tx.transactionType === "admin_adjustment" && (tx.amount || 0) < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  const adminDebitsField = (wallet as { totalAdminDebits?: number }).totalAdminDebits || 0;
  const legacyAdminInWithdrawals = Math.max(0, legacyAdminDebitsInWithdrawals - adminDebitsField);
  const expectedWithdrawals = calculatedWithdrawals + legacyAdminInWithdrawals;

  // Check 3: Total withdrawn matches completed withdrawals (+ legacy admin debits)
  if (Math.abs((wallet.totalWithdrawn || 0) - expectedWithdrawals) > 0.01) {
    issues.push({
      type: "withdrawal_total_mismatch",
      severity: "warning",
      userId,
      userEmail,
      details: {
        expected: expectedWithdrawals,
        actual: wallet.totalWithdrawn || 0,
        difference: (wallet.totalWithdrawn || 0) - expectedWithdrawals,
        description: `totalWithdrawn (${wallet.totalWithdrawn || 0}) doesn't match completed withdrawals (${expectedWithdrawals})` +
          (legacyAdminInWithdrawals > 0 ? ` (includes ${legacyAdminInWithdrawals} legacy admin debits)` : ""),
      },
    });
  }

  // Check 4: Pending withdrawals have matching wallet transactions
  const pendingWithdrawals = await WithdrawalRequest.find({
    userId,
    status: { $in: ["pending", "approved", "processing"] },
  }).lean();

  for (const withdrawal of pendingWithdrawals) {
    const matchingTx = await WalletTransaction.findOne({
      userId,
      transactionType: "withdrawal",
      "metadata.withdrawalRequestId": withdrawal._id.toString(),
    }).lean();

    if (!matchingTx) {
      // Also check by amount and date range
      const txByAmount = await WalletTransaction.findOne({
        userId,
        transactionType: "withdrawal",
        amount: -withdrawal.amountCredits,
        createdAt: {
          $gte: new Date(withdrawal.requestedAt.getTime() - 60000), // Within 1 minute
          $lte: new Date(withdrawal.requestedAt.getTime() + 60000),
        },
      }).lean();

      if (!txByAmount) {
        issues.push({
          type: "orphan_withdrawal",
          severity: "warning",
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
    if (
      withdrawal.status === "completed" &&
      (withdrawal.platformFee || 0) > 0
    ) {
      const platformTx = await PlatformTransaction.findOne({
        transactionType: "withdrawal_fee",
        sourceId: withdrawal._id.toString(),
      }).lean();

      if (!platformTx) {
        issues.push({
          type: "missing_platform_transaction",
          severity: "warning",
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
    if (
      withdrawal.walletBalanceBefore !== undefined &&
      withdrawal.walletBalanceAfter !== undefined
    ) {
      const expectedAfter =
        withdrawal.walletBalanceBefore - withdrawal.amountCredits;
      if (Math.abs(expectedAfter - withdrawal.walletBalanceAfter) > 0.01) {
        issues.push({
          type: "balance_mismatch",
          severity: "info",
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
  const depositFees = (await PlatformTransaction.find({
    transactionType: "deposit_fee",
  }).limit(2000).lean()) as Array<{ _id: { toString(): string }; sourceId?: string }>;

  // PERF: Batch-fetch all referenced deposits instead of N+1 findById in loop
  const sourceIds = depositFees.map((f) => f.sourceId).filter(Boolean);
  const existingDeposits = sourceIds.length > 0
    ? await WalletTransaction.find({ _id: { $in: sourceIds } }).select("_id").lean()
    : [];
  const existingDepositIds = new Set(
    existingDeposits.map((d: { _id: { toString(): string } }) => d._id.toString()),
  );

  for (const fee of depositFees) {
    if (fee.sourceId && !existingDepositIds.has(fee.sourceId)) {
      issues.push({
        type: "orphan_transaction",
        severity: "info",
        details: {
          transactionId: fee._id.toString(),
          description: `Deposit fee ${fee._id} references non-existent deposit ${fee.sourceId}`,
        },
      });
    }
  }

  // Check for incident compensations - verify platform expense matches user credits
  const compensations = (await PlatformTransaction.find({
    transactionType: "incident_compensation",
  }).lean()) as Array<{
    _id: { toString(): string };
    sourceId?: string;
    compensationDetails?: { affectedUsersCount?: number };
  }>;

  for (const comp of compensations) {
    if (comp.sourceId && comp.compensationDetails?.affectedUsersCount) {
      // Verify there are matching wallet transactions for this incident
      const walletTxCount = await WalletTransaction.countDocuments({
        transactionType: "incident_compensation",
        "metadata.incidentId": comp.sourceId,
      });

      if (walletTxCount < comp.compensationDetails.affectedUsersCount) {
        issues.push({
          type: "fee_mismatch",
          severity: "warning",
          details: {
            transactionId: comp._id.toString(),
            expected: comp.compensationDetails.affectedUsersCount,
            actual: walletTxCount,
            description: `Incident compensation ${comp._id} (incident: ${comp.sourceId}) expected ${comp.compensationDetails.affectedUsersCount} wallet transactions but found ${walletTxCount}`,
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
    {
      $group: {
        _id: "$paymentId",
        count: { $sum: 1 },
        docs: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const dup of duplicates) {
    issues.push({
      type: "duplicate_transaction",
      severity: "critical",
      details: {
        transactionId: dup.docs
          .map((d: mongoose.Types.ObjectId) => d.toString())
          .join(", "),
        description: `Duplicate transactions found with paymentId: ${dup._id} (${dup.count} records)`,
      },
    });
  }

  return issues;
}

/**
 * Get detailed reconciliation for a single user
 */
export async function getUserReconciliation(
  userId: string,
): Promise<UserReconciliationResult | null> {
  const wallet = (await CreditWallet.findOne({ userId }).lean()) as {
    creditBalance: number;
    totalDeposited?: number;
    totalWithdrawn?: number;
    totalWonFromCompetitions?: number;
    totalWonFromChallenges?: number;
    totalSpentOnCompetitions?: number;
    totalSpentOnChallenges?: number;
    totalSpentOnMarketplace?: number;
    totalAdminCredits?: number;
    totalAdminDebits?: number;
    totalIncidentCompensation?: number;
    totalGmEarnings?: number;
    totalRefunded?: number;
    userEmail?: string;
  } | null;
  if (!wallet) return null;

  const completedTransactions = await WalletTransaction.find({
    userId,
    status: "completed",
  }).lean();

  // Get pending withdrawals (credits already deducted from wallet)
  const pendingWithdrawals = await WithdrawalRequest.find({
    userId,
    status: { $in: ["pending", "approved", "processing"] },
  }).lean();
  const pendingWithdrawalCredits = pendingWithdrawals.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  // Completed withdrawals are the source of truth for finished withdrawals.
  const completedWithdrawalsForBalance = await WithdrawalRequest.find({
    userId,
    status: "completed",
  }).lean();
  const completedWithdrawalCredits = completedWithdrawalsForBalance.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  // Reason: The TRUE expected balance is the SUM of all completed transaction amounts.
  // This is the source of truth — it accounts for deposits, withdrawals, wins, refunds,
  // admin adjustments, incident compensations, GM earnings, platform fees, and all other types.
  // Using wallet aggregate fields alone was incomplete and missed admin/incident/GM flows.
  const balanceFromCompletedTransactions = Math.round(
    completedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0) * 100,
  ) / 100;
  // Reason: WithdrawalRequest is the single source of truth for withdrawals, so
  // we exclude every withdrawal-flow tx from the ledger and subtract all
  // non-refunded withdrawal request credits instead. This stays correct even
  // when a withdrawal's WalletTransaction is left "pending" by a completion
  // path (manual/automatic, bank/card). Same rule as verifyUserWallet + admin route.
  const ledgerExcludingWithdrawalFlows = completedTransactions.reduce(
    (sum, tx) => (isWithdrawalFlowTransaction(tx) ? sum : sum + (tx.amount || 0)),
    0,
  );
  const expectedBalance = computeExpectedBalanceFromRequests(
    ledgerExcludingWithdrawalFlows,
    pendingWithdrawalCredits + completedWithdrawalCredits,
  );

  const depositTotal = completedTransactions
    .filter((tx) => tx.transactionType === "deposit" || tx.transactionType === "manual_deposit_credit")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const marketplaceSpentTotal = completedTransactions
    .filter((tx) => tx.transactionType === "marketplace_purchase")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  // Calculate admin adjustment net from transactions
  const adminAdjustmentNet = completedTransactions
    .filter((tx) => tx.transactionType === "admin_adjustment")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Calculate incident compensation total from transactions
  const incidentCompensationTotal = completedTransactions
    .filter((tx) => tx.transactionType === "incident_compensation")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  // Calculate GM earnings from transactions
  const gmEarningsTotal = completedTransactions
    .filter((tx) => tx.transactionType === "gamemaster_earning" || tx.transactionType === "gamemaster_challenge_referral")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  // Calculate total refunds from transactions
  const refundTotal = completedTransactions
    .filter((tx) =>
      tx.transactionType === "competition_refund" ||
      tx.transactionType === "challenge_refund" ||
      tx.transactionType === "withdrawal_refund" ||
      tx.transactionType === "gamemaster_subscription_refund"
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const completedWithdrawals = await WithdrawalRequest.find({
    userId,
    status: "completed",
  }).lean();
  const withdrawalTotal = completedWithdrawals.reduce(
    (sum, w) => sum + (w.amountCredits || 0),
    0,
  );

  const verifyResult = await verifyUserWallet(
    userId,
    wallet.userEmail || "Unknown",
  );

  return {
    userId,
    userEmail: wallet.userEmail || "Unknown",
    wallet: {
      creditBalance: wallet.creditBalance,
      totalDeposited: wallet.totalDeposited || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      totalWonFromCompetitions: wallet.totalWonFromCompetitions || 0,
      totalWonFromChallenges: wallet.totalWonFromChallenges || 0,
      totalSpentOnCompetitions: wallet.totalSpentOnCompetitions || 0,
      totalSpentOnChallenges: wallet.totalSpentOnChallenges || 0,
      totalSpentOnMarketplace: wallet.totalSpentOnMarketplace || 0,
      totalAdminCredits: wallet.totalAdminCredits || 0,
      totalAdminDebits: wallet.totalAdminDebits || 0,
      totalIncidentCompensation: wallet.totalIncidentCompensation || 0,
      totalGmEarnings: wallet.totalGmEarnings || 0,
      totalRefunded: wallet.totalRefunded || 0,
    },
    calculated: {
      expectedBalance,
      balanceFromTransactions: balanceFromCompletedTransactions,
      depositTotal,
      withdrawalTotal,
      marketplaceSpentTotal,
      adminAdjustmentNet: Math.round(adminAdjustmentNet * 100) / 100,
      incidentCompensationTotal: Math.round(incidentCompensationTotal * 100) / 100,
      gmEarningsTotal: Math.round(gmEarningsTotal * 100) / 100,
      refundTotal: Math.round(refundTotal * 100) / 100,
    },
    issues: verifyResult.issues,
    healthy:
      verifyResult.issues.filter((i) => i.severity === "critical").length === 0,
  };
}

/**
 * Fix common reconciliation issues
 */
export async function fixReconciliationIssue(
  issueType: ReconciliationIssue["type"],
  userId: string,
  adminId: string,
): Promise<{ success: boolean; message: string }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    switch (issueType) {
      case "balance_mismatch": {
        // Recalculate balance from completed transactions.
        // Reason: MUST mirror the request-based expected-balance check exactly,
        // otherwise "fixing" a phantom mismatch could overwrite a CORRECT wallet
        // balance with a wrong one. We exclude withdrawal-flow txs and rely on
        // WithdrawalRequest as the source of truth for withdrawals.
        const completedTx = await WalletTransaction.find({
          userId,
          status: { $in: ["completed", "disputed"] },
        }).session(session);

        const pendingWithdrawals = await WithdrawalRequest.find({
          userId,
          status: { $in: ["pending", "approved", "processing"] },
        }).session(session);
        const completedWithdrawals = await WithdrawalRequest.find({
          userId,
          status: "completed",
        }).session(session);

        const pendingWithdrawalCredits = pendingWithdrawals.reduce(
          (sum, w) => sum + (w.amountCredits || 0),
          0,
        );
        const completedWithdrawalCredits = completedWithdrawals.reduce(
          (sum, w) => sum + (w.amountCredits || 0),
          0,
        );

        const ledgerExcludingWithdrawalFlows = completedTx.reduce(
          (sum, tx) =>
            isWithdrawalFlowTransaction(tx) ? sum : sum + (tx.amount || 0),
          0,
        );
        const correctBalance = computeExpectedBalanceFromRequests(
          ledgerExcludingWithdrawalFlows,
          pendingWithdrawalCredits + completedWithdrawalCredits,
        );

        await CreditWallet.updateOne(
          { userId },
          {
            $set: { creditBalance: correctBalance },
            $push: {
              adjustmentHistory: {
                date: new Date(),
                reason: `Reconciliation fix - balance recalculated from ledger + withdrawal requests (${pendingWithdrawals.length} pending, ${completedWithdrawals.length} completed withdrawals accounted for)`,
                adjustedBy: adminId,
                previousBalance: undefined, // Will be set by pre-save
                newBalance: correctBalance,
              },
            },
          },
          { session },
        );

        await session.commitTransaction();
        return {
          success: true,
          message: `Balance corrected to ${correctBalance} credits (including ${pendingWithdrawalCredits} pending + ${completedWithdrawalCredits} completed withdrawal credits)`,
        };
      }

      case "deposit_total_mismatch": {
        const depositTx = await WalletTransaction.find({
          userId,
          transactionType: "deposit",
          status: "completed",
        }).session(session);

        const correctTotal = depositTx.reduce(
          (sum, tx) => sum + Math.abs(tx.amount || 0),
          0,
        );

        await CreditWallet.updateOne(
          { userId },
          { $set: { totalDeposited: correctTotal } },
          { session },
        );

        await session.commitTransaction();
        return {
          success: true,
          message: `Total deposited corrected to ${correctTotal} credits`,
        };
      }

      case "withdrawal_total_mismatch": {
        const completedWithdrawals = await WithdrawalRequest.find({
          userId,
          status: "completed",
        }).session(session);

        const correctTotal = completedWithdrawals.reduce(
          (sum, w) => sum + (w.amountCredits || 0),
          0,
        );

        await CreditWallet.updateOne(
          { userId },
          { $set: { totalWithdrawn: correctTotal } },
          { session },
        );

        await session.commitTransaction();
        return {
          success: true,
          message: `Total withdrawn corrected to ${correctTotal} credits`,
        };
      }

      default:
        await session.abortTransaction();
        return {
          success: false,
          message: `Auto-fix not available for issue type: ${issueType}`,
        };
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
