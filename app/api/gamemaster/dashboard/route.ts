import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import GameMasterEarning from "@/database/models/gamemaster/gamemaster-earning.model";
import UserReferral from "@/database/models/user-referral.model";
import Competition from "@/database/models/trading/competition.model";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";

/**
 * GET /api/gamemaster/dashboard
 * Get Game Master dashboard data for the authenticated user.
 * Returns subscription, stats, competitions, referrals, and earnings.
 */
export async function GET() {
  try {
    await connectToDatabase();

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // ── Subscription ────────────────────────────────────────────────
    const subscription = (await GameMasterSubscription.findOne({
      userId,
    }).lean()) as {
      _id: { toString(): string };
      userId: string;
      packageId?: string;
      packageName?: string;
      referralCode?: string;
      startDate?: string;
      endDate?: string;
      autoRenew?: boolean;
      renewalPrice?: number;
      isPaused?: boolean;
      pausedAt?: string;
      scheduledForDeletion?: boolean;
      scheduledDeletionAt?: string;
      status?: string;
      currentPeriodCompetitionsCreated?: number;
      totalCompetitionsCreated?: number;
      totalEarnings?: number;
      pendingEarnings?: number;
      totalReferredUsers?: number;
      activeReferredUsers?: number;
      limits?: {
        maxCompetitionsPerDay?: number;
        maxUsersPerCompetition?: number;
        referralFeePercentage?: number;
        canCreateCompetitions?: boolean;
        canEarnFromChallenges?: boolean;
        challengeReferralFeePercentage?: number;
      };
      [key: string]: unknown;
    } | null;

    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          subscription: null,
          referredUsers: [],
          recentEarnings: [],
          recentCompetitions: [],
          stats: null,
        },
      });
    }

    // ── Current package settings (live from MarketplaceItem) ────────
    let currentPackageLimits: {
      maxCompetitionsPerDay?: number;
      maxUsersPerCompetition?: number;
      referralFeePercentage?: number;
      canCreateCompetitions?: boolean;
      canEarnFromChallenges?: boolean;
      challengeReferralFeePercentage?: number;
    } = subscription.limits || {};

    if (subscription.packageId) {
      const currentPackage = (await MarketplaceItem.findById(
        subscription.packageId,
      ).lean()) as {
        gameMasterConfig?: {
          maxCompetitionsPerDay?: number;
          maxUsersPerCompetition?: number;
          referralFeePercentage?: number;
          canCreateCompetitions?: boolean;
          canEarnFromChallenges?: boolean;
          challengeReferralFeePercentage?: number;
        };
      } | null;
      if (currentPackage?.gameMasterConfig) {
        currentPackageLimits = {
          maxCompetitionsPerDay:
            currentPackage.gameMasterConfig.maxCompetitionsPerDay,
          maxUsersPerCompetition:
            currentPackage.gameMasterConfig.maxUsersPerCompetition,
          referralFeePercentage:
            currentPackage.gameMasterConfig.referralFeePercentage,
          canCreateCompetitions:
            currentPackage.gameMasterConfig.canCreateCompetitions !== false,
          canEarnFromChallenges:
            currentPackage.gameMasterConfig.canEarnFromChallenges === true,
          challengeReferralFeePercentage:
            currentPackage.gameMasterConfig.challengeReferralFeePercentage ??
            currentPackage.gameMasterConfig.referralFeePercentage ??
            0,
        };
      }
    }

    const canCreateCompetitions =
      currentPackageLimits.canCreateCompetitions !== false;
    const canEarnFromChallenges =
      currentPackageLimits.canEarnFromChallenges === true;

    // ── Referred Users ──────────────────────────────────────────────
    const referredUsers = await UserReferral.find({ gameMasterId: userId })
      .select("userName userEmail referredAt userId isActive")
      .sort({ referredAt: -1 })
      .limit(100)
      .lean()
      .then((users) =>
        users.map((u) => ({
          _id: u.userId,
          name: u.userName || "Unknown",
          email: u.userEmail,
          createdAt: u.referredAt,
          isActive: u.isActive,
        })),
      );

    // ── Competitions ────────────────────────────────────────────────
    const competitions = await Competition.find({ gameMasterId: userId })
      .select(
        "name status currentParticipants maxParticipants prizePool entryFee startTime endTime createdAt",
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .then((comps) =>
        comps.map((c: { _id: { toString(): string }; name: string; status: string; currentParticipants?: number; maxParticipants?: number; prizePool?: number; entryFee?: number; startTime: string; endTime: string; createdAt: string }) => ({
          id: c._id.toString(),
          name: c.name,
          status: c.status,
          participants: c.currentParticipants || 0,
          maxParticipants: c.maxParticipants || 0,
          prizePool: c.prizePool || 0,
          entryFee: c.entryFee || 0,
          startTime: c.startTime,
          endTime: c.endTime,
          createdAt: c.createdAt,
        })),
      );

    // ── Earnings ────────────────────────────────────────────────────
    const recentEarnings = await GameMasterEarning.find({
      gameMasterId: userId,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .then((earnings) =>
        earnings.map((e: { _id: { toString(): string }; sourceType?: string; sourceName?: string; referredUserName?: string; entryFeeAmount?: number; netEarning?: number; status?: string; createdAt: string }) => ({
          id: e._id.toString(),
          sourceType: e.sourceType || "competition",
          sourceName: e.sourceName || "Unknown",
          referredUserName: e.referredUserName || "Unknown",
          entryFeeAmount: e.entryFeeAmount || 0,
          netEarning: e.netEarning || 0,
          status: e.status || "pending",
          createdAt: e.createdAt,
        })),
      );

    // ── Earnings Aggregation ────────────────────────────────────────
    const earningsAgg = await GameMasterEarning.aggregate([
      { $match: { gameMasterId: userId } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$netEarning" },
          paidEarnings: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$netEarning", 0] },
          },
          pendingEarnings: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$netEarning", 0],
            },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    const earningsSummary = earningsAgg[0] || {
      totalEarnings: 0,
      paidEarnings: 0,
      pendingEarnings: 0,
      totalTransactions: 0,
    };

    // ── Competition Counts ──────────────────────────────────────────
    const totalCompetitions = competitions.length;
    const activeCompetitions = competitions.filter(
      (c) => c.status === "active",
    ).length;
    const completedCompetitions = competitions.filter(
      (c) => c.status === "completed",
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          ...subscription,
          limits: currentPackageLimits,
          canCreateCompetitions,
          canEarnFromChallenges,
        },
        referredUsers,
        recentEarnings,
        recentCompetitions: competitions,
        stats: {
          totalReferredUsers: referredUsers.length,
          activeReferredUsers: referredUsers.filter((r) => r.isActive).length,
          totalCompetitions,
          activeCompetitions,
          completedCompetitions,
          ...earningsSummary,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching GM dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
