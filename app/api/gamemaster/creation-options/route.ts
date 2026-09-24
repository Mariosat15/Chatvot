import { NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import { listContestableTitles } from "@/lib/services/game-providers/provider-contest.service";
import { resolveCreationLimits } from "@/lib/services/gamemaster/game-permissions";
import { loadGameMasterPackageConfig } from "@/lib/services/gamemaster/package-config";
import { resolveGameMasterPlatformFeePercentage } from "@/lib/services/gamemaster/platform-fee";

/**
 * GET /api/gamemaster/creation-options
 *
 * What the Game Master create screen may offer: resolved allowed game types, and when
 * `provider` is allowed, the contestable catalogue titles (same list as the admin wizard).
 *
 * Titles are withheld entirely when provider is not permitted - a picker of games the API
 * would 403 is friction that teaches nothing.
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

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 },
      );
    }

    const subscription = await db.collection("gamemastersubscriptions").findOne({
      userId: session.user.id,
      status: "active",
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "No active Game Master subscription" },
        { status: 403 },
      );
    }

    const packageConfig = await loadGameMasterPackageConfig(
      db,
      subscription.packageId ? String(subscription.packageId) : null,
    );

    const effectiveLimits = resolveCreationLimits({
      limits: subscription.limits,
      packageConfig,
      override: subscription.competitionCreationOverride,
      overrideLimits: subscription.overrideLimits,
    });

    const allowedGameTypes = effectiveLimits.allowedGameTypes;

    const providerAllowed = allowedGameTypes.includes("provider");
    const titles = providerAllowed ? await listContestableTitles() : [];
    const platformFeePercentage =
      await resolveGameMasterPlatformFeePercentage();

    // Daily reset is owned by the create route; surface the raw counter here so the
    // game wizard can show the same banner trading uses without a second status fetch.
    const competitionsCreatedToday =
      typeof subscription.currentPeriodCompetitionsCreated === "number"
        ? subscription.currentPeriodCompetitionsCreated
        : 0;

    return NextResponse.json({
      success: true,
      allowedGameTypes,
      canCreateCompetitions: effectiveLimits.canCreateCompetitions,
      maxUsersPerCompetition: effectiveLimits.maxUsersPerCompetition,
      maxCompetitionsPerDay: effectiveLimits.maxCompetitionsPerDay,
      competitionsCreatedToday,
      // Admin-controlled; GM UI shows this locked and the create route ignores body.
      platformFeePercentage,
      titles: titles.map((t) => ({
        providerKey: t.providerKey,
        providerName: t.providerName,
        gameCode: t.gameCode,
        gameKey: t.gameKey,
        displayName: t.displayName,
        category: t.category,
        playMode: t.playMode,
        supportedPlayModes: t.supportedPlayModes,
        maxDurationSeconds: t.maxDurationSeconds,
        schema: t.schema,
      })),
    });
  } catch (error) {
    console.error("Error loading GM creation options:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
