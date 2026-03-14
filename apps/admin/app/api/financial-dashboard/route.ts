 
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import { PlatformFinancialsService } from "@/lib/services/platform-financials.service";
import {
  PlatformTransaction,
} from "@/database/models/platform-financials.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import mongoose from "mongoose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "admin-secret-key-change-in-production",
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get all user wallets
    const wallets = await CreditWallet.find()
      .sort({ creditBalance: -1 })
      .limit(100)
      .lean();

    // Get user info for wallets
    const userIds = wallets.map((w) => w.userId);
    const usersMap = await getUsersByIds(userIds);

    // Get pending withdrawals from WithdrawalRequest (source of truth)
    const pendingWithdrawalRequests = await WithdrawalRequest.find({
      status: { $in: ["pending", "approved", "processing"] },
    })
      .sort({ requestedAt: -1 })
      .lean();

    // Get conversion settings
    const conversionSettings = await CreditConversionSettings.getSingleton();

    // Get comprehensive platform financial stats
    const platformFinancialStats =
      await PlatformFinancialsService.getFinancialStats();
    const unclaimedPoolsSummary =
      await PlatformFinancialsService.getUnclaimedPoolsSummary();

    // Get total platform fees earned (from wallet transactions)
    const platformFees = await WalletTransaction.aggregate([
      {
        $match: { transactionType: "platform_fee" },
      },
      {
        $group: {
          _id: null,
          totalFees: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get total game master fees paid (from wallet transactions - include both types for backwards compat)
    const gameMasterFees = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: {
            $in: ["gamemaster_earning", "gamemaster_challenge_referral"],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalFees: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get breakdown of GM fees by type
    const gameMasterFeesByType = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: {
            $in: ["gamemaster_earning", "gamemaster_challenge_referral"],
          },
        },
      },
      {
        $group: {
          _id: "$transactionType",
          totalFees: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const gmCompetitionFees = gameMasterFeesByType.find(
      (g) => g._id === "gamemaster_earning",
    );
    const gmChallengeFees = gameMasterFeesByType.find(
      (g) => g._id === "gamemaster_challenge_referral",
    );

    // Get list of GMs who received fees (for detailed view)
    const gmFeesDetail = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: {
            $in: ["gamemaster_earning", "gamemaster_challenge_referral"],
          },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalEarned: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
          fromCompetitions: {
            $sum: {
              $cond: [
                { $eq: ["$transactionType", "gamemaster_earning"] },
                "$amount",
                0,
              ],
            },
          },
          fromChallenges: {
            $sum: {
              $cond: [
                { $eq: ["$transactionType", "gamemaster_challenge_referral"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalEarned: -1 } },
      { $limit: 10 },
    ]);

    // Reason: One-time backfill — set isGmCreated on existing competition platform fees
    // that were recorded before the flag was introduced. After first run, the $match
    // returns 0 docs so the cost is a single index scan.
    try {
      const db = mongoose.connection.db;
      if (db) {
        const untagged = await PlatformTransaction.find({
          transactionType: "platform_fee",
          sourceType: "competition",
          isGmCreated: { $exists: false },
          sourceId: { $exists: true, $ne: null },
        }).lean();

        if (untagged.length > 0) {
          const compIds = untagged
            .map((t) => {
              try { return new mongoose.Types.ObjectId(t.sourceId as string); }
              catch { return null; }
            })
            .filter((id): id is mongoose.Types.ObjectId => id !== null);

          const comps = await db.collection("competitions")
            .find({ _id: { $in: compIds } }, { projection: { _id: 1, gameMasterId: 1 } })
            .toArray();

          const gmCompIdSet = new Set(
            comps.filter((c) => c.gameMasterId).map((c) => c._id.toString()),
          );

          const bulkOps = untagged.map((t) => ({
            updateOne: {
              filter: { _id: t._id },
              update: { $set: { isGmCreated: gmCompIdSet.has(t.sourceId as string) } },
            },
          }));

          if (bulkOps.length > 0) {
            await PlatformTransaction.bulkWrite(bulkOps);
            console.log(`✅ [BACKFILL] Tagged ${bulkOps.length} competition platform fees with isGmCreated`);
          }
        }
      }
    } catch (backfillErr) {
      console.error("⚠️ [BACKFILL] Error backfilling isGmCreated:", backfillErr);
    }

    // Reason: Break down competition platform fees by admin-created vs GM-created.
    // Uses the `isGmCreated` flag stored directly on PlatformTransaction at recording time,
    // avoiding expensive $lookup joins to the competitions collection.
    // Reason: Use $amountEUR for consistent EUR reporting (amount field is in credits).
    let adminCompPlatformFees = 0;
    let gmCompPlatformFees = 0;
    let adminCompPlatformFeeCount = 0;
    let gmCompPlatformFeeCount = 0;
    try {
      const compFeeBreakdown = await PlatformTransaction.aggregate([
        {
          $match: {
            transactionType: "platform_fee",
            sourceType: "competition",
          },
        },
        {
          $group: {
            _id: { $ifNull: ["$isGmCreated", false] },
            totalFees: { $sum: "$amount" },
            totalFeesEUR: { $sum: "$amountEUR" },
            count: { $sum: 1 },
          },
        },
      ]);

      for (const item of compFeeBreakdown) {
        if (item._id === true) {
          gmCompPlatformFees = item.totalFeesEUR || 0;
          gmCompPlatformFeeCount = item.count || 0;
        } else {
          adminCompPlatformFees = item.totalFeesEUR || 0;
          adminCompPlatformFeeCount = item.count || 0;
        }
      }
    } catch (e) {
      console.error("Error getting competition fee breakdown:", e);
    }

    // Get recent transactions (last 50) with user info
    const recentTransactions = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Collect all user IDs from transactions and withdrawal requests
    const withdrawalUserIds = pendingWithdrawalRequests.map((w) => w.userId);
    const txUserIds = [
      ...new Set([
        ...recentTransactions
          .map((t) => t.userId)
          .filter((id) => id !== "platform"),
        ...withdrawalUserIds,
      ]),
    ];
    const txUsersMap = await getUsersByIds(txUserIds);

    // Calculate totals from wallets (including both competitions and challenges)
    const totalCreditsInCirculation = wallets.reduce(
      (sum, w) => sum + (w.creditBalance || 0),
      0,
    );
    const totalDeposited = wallets.reduce(
      (sum, w) => sum + (w.totalDeposited || 0),
      0,
    );
    const totalWithdrawn = wallets.reduce(
      (sum, w) => sum + (w.totalWithdrawn || 0),
      0,
    );

    // Reason: Use WalletTransaction as SINGLE source of truth for ALL financial totals.
    // CreditWallet fields were historically polluted by refunds.
    // Net spending = entries − refunds (refunds reverse the original entry fee).
    const platformTxTotals = await WalletTransaction.aggregate([
      {
        $match: {
          status: "completed",
          transactionType: {
            $in: [
              "competition_win", "challenge_win",
              "competition_entry", "challenge_entry",
              "competition_refund", "challenge_refund",
              "marketplace_purchase",
            ],
          },
        },
      },
      { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
    ]);
    const platTxMap = new Map<string, number>();
    for (const t of platformTxTotals) {
      platTxMap.set(t._id, t.total);
    }
    const totalWonFromCompetitions = Math.abs(platTxMap.get("competition_win") || 0);
    const totalWonFromChallenges = Math.abs(platTxMap.get("challenge_win") || 0);
    const totalCompRefund = Math.abs(platTxMap.get("competition_refund") || 0);
    const totalChalRefund = Math.abs(platTxMap.get("challenge_refund") || 0);
    const totalSpentOnCompetitions = Math.abs(platTxMap.get("competition_entry") || 0) - totalCompRefund;
    const totalSpentOnChallenges = Math.abs(platTxMap.get("challenge_entry") || 0) - totalChalRefund;
    const totalSpentOnMarketplace = Math.abs(platTxMap.get("marketplace_purchase") || 0);

    // Reason: Per-user totals also need transaction-based calculation
    // to avoid showing polluted CreditWallet values in the admin wallets table.
    const perUserTotals = await WalletTransaction.aggregate([
      {
        $match: {
          status: "completed",
          transactionType: {
            $in: [
              "competition_win", "challenge_win",
              "competition_entry", "challenge_entry",
              "competition_refund", "challenge_refund",
              "marketplace_purchase",
            ],
          },
        },
      },
      {
        $group: {
          _id: { userId: "$userId", type: "$transactionType" },
          total: { $sum: "$amount" },
        },
      },
    ]);
    // Build lookup: userId -> { compWins, chalWins, compSpent, chalSpent, marketplace }
    const userTxMap = new Map<string, { compWins: number; chalWins: number; compSpent: number; chalSpent: number; compRefund: number; chalRefund: number; marketplace: number }>();
    for (const row of perUserTotals) {
      const uid = row._id.userId;
      if (!userTxMap.has(uid)) userTxMap.set(uid, { compWins: 0, chalWins: 0, compSpent: 0, chalSpent: 0, compRefund: 0, chalRefund: 0, marketplace: 0 });
      const entry = userTxMap.get(uid)!;
      const absTotal = Math.abs(row.total);
      if (row._id.type === "competition_win") entry.compWins = absTotal;
      else if (row._id.type === "challenge_win") entry.chalWins = absTotal;
      else if (row._id.type === "competition_entry") entry.compSpent = absTotal;
      else if (row._id.type === "challenge_entry") entry.chalSpent = absTotal;
      else if (row._id.type === "competition_refund") entry.compRefund = absTotal;
      else if (row._id.type === "challenge_refund") entry.chalRefund = absTotal;
      else if (row._id.type === "marketplace_purchase") entry.marketplace = absTotal;
    }

    // Calculate liability metrics
    const conversionRate = conversionSettings.eurToCreditsRate;
    const totalLiabilityEUR = totalCreditsInCirculation / conversionRate;
    // Use WithdrawalRequest for accurate pending amounts (in EUR)
    const pendingWithdrawalsEUR = pendingWithdrawalRequests.reduce(
      (sum, w) => sum + (w.amountEUR || 0),
      0,
    );
    const pendingWithdrawalsTotal = pendingWithdrawalsEUR * conversionRate; // Convert back to credits for display

    return NextResponse.json({
      success: true,
      data: {
        wallets: wallets.map((w) => {
          const userInfo = usersMap.get(w.userId);
          // Reason: Use transaction-based totals for BOTH wins and spending
          const uTx = userTxMap.get(w.userId) || { compWins: 0, chalWins: 0, compSpent: 0, chalSpent: 0, compRefund: 0, chalRefund: 0, marketplace: 0 };
          return {
            userId: w.userId,
            userName: userInfo?.name || "Unknown",
            userEmail: userInfo?.email || "Unknown",
            creditBalance: w.creditBalance,
            totalDeposited: w.totalDeposited,
            totalWithdrawn: w.totalWithdrawn,
            totalWonFromCompetitions: uTx.compWins,
            totalSpentOnCompetitions: uTx.compSpent - uTx.compRefund,
            totalWonFromChallenges: uTx.chalWins,
            totalSpentOnChallenges: uTx.chalSpent - uTx.chalRefund,
            totalSpentOnMarketplace: uTx.marketplace,
          };
        }),
        pendingWithdrawals: pendingWithdrawalRequests.map((w) => {
          const userInfo = txUsersMap.get(w.userId);
          return {
            _id: w._id,
            userId: w.userId,
            userName: w.userName || userInfo?.name || "Unknown",
            userEmail: w.userEmail || userInfo?.email || "Unknown",
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
          totalSpentOnMarketplace,
          totalPlatformFees: platformFees[0]?.totalFees || 0,
          totalFeeTransactions: platformFees[0]?.count || 0,
        },
        // NEW: Enhanced platform financial metrics
        // Reason: GM fees from WalletTransaction are in credits — convert to EUR for consistency
        platformFinancials: {
          ...platformFinancialStats,
          totalGameMasterFees: (gameMasterFees[0]?.totalFees || 0) / conversionRate,
          gmFeesFromCompetitions: (gmCompetitionFees?.totalFees || 0) / conversionRate,
          gmFeesFromChallenges: (gmChallengeFees?.totalFees || 0) / conversionRate,
          gmCompetitionPaymentCount: gmCompetitionFees?.count || 0,
          gmChallengePaymentCount: gmChallengeFees?.count || 0,
          gmFeesDetail: gmFeesDetail, // Top GMs by earnings (amounts in credits)
          unclaimedPools: unclaimedPoolsSummary,
          // Reason: Breakdown of competition platform fees by creator type (admin vs GM).
          // This helps admins understand revenue attribution and validate GM competition economics.
          competitionFeeBreakdown: {
            adminCompetitionFees: adminCompPlatformFees,
            adminCompetitionFeeCount: adminCompPlatformFeeCount,
            gmCompetitionFees: gmCompPlatformFees,
            gmCompetitionFeeCount: gmCompPlatformFeeCount,
          },
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
        recentTransactions: await Promise.all(
          recentTransactions.slice(0, 20).map(async (t) => {
            const userInfo =
              t.userId === "platform"
                ? { name: "Platform", email: "system" }
                : txUsersMap.get(t.userId);

            // For withdrawals, get actual status and fee details from WithdrawalRequest (source of truth)
            let actualStatus = t.status;
            let enrichedMetadata = { ...t.metadata };

            if (
              t.transactionType === "withdrawal" &&
              t.metadata?.withdrawalRequestId
            ) {
              const withdrawalReq = await WithdrawalRequest.findById(
                t.metadata.withdrawalRequestId,
              ).lean();
              if (withdrawalReq) {
                // Map withdrawal request status to wallet transaction status
                if (withdrawalReq.status === "completed")
                  actualStatus = "completed";
                else if (
                  withdrawalReq.status === "rejected" ||
                  withdrawalReq.status === "failed"
                )
                  actualStatus = "failed";
                else if (withdrawalReq.status === "cancelled")
                  actualStatus = "cancelled";
                else actualStatus = "pending"; // pending, approved, processing all show as pending

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
              userName: userInfo?.name || "Unknown",
              userEmail: userInfo?.email || "Unknown",
              transactionType: t.transactionType,
              amount: t.amount,
              status: actualStatus,
              createdAt: t.createdAt,
              description: t.description,
              competitionId: t.competitionId,
              paymentMethod: t.paymentMethod,
              metadata: enrichedMetadata,
            };
          }),
        ),
        conversionRate: conversionSettings.eurToCreditsRate,
      },
    });
  } catch (error) {
    console.error("Error fetching financial dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial data" },
      { status: 500 },
    );
  }
}
