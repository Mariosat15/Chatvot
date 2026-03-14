/**
 * User Financial Summary Service — SINGLE SOURCE OF TRUTH
 *
 * Mirror of lib/services/user-financial-summary.service.ts in the main app.
 * KEEP BOTH IN SYNC — any formula change here must be reflected there too.
 *
 * All financial stats (wins, spending, GM earnings, marketplace, ROI)
 * are computed ON DEMAND by aggregating WalletTransaction records.
 */

import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

// ── Interface ──────────────────────────────────────────────────────────────

export interface UserFinancialSummary {
  // Wins
  competitionWins: number;
  challengeWins: number;
  totalPrizesWon: number;

  // Gross spending (before refunds)
  grossCompetitionSpent: number;
  grossChallengeSpent: number;

  // Refunds
  competitionRefunds: number;
  challengeRefunds: number;

  // Net spending (after refunds)
  netCompetitionSpent: number;
  netChallengeSpent: number;
  marketplaceSpent: number;
  totalSpent: number; // netComp + netChal + marketplace

  // Derived
  netProfit: number; // totalPrizesWon − (netComp + netChal)
  roi: number; // (netProfit / entrySpending) * 100

  // GM Earnings (from gamemaster_earning + gamemaster_challenge_referral)
  gmEarnings: number;
}

// ── Transaction types we aggregate ─────────────────────────────────────────

const ALL_FINANCIAL_TX_TYPES = [
  "competition_win",
  "challenge_win",
  "competition_entry",
  "challenge_entry",
  "competition_refund",
  "challenge_refund",
  "marketplace_purchase",
  "gamemaster_earning",
  "gamemaster_challenge_referral",
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSummaryFromMap(txMap: Map<string, number>): UserFinancialSummary {
  const competitionWins = Math.abs(txMap.get("competition_win") || 0);
  const challengeWins = Math.abs(txMap.get("challenge_win") || 0);
  const totalPrizesWon = competitionWins + challengeWins;

  const grossCompetitionSpent = Math.abs(txMap.get("competition_entry") || 0);
  const grossChallengeSpent = Math.abs(txMap.get("challenge_entry") || 0);

  const competitionRefunds = Math.abs(txMap.get("competition_refund") || 0);
  const challengeRefunds = Math.abs(txMap.get("challenge_refund") || 0);

  const netCompetitionSpent = grossCompetitionSpent - competitionRefunds;
  const netChallengeSpent = grossChallengeSpent - challengeRefunds;
  const marketplaceSpent = Math.abs(txMap.get("marketplace_purchase") || 0);

  const totalSpent = netCompetitionSpent + netChallengeSpent + marketplaceSpent;

  // Reason: ROI is based on entry spending only (comp + chal), not marketplace,
  // because marketplace purchases are not investments with a return.
  const entrySpending = netCompetitionSpent + netChallengeSpent;
  const netProfit = totalPrizesWon - entrySpending;
  const roi = entrySpending > 0 ? (netProfit / entrySpending) * 100 : 0;

  const gmEarnings =
    Math.abs(txMap.get("gamemaster_earning") || 0) +
    Math.abs(txMap.get("gamemaster_challenge_referral") || 0);

  return {
    competitionWins,
    challengeWins,
    totalPrizesWon,
    grossCompetitionSpent,
    grossChallengeSpent,
    competitionRefunds,
    challengeRefunds,
    netCompetitionSpent,
    netChallengeSpent,
    marketplaceSpent,
    totalSpent,
    netProfit,
    roi,
    gmEarnings,
  };
}

// ── Single-user summary ────────────────────────────────────────────────────

/**
 * Get financial summary for a single user.
 * Aggregates all relevant WalletTransaction records in one DB call.
 */
export async function getUserFinancialSummary(
  userId: string,
): Promise<UserFinancialSummary> {
  await connectToDatabase();

  const txTotals = await WalletTransaction.aggregate([
    {
      $match: {
        userId,
        status: "completed",
        transactionType: { $in: ALL_FINANCIAL_TX_TYPES as unknown as string[] },
      },
    },
    { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
  ]);

  const txMap = new Map<string, number>();
  for (const t of txTotals) {
    txMap.set(t._id, t.total);
  }

  return buildSummaryFromMap(txMap);
}

// ── Bulk-user summaries (for admin tables) ─────────────────────────────────

/**
 * Get financial summaries for multiple users in a single aggregation.
 * Returns a Map keyed by userId.
 *
 * If userIds is omitted, aggregates ALL users (use with care).
 */
export async function getBulkUserFinancialSummaries(
  userIds?: string[],
): Promise<Map<string, UserFinancialSummary>> {
  await connectToDatabase();

  const matchStage: Record<string, unknown> = {
    status: "completed",
    transactionType: { $in: ALL_FINANCIAL_TX_TYPES as unknown as string[] },
  };
  if (userIds) {
    matchStage.userId = { $in: userIds };
  }

  const rows = await WalletTransaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { userId: "$userId", type: "$transactionType" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  // Build per-user txMaps
  const userMaps = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const uid: string = row._id.userId;
    if (!userMaps.has(uid)) userMaps.set(uid, new Map());
    userMaps.get(uid)!.set(row._id.type, row.total);
  }

  // Convert each user's txMap to a summary
  const result = new Map<string, UserFinancialSummary>();
  for (const [uid, txMap] of userMaps) {
    result.set(uid, buildSummaryFromMap(txMap));
  }

  return result;
}

// ── Platform-wide totals ───────────────────────────────────────────────────

/**
 * Get platform-wide financial totals (sum of all users).
 * Useful for admin overview / financial dashboard.
 */
export async function getPlatformFinancialTotals(): Promise<UserFinancialSummary> {
  await connectToDatabase();

  const txTotals = await WalletTransaction.aggregate([
    {
      $match: {
        status: "completed",
        transactionType: { $in: ALL_FINANCIAL_TX_TYPES as unknown as string[] },
      },
    },
    { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
  ]);

  const txMap = new Map<string, number>();
  for (const t of txTotals) {
    txMap.set(t._id, t.total);
  }

  return buildSummaryFromMap(txMap);
}

// ── Empty summary (for users with no wallet) ──────────────────────────────

export function emptyFinancialSummary(): UserFinancialSummary {
  return {
    competitionWins: 0,
    challengeWins: 0,
    totalPrizesWon: 0,
    grossCompetitionSpent: 0,
    grossChallengeSpent: 0,
    competitionRefunds: 0,
    challengeRefunds: 0,
    netCompetitionSpent: 0,
    netChallengeSpent: 0,
    marketplaceSpent: 0,
    totalSpent: 0,
    netProfit: 0,
    roi: 0,
    gmEarnings: 0,
  };
}
