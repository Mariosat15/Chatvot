/**
 * Dashboard Stats API
 *
 * Returns comprehensive statistics for the admin dashboard overview
 */

import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import PaymentProvider from "@/database/models/payment-provider.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  getLiveContestOverview,
  shouldShowPriceFeed,
  type LiveContestOverview,
} from "@/lib/services/games/live-contest-overview.service";

// Get User, KYCVerification, and KYCSettings collections directly (models not available in admin app)
const getUserCollection = () => mongoose.connection.collection("users");
const getKYCCollection = () =>
  mongoose.connection.collection("kycverifications");
const getKYCSettingsCollection = () =>
  mongoose.connection.collection("kycsettings");

interface DashboardStats {
  // User Stats
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    verified: number;
    active: number; // logged in last 30 days
  };

  // Deposit Stats
  deposits: {
    total: number;
    totalEUR: number;
    completedToday: number;
    completedTodayEUR: number;
    pendingCount: number;
    pendingEUR: number;
    failedToday: number;
  };

  // Withdrawal Stats
  withdrawals: {
    total: number;
    totalEUR: number;
    completedToday: number;
    completedTodayEUR: number;
    pendingCount: number;
    pendingEUR: number;
    failedToday: number;
    processingCount: number;
    approvedCount: number;
  };

  // KYC Stats
  kyc: {
    totalVerified: number;
    pendingCount: number;
    rejectedToday: number;
    approvedToday: number;
  };

  // Fraud Stats
  fraud: {
    activeAlerts: number;
    highPriorityAlerts: number;
    alertsToday: number;
    suspendedUsers: number;
    bannedUsers: number;
  };

  // Service Status
  services: {
    database: "operational" | "degraded" | "down";
    webhooks: "operational" | "degraded" | "down";
    payments: {
      stripe: "operational" | "degraded" | "down" | "not_configured";
      nuvei: "operational" | "degraded" | "down" | "not_configured";
      paddle: "operational" | "degraded" | "down" | "not_configured";
      atlas: "operational" | "degraded" | "down" | "not_configured";
    };
    massive: "operational" | "degraded" | "down" | "not_configured";
    redis: "operational" | "degraded" | "down" | "not_configured";
    kyc: "operational" | "degraded" | "down" | "not_configured";
  };

  /**
   * What is running right now, per game.
   *
   * Deliberately carries no money. The overview is granted by the `overview` section while
   * revenue lives behind `analytics` and `financial`, so a prize pool or a fee figure here
   * would quietly widen who can read the platform's earnings.
   */
  contests: LiveContestOverview & { showPriceFeed: boolean };

  // Recent Activity
  recentActivity: {
    type: "deposit" | "withdrawal" | "user" | "kyc" | "fraud";
    description: string;
    timestamp: string;
    status?: "success" | "warning" | "error";
  }[];

  // Timestamp
  generatedAt: string;
}

/*
  The three shapes the recent-activity feed reads.

  Reason they are named rather than cast with `as any[]`: the pre-commit hook rejects `any` in a
  file being edited, and naming the two or three fields each loop touches is both narrower and
  self-documenting. `unknown` first because these arrive from `.lean()`, whose inferred type has
  no properties in common with a declared interface.
*/
interface RecentDepositRow {
  status?: string;
  metadata?: { eurAmount?: number };
  createdAt: Date;
}
interface RecentWithdrawalRow {
  status?: string;
  amountEUR?: number;
  createdAt: Date;
}
interface RecentUserRow {
  name?: string;
  email?: string;
  createdAt: Date;
}

// Helper to get date boundaries
function getDateBoundaries() {
  const now = new Date();

  // Start of today (midnight)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Start of this week (Monday)
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 30 days ago
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return { now, startOfToday, startOfWeek, startOfMonth, thirtyDaysAgo };
}

