import { NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import { listContestableTitles } from "@/lib/services/game-providers/provider-contest.service";
import {
  resolveCreationLimits,
} from "@/lib/services/gamemaster/game-permissions";

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

    let packageConfig = null;
    if (subscription.packageId) {
      try {
        const currentPackage = await db.collection("marketplaceitems").findOne({
          _id: new ObjectId(subscription.packageId),
        });
        packageConfig = currentPackage?.gameMasterConfig ?? null;
      } catch (e) {
        console.error("Error fetching package:", e);
      }
    }

    const effectiveLimits = resolveCreationLimits({
      limits: subscription.limits,
      packageConfig,
      override: subscription.competitionCreationOverride,
      overrideLimits: subscription.overrideLimits,
    });

    const allowedGameTypes = effectiveLimits.allowedGameTypes;

    const providerAllowed = allowedGameTypes.includes("provider");
    const titles = providerAllowed ? await listContestableTitles() : [];

    return NextResponse.json({
      success: true,
      allowedGameTypes,
      canCreateCompetitions: effectiveLimits.canCreateCompetitions,
      maxUsersPerCompetition: effectiveLimits.maxUsersPerCompetition,
      maxCompetitionsPerDay: effectiveLimits.maxCompetitionsPerDay,
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
