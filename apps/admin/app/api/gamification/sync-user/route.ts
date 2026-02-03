/**
 * Gamification Sync API
 * 
 * Retroactively awards milestones and badges to users who already completed
 * actions but didn't receive rewards (e.g., KYC completed before milestone system)
 * 
 * POST /api/gamification/sync-user
 * Body: { userId: string } - Sync single user
 * 
 * POST /api/gamification/sync-user?all=true
 * Body: {} - Sync all users (admin only, may take time)
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { getAdminSession } from "@/lib/admin/auth";
import CreditWallet from "@/database/models/trading/credit-wallet.model";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const syncAll = searchParams.get("all") === "true";
    const body = await req.json().catch(() => ({}));

    if (syncAll) {
      // Sync all users with wallets
      const results = await syncAllUsers();
      return NextResponse.json({
        success: true,
        message: `Synced ${results.processed} users`,
        results,
      });
    }

    // Sync single user
    const { userId } = body;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const result = await syncUserGamification(userId);
    return NextResponse.json({
      success: true,
      userId,
      ...result,
    });
  } catch (error) {
    console.error("Error syncing gamification:", error);
    return NextResponse.json(
      { error: "Failed to sync gamification" },
      { status: 500 }
    );
  }
}

/**
 * Sync gamification for a single user
 */
async function syncUserGamification(userId: string) {
  console.log(`🔄 [SYNC] Starting gamification sync for user ${userId}`);

  const results = {
    badgesAwarded: [] as string[],
    milestonesCompleted: [] as string[],
    xpAwarded: 0,
    leveledUp: false,
    newLevel: 0,
  };

  try {
    // 1. Evaluate all badges (this will award any missing badges)
    const { evaluateUserBadges } = await import(
      "@/lib/services/badge-evaluation.service"
    );
    const badgeResult = await evaluateUserBadges(userId);
    results.badgesAwarded = badgeResult.newBadges.map((b) => b.name);
    console.log(`🏅 [SYNC] Badges awarded: ${results.badgesAwarded.length}`);

    // 2. Check and complete any milestones
    const { checkAndCompleteMilestones } = await import(
      "@/lib/services/journey-progress.service"
    );
    const milestoneResult = await checkAndCompleteMilestones(userId);
    results.milestonesCompleted = milestoneResult.completed;
    results.xpAwarded = milestoneResult.totalXPEarned;
    console.log(`🗺️ [SYNC] Milestones completed: ${results.milestonesCompleted.length}`);

    // 3. Get final user level
    const { getUserLevel } = await import("@/lib/services/xp-level.service");
    const level = await getUserLevel(userId);
    results.newLevel = level.currentLevel;

    console.log(`✅ [SYNC] Sync complete for user ${userId}:`, results);
    return results;
  } catch (error) {
    console.error(`❌ [SYNC] Error syncing user ${userId}:`, error);
    throw error;
  }
}

/**
 * Sync gamification for ALL users
 */
async function syncAllUsers() {
  console.log("🔄 [SYNC] Starting sync for ALL users...");

  // Get all wallets (users who have interacted with the platform)
  const wallets = await CreditWallet.find({}).select("userId").lean();
  console.log(`📊 [SYNC] Found ${wallets.length} users to sync`);

  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    totalBadgesAwarded: 0,
    totalMilestonesCompleted: 0,
    errors: [] as { userId: string; error: string }[],
  };

  for (const wallet of wallets) {
    try {
      const userResult = await syncUserGamification(wallet.userId);
      results.success++;
      results.totalBadgesAwarded += userResult.badgesAwarded.length;
      results.totalMilestonesCompleted += userResult.milestonesCompleted.length;
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: wallet.userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.processed++;

    // Log progress every 10 users
    if (results.processed % 10 === 0) {
      console.log(`🔄 [SYNC] Progress: ${results.processed}/${wallets.length}`);
    }
  }

  console.log("✅ [SYNC] All users synced:", results);
  return results;
}

/**
 * GET - Get sync status for a user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query param required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get user's current gamification state
    const { getUserLevel } = await import("@/lib/services/xp-level.service");
    const { getUserJourneyProgress } = await import(
      "@/lib/services/journey-progress.service"
    );
    const UserBadge = (await import("@/database/models/user-badge.model")).default;

    const [level, progress, badges] = await Promise.all([
      getUserLevel(userId),
      getUserJourneyProgress(userId),
      UserBadge.find({ userId }).lean(),
    ]);

    // Get wallet status
    const wallet = await CreditWallet.findOne({ userId }).lean();

    return NextResponse.json({
      userId,
      wallet: wallet ? {
        kycVerified: (wallet as any).kycVerified,
        totalDeposited: (wallet as any).totalDeposited,
        totalWithdrawn: (wallet as any).totalWithdrawn,
      } : null,
      level: {
        currentLevel: level.currentLevel,
        currentXP: level.currentXP,
        currentTitle: level.currentTitle,
      },
      badges: {
        total: badges.length,
        list: badges.map((b: any) => b.badgeId),
      },
      journey: progress ? {
        completedMilestones: progress.completedMilestones?.length || 0,
        unlockedMilestones: progress.unlockedMilestones?.length || 0,
        totalXP: progress.totalXPFromJourney || 0,
      } : null,
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
