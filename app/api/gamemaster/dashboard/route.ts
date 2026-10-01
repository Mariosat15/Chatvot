import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import GameMasterEarning from "@/database/models/gamemaster/gamemaster-earning.model";
import { readReferredPlayers } from "@/lib/services/gamemaster/referral-read-model";
import { MAX_PAGE_LIMIT } from "@/lib/services/gamemaster/referral-report-filter";
import { toGameMasterReferralView } from "@/lib/services/gamemaster/gm-referral-view";
import Competition from "@/database/models/trading/competition.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { earningsByGameGroupStages } from "@/lib/services/gamemaster/earnings-by-game";
import { labelForGameKey } from "@/lib/services/games/game-leaderboard.service";
import { resolveCreationLimits } from "@/lib/services/gamemaster/game-permissions";
import { loadGameMasterPackageConfig } from "@/lib/services/gamemaster/package-config";
import {
  buildSubscriptionLimits,
  resolveShowExternalReferralDetails,
} from "@/lib/services/gamemaster/subscription-limits";
import {
  countActiveCompetitionsInList,
  remainingActiveCompetitionSlots,
} from "@/lib/services/gamemaster/active-competitions";

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
        allowedGameTypes?: string[];
        showExternalReferralDetails?: boolean;
      };
      competitionCreationOverride?: "enabled" | "disabled" | null;
      overrideLimits?: {
        maxCompetitionsPerDay?: number;
        maxUsersPerCompetition?: number;
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

    // Reason: same resolver as create / creation-options. A hand-built package overwrite
    // ignored admin overrides and could leave the UI on a stale cached daily cap when the
    // package lookup failed while the create gate still read the live package.
    const db = mongoose.connection.db;
    const packageConfig = db
      ? await loadGameMasterPackageConfig(db, subscription.packageId)
      : null;
    const effective = resolveCreationLimits({
      limits: subscription.limits,
      packageConfig,
      override: subscription.competitionCreationOverride ?? null,
      overrideLimits: subscription.overrideLimits ?? null,
    });

    const displayLimits = {
      maxCompetitionsPerDay: effective.maxCompetitionsPerDay,
      maxActiveCompetitions: effective.maxActiveCompetitions,
      maxUsersPerCompetition: effective.maxUsersPerCompetition,
      referralFeePercentage: effective.referralFeePercentage,
      canCreateCompetitions: effective.canCreateCompetitions,
      allowedGameTypes: [...effective.allowedGameTypes],
      canEarnFromChallenges:
        packageConfig?.canEarnFromChallenges === true ||
        subscription.limits?.canEarnFromChallenges === true,
      challengeReferralFeePercentage:
        packageConfig?.challengeReferralFeePercentage ??
        packageConfig?.referralFeePercentage ??
        subscription.limits?.challengeReferralFeePercentage ??
        subscription.limits?.referralFeePercentage ??
        0,
    };

    // Reason: self-heal the cache when the live package disagrees. Marketplace sync can
    // miss rows (packageId string vs ObjectId); without this, /api/gamemaster/status and any
    // reader of subscription.limits keep showing the old comps/day until renewal.
    if (
      db &&
      packageConfig &&
      subscription.limits?.maxCompetitionsPerDay !==
        displayLimits.maxCompetitionsPerDay
    ) {
      const healed = buildSubscriptionLimits(packageConfig);
      void db.collection("gamemastersubscriptions").updateOne(
        { _id: subscription._id },
        { $set: { limits: healed, updatedAt: new Date() } },
      );
    }

    const canCreateCompetitions = displayLimits.canCreateCompetitions;
    const canEarnFromChallenges = displayLimits.canEarnFromChallenges;

    // ── Referred Users ──────────────────────────────────────────────
    // Reason: the shared read model plus the D6 view, the same pair /api/gamemaster/referrals
    // uses. The old query selected `userEmail` for every player, consent or not.
    // Reason: the switch comes from the session user's own package (current first, cached
    // limits as the fallback), never from the request - same resolver as the referrals route.
    const showExternalDetails = resolveShowExternalReferralDetails({
      packageConfig,
      cachedLimits: subscription.limits,
    });
    const referralReport = db
      ? await readReferredPlayers(
          db,
          { gameMasterIds: [userId], contactRequiresConsent: true, maskExternalContact: !showExternalDetails },
          { page: 1, limit: MAX_PAGE_LIMIT },
        )
      : null;
    const referredUsers = (referralReport?.rows ?? []).map((row) =>
      toGameMasterReferralView(row, { showExternalDetails }),
    );

    // ── Competitions ────────────────────────────────────────────────
    const competitions = await Competition.find({ gameMasterId: userId })
      .select(
        "name status currentParticipants minParticipants maxParticipants prizePool entryFee startTime endTime createdAt",
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .then((comps) =>
        comps.map((c) => ({
          id: String(c._id),
          name: c.name,
          status: c.status,
          participants: c.currentParticipants || 0,
          minParticipants: c.minParticipants ?? 2,
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
        earnings.map((e) => ({
          id: String(e._id),
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

    // Reason (X7 step 5): per-game earnings for the GM dashboard. Groups on
    // stamped gameKey only — never re-joins contests or filters by enabled games.
    const byGameAgg = await GameMasterEarning.aggregate([
      { $match: { gameMasterId: userId } },
      ...earningsByGameGroupStages(),
    ]);
    const earningsByGame = await Promise.all(
      byGameAgg.map(
        async (row: { gameKey: string; netEarning: number; count: number }) => ({
          gameKey: row.gameKey,
          netEarning: row.netEarning,
          count: row.count,
          label: await labelForGameKey(row.gameKey),
        }),
      ),
    );

    // ── Competition Counts ──────────────────────────────────────────
    // Reason: "active" includes upcoming contests that already met minParticipants
    // (they will run even though status is not yet `active`). Matches the create gate.
    const totalCompetitions = competitions.length;
    const activeCompetitions = countActiveCompetitionsInList(
      competitions.map((c) => ({
        status: c.status,
        currentParticipants: c.participants,
        minParticipants: c.minParticipants,
      })),
    );
    const completedCompetitions = competitions.filter(
      (c) => c.status === "completed",
    ).length;
    const maxActiveCompetitions = displayLimits.maxActiveCompetitions;
    const remainingActiveSlots = remainingActiveCompetitionSlots(
      activeCompetitions,
      maxActiveCompetitions,
    );

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          ...subscription,
          limits: displayLimits,
          canCreateCompetitions,
          canEarnFromChallenges,
        },
        referredUsers,
        recentEarnings,
        recentCompetitions: competitions,
        earningsByGame,
        stats: {
          // Reason: from the summary, not the list - the list stops at one page.
          totalReferredUsers: referralReport?.summary.all.players ?? 0,
          activeReferredUsers: referralReport?.summary.all.current ?? 0,
          ownReferrals: referralReport?.summary.byKind.own.players ?? 0,
          externalReferrals: referralReport?.summary.byKind.external.players ?? 0,
          totalCompetitions,
          activeCompetitions,
          maxActiveCompetitions,
          remainingActiveSlots,
          completedCompetitions,
          ...earningsSummary,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching GM dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
