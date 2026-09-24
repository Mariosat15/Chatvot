import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { resolveCreationLimits } from "@/lib/services/gamemaster/game-permissions";
import { loadGameMasterPackageConfig } from "@/lib/services/gamemaster/package-config";
import { buildSubscriptionLimits } from "@/lib/services/gamemaster/subscription-limits";

/**
 * GET /api/gamemaster/status
 * Get current user's game master status.
 *
 * Limits are resolved live (package + override), not the cached subscription.limits alone —
 * otherwise an admin package edit leaves this endpoint (and create-competition) on the old
 * comps/day until renewal.
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

    const subscription = await GameMasterSubscription.findOne({
      userId,
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return NextResponse.json({
        success: true,
        isGameMaster: false,
        subscription: null,
      });
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

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

    const limits = {
      maxCompetitionsPerDay: effective.maxCompetitionsPerDay,
      maxUsersPerCompetition: effective.maxUsersPerCompetition,
      referralFeePercentage: effective.referralFeePercentage,
      canCreateCompetitions: effective.canCreateCompetitions,
      allowedGameTypes: [...effective.allowedGameTypes],
      canEarnFromChallenges:
        packageConfig?.canEarnFromChallenges === true ||
        subscription.limits?.canEarnFromChallenges === true,
      challengeReferralFeePercentage:
        packageConfig?.challengeReferralFeePercentage ??
        subscription.limits?.challengeReferralFeePercentage ??
        effective.referralFeePercentage,
    };

    if (
      db &&
      packageConfig &&
      subscription.limits?.maxCompetitionsPerDay !== limits.maxCompetitionsPerDay
    ) {
      const healed = buildSubscriptionLimits(packageConfig);
      void GameMasterSubscription.updateOne(
        { _id: subscription._id },
        { $set: { limits: healed } },
      );
    }

    return NextResponse.json({
      success: true,
      isGameMaster: subscription.status === "active" && endDate > now,
      subscription: {
        id: subscription._id.toString(),
        status: subscription.status,
        packageName: subscription.packageName,
        referralCode: subscription.referralCode,
        referralLink: subscription.referralLink,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextRenewalDate: subscription.nextRenewalDate,
        autoRenew: subscription.autoRenew,
        renewalPrice: subscription.renewalPrice,
        daysRemaining,
        limits,
        stats: {
          totalReferredUsers: subscription.totalReferredUsers,
          activeReferredUsers: subscription.activeReferredUsers,
          totalEarnings: subscription.totalEarnings,
          pendingEarnings: subscription.pendingEarnings,
          totalCompetitionsCreated: subscription.totalCompetitionsCreated,
          currentPeriodCompetitionsCreated:
            subscription.currentPeriodCompetitionsCreated,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching game master status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