// Check service status
async function checkServiceStatus(): Promise<DashboardStats["services"]> {
  const services: DashboardStats["services"] = {
    database: "operational",
    webhooks: "operational",
    payments: {
      stripe: "not_configured",
      nuvei: "not_configured",
      paddle: "not_configured",
      atlas: "not_configured",
    },
    massive: "not_configured",
    redis: "not_configured",
    kyc: "not_configured",
  };

  try {
    // Check payment providers
    const paymentProviders = await PaymentProvider.find({ isActive: true });
    for (const provider of paymentProviders) {
      if (provider.slug === "stripe") {
        services.payments.stripe = "operational";
      } else if (provider.slug === "nuvei") {
        services.payments.nuvei = "operational";
      } else if (provider.slug === "paddle") {
        services.payments.paddle = "operational";
      } else if (provider.slug === "atlas") {
        services.payments.atlas = "operational";
      }
    }

    // Also check env vars
    if (process.env.STRIPE_SECRET_KEY) {
      services.payments.stripe = "operational";
    }
    if (process.env.NUVEI_MERCHANT_ID && process.env.NUVEI_SECRET_KEY) {
      services.payments.nuvei = "operational";
    }

    // Check WhiteLabel settings for other services
    const settings = (await WhiteLabel.findOne().lean()) as Record<
      string,
      unknown
    > | null;
    if (settings) {
      // Massive WebSocket
      if (settings.massiveApiKey || process.env.MASSIVE_API_KEY) {
        services.massive = "operational";
      }

      // Redis
      if (settings.redisEnabled || process.env.REDIS_URL) {
        try {
          // Try to ping Redis if configured
          const redisUrl =
            (settings.redisUrl as string) || process.env.REDIS_URL;
          if (redisUrl) {
            services.redis = "operational";
          }
        } catch {
          services.redis = "down";
        }
      }

      // KYC (Veriff) - check WhiteLabel settings
      if (settings.veriffApiKey || process.env.VERIFF_API_KEY) {
        services.kyc = "operational";
      }
    }
    
    // Also check KYCSettings collection for Veriff configuration
    if (services.kyc === "not_configured") {
      try {
        const kycSettingsCollection = getKYCSettingsCollection();
        const kycSettings = await kycSettingsCollection.findOne({});
        if (kycSettings && (kycSettings.veriffApiKey || kycSettings.enabled)) {
          services.kyc = "operational";
        }
      } catch {
        // KYCSettings collection might not exist, continue
      }
    }
  } catch (error) {
    console.error("Error checking service status:", error);
  }

  return services;
}

export async function GET() {
  try {
    /*
      SECTION ACCESS, NOT ADMIN-AT-ALL, AND THE CHANGE IS REQUIRED BY THE PAYLOAD RATHER THAN
      TIDINESS. This used to call `verifyAdminAuth`, which asks only whether the caller is an
      admin of any kind - so an employee granted one unrelated section passed it. That is the
      eighth instance of that class here, after Prerequisite A, the internal-secret fallbacks,
      the unprotected suspicion-score route, the provider admin routes, the trading contest
      PUT, the lifecycle routes and the analytics route.

      It matters more than usual now: this response gained contest and participant counts, so
      leaving the weaker check would have widened who can read them. `overview` is the section
      that owns the only screen fetching this route - checked with `rg`, there is exactly one
      caller - so nobody who could reach the screen loses access.
    */
    const guard = await guardSection("overview");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const { startOfToday, startOfWeek, startOfMonth, thirtyDaysAgo } =
      getDateBoundaries();

    // Get collections for models not available in admin app
    const usersCollection = getUserCollection();
    const kycCollection = getKYCCollection();

    // Run all queries in parallel for efficiency
    const [
      // User stats
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      verifiedUsers,
      activeUsers,

      // Deposit stats
      totalDeposits,
      depositsTodayCompleted,
      pendingDeposits,
      failedDepositsToday,

      // Withdrawal stats
      totalWithdrawals,
      withdrawalsTodayCompleted,
      pendingWithdrawals,
      processingWithdrawals,
      approvedWithdrawals,
      failedWithdrawalsToday,

      // KYC stats
      totalKYCVerified,
      pendingKYC,
      kycApprovedToday,
      kycRejectedToday,

      // Fraud stats
      activeAlerts,
      highPriorityAlerts,
      alertsToday,
      suspendedUsers,
      bannedUsers,

      // Recent activity (last 10 items)
      recentDeposits,
      recentWithdrawals,
      recentUsers,

      // Service status
      services,

      // What is running right now, per game
      contestOverview,
    ] = await Promise.all([
      // User queries (using collection directly)
      // estimatedDocumentCount() is O(1) metadata read vs countDocuments() full scan
      usersCollection.estimatedDocumentCount(),
      usersCollection.countDocuments({ createdAt: { $gte: startOfToday } }),
      usersCollection.countDocuments({ createdAt: { $gte: startOfWeek } }),
      usersCollection.countDocuments({ createdAt: { $gte: startOfMonth } }),
      usersCollection.countDocuments({ emailVerified: true }),
      usersCollection.countDocuments({ updatedAt: { $gte: thirtyDaysAgo } }),

      // Deposit queries - use processedAt or createdAt for today's deposits
      WalletTransaction.aggregate([
        { $match: { transactionType: "deposit", status: "completed" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: {
              $sum: {
                $ifNull: [
                  "$metadata.eurAmount",
                  { $ifNull: ["$metadata.baseAmount", 0] },
                ],
              },
            },
          },
        },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            transactionType: "deposit",
            status: "completed",
            $or: [
              { processedAt: { $gte: startOfToday } },
              {
                createdAt: { $gte: startOfToday },
                processedAt: { $exists: false },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: {
              $sum: {
                $ifNull: [
                  "$metadata.eurAmount",
                  { $ifNull: ["$metadata.baseAmount", 0] },
                ],
              },
            },
          },
        },
      ]),
      WalletTransaction.aggregate([
        { $match: { transactionType: "deposit", status: "pending" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: {
              $sum: {
                $ifNull: [
                  "$metadata.eurAmount",
                  { $ifNull: ["$metadata.baseAmount", 0] },
                ],
              },
            },
          },
        },
      ]),
      WalletTransaction.countDocuments({
        transactionType: "deposit",
        status: "failed",
        updatedAt: { $gte: startOfToday },
      }),

      // Withdrawal queries - include pending, approved, and processing
      WithdrawalRequest.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$amountEUR" },
          },
        },
      ]),
      WithdrawalRequest.aggregate([
        {
          $match: {
            status: "completed",
            $or: [
              { processedAt: { $gte: startOfToday } },
              {
                updatedAt: { $gte: startOfToday },
                processedAt: { $exists: false },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$amountEUR" },
          },
        },
      ]),
      // Pending withdrawals - include pending, approved, and processing statuses
      WithdrawalRequest.aggregate([
        { $match: { status: { $in: ["pending", "approved", "processing"] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$amountEUR" },
          },
        },
      ]),
      WithdrawalRequest.countDocuments({ status: "processing" }),
      WithdrawalRequest.countDocuments({ status: "approved" }),
      WithdrawalRequest.countDocuments({
        status: { $in: ["failed", "rejected"] },
        updatedAt: { $gte: startOfToday },
      }),

      // KYC queries (using collection directly)
      kycCollection.countDocuments({ status: "approved" }).catch(() => 0),
      kycCollection.countDocuments({ status: "pending" }).catch(() => 0),
      kycCollection
        .countDocuments({
          status: "approved",
          updatedAt: { $gte: startOfToday },
        })
        .catch(() => 0),
      kycCollection
        .countDocuments({
          status: "rejected",
          updatedAt: { $gte: startOfToday },
        })
        .catch(() => 0),

      // Fraud queries
      FraudAlert.countDocuments({
        status: { $in: ["pending", "investigating"] },
      }).catch(() => 0),
      FraudAlert.countDocuments({
        status: { $in: ["pending", "investigating"] },
        priority: "high",
      }).catch(() => 0),
      FraudAlert.countDocuments({ createdAt: { $gte: startOfToday } }).catch(
        () => 0,
      ),
      usersCollection
        .countDocuments({ "restrictions.status": "suspended" })
        .catch(() => 0),
      usersCollection
        .countDocuments({ "restrictions.status": "banned" })
        .catch(() => 0),

      // Recent activity
      WalletTransaction.find({ transactionType: "deposit" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status metadata.eurAmount createdAt")
        .lean(),
      WithdrawalRequest.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status amountEUR createdAt")
        .lean(),
      usersCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ name: 1, email: 1, createdAt: 1 })
        .toArray(),

      // Service status
      checkServiceStatus(),

      /*
        Reason it degrades to an empty overview rather than failing the request: every other
        figure on this page is independent of it, and a front page that returns 500 because one
        contest aggregation failed tells an operator nothing about the deposits and fraud alerts
        it could have shown. An empty `rows` array renders as "nothing running", which is
        honest, and the error is logged with context.
      */
      getLiveContestOverview().catch((error) => {
        console.error("❌ Live contest overview failed:", error);
        return {
          rows: [],
          totals: { active: 0, upcoming: 0, participants: 0 },
          // Fails towards SHOWING the price-feed tile. Withholding a health indicator because a
          // contest query failed is the one direction that costs an operator information.
          tradingEnabled: true,
          tradingHasLiveContests: false,
        } satisfies LiveContestOverview;
      }),
    ]);

    // Build recent activity
    const recentActivity: DashboardStats["recentActivity"] = [];

    for (const deposit of recentDeposits as unknown as RecentDepositRow[]) {
      recentActivity.push({
        type: "deposit",
        description: `€${deposit.metadata?.eurAmount?.toFixed(2) || "0"} deposit ${deposit.status}`,
        timestamp: deposit.createdAt.toISOString(),
        status:
          deposit.status === "completed"
            ? "success"
            : deposit.status === "failed"
              ? "error"
              : "warning",
      });
    }

    for (const withdrawal of recentWithdrawals as unknown as RecentWithdrawalRow[]) {
      recentActivity.push({
        type: "withdrawal",
        description: `€${withdrawal.amountEUR?.toFixed(2) || "0"} withdrawal ${withdrawal.status}`,
        timestamp: withdrawal.createdAt.toISOString(),
        status:
          withdrawal.status === "completed"
            ? "success"
            : // Reason for the `?? ""`: the named shape types `status` as optional, and an
              // absent status must keep falling through to "warning" exactly as it did under the
              // `any` cast this replaced — `includes(undefined)` was already false.
              ["failed", "rejected"].includes(withdrawal.status ?? "")
              ? "error"
              : "warning",
      });
    }

    for (const user of recentUsers as unknown as RecentUserRow[]) {
      recentActivity.push({
        type: "user",
        description: `New user: ${user.name || user.email}`,
        timestamp: user.createdAt.toISOString(),
        status: "success",
      });
    }

    // Sort by timestamp
    recentActivity.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Build response
    const stats: DashboardStats = {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        verified: verifiedUsers,
        active: activeUsers,
      },
      deposits: {
        total: totalDeposits[0]?.count || 0,
        totalEUR: totalDeposits[0]?.total || 0,
        completedToday: depositsTodayCompleted[0]?.count || 0,
        completedTodayEUR: depositsTodayCompleted[0]?.total || 0,
        pendingCount: pendingDeposits[0]?.count || 0,
        pendingEUR: pendingDeposits[0]?.total || 0,
        failedToday: failedDepositsToday,
      },
      withdrawals: {
        total: totalWithdrawals[0]?.count || 0,
        totalEUR: totalWithdrawals[0]?.total || 0,
        completedToday: withdrawalsTodayCompleted[0]?.count || 0,
        completedTodayEUR: withdrawalsTodayCompleted[0]?.total || 0,
        pendingCount: pendingWithdrawals[0]?.count || 0,
        pendingEUR: pendingWithdrawals[0]?.total || 0,
        failedToday: failedWithdrawalsToday,
        processingCount: processingWithdrawals,
        approvedCount: approvedWithdrawals,
      },
      kyc: {
        totalVerified: totalKYCVerified,
        pendingCount: pendingKYC,
        approvedToday: kycApprovedToday,
        rejectedToday: kycRejectedToday,
      },
      fraud: {
        activeAlerts: activeAlerts,
        highPriorityAlerts: highPriorityAlerts,
        alertsToday: alertsToday,
        suspendedUsers: suspendedUsers,
        bannedUsers: bannedUsers,
      },
      services,
      contests: {
        ...contestOverview,
        showPriceFeed: shouldShowPriceFeed(contestOverview),
      },
      recentActivity: recentActivity.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
