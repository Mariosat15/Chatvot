import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { requireSectionAccess } from "@/lib/admin/auth";

/**
 * POST /api/gamemasters/sync-referrals
 * Sync UserReferral collection data to user documents
 * Ensures all users with a UserReferral record have the referredByGameMasterId field set
 *
 * Both handlers were UNAUTHENTICATED until 7 September 2026, while all four of their
 * siblings under `/api/gamemasters` required section access. Found by counting exported
 * handlers against guards rather than by reading the routes - which is the only way this
 * one surfaces, because every neighbour having a guard is exactly what makes reading
 * through them go straight past the file that has none.
 *
 * What that exposed, stated precisely in both directions. The POST takes no body, so the
 * mapping comes from `userreferrals` and a caller could NOT redirect commission to
 * themselves. What they could do is apply a pending attribution change an operator had
 * deliberately not applied, and run an unbounded findOne+updateOne loop over every active
 * referral on demand. The GET returned up to ten real user ids and names to anybody who
 * asked. There is no way to know whether either was ever called: a route with no guard
 * writes no attribution.
 */
export async function POST() {
  try {
    await requireSectionAccess("gamemaster-management");

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 },
      );
    }

    console.log("🔄 Starting referral data sync...");

    // Get all active UserReferral records
    const userReferrals = await db
      .collection("userreferrals")
      .find({
        isActive: true,
        gameMasterId: { $exists: true, $ne: null },
      })
      .toArray();

    console.log(`   Found ${userReferrals.length} active referral records`);

    let synced = 0;
    let alreadyCorrect = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const referral of userReferrals) {
      try {
        // Check if user already has correct referredByGameMasterId
        const user = await db
          .collection("user")
          .findOne({ id: referral.userId });

        if (!user) {
          console.warn(`   ⚠️ User ${referral.userId} not found`);
          errors++;
          errorDetails.push(`User ${referral.userId} not found`);
          continue;
        }

        if (user.referredByGameMasterId === referral.gameMasterId) {
          alreadyCorrect++;
          continue;
        }

        // Update user with referral data
        const updateResult = await db.collection("user").updateOne(
          { id: referral.userId },
          {
            $set: {
              referredByGameMasterId: referral.gameMasterId,
              referredByReferralCode: referral.referralCode,
              referredAt: referral.referredAt || new Date(),
            },
          },
        );

        if (updateResult.modifiedCount > 0) {
          console.log(
            `   ✅ Synced user ${referral.userId} -> GM ${referral.gameMasterId}`,
          );
          synced++;
        } else {
          console.warn(`   ⚠️ Failed to sync user ${referral.userId}`);
          errors++;
          errorDetails.push(`Failed to update user ${referral.userId}`);
        }
      } catch (err) {
        console.error(`   ❌ Error syncing user ${referral.userId}:`, err);
        errors++;
        errorDetails.push(
          `Error with user ${referral.userId}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    console.log("🔄 Referral sync complete:");
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ✓ Already correct: ${alreadyCorrect}`);
    console.log(`   ⚠️ Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      data: {
        totalReferrals: userReferrals.length,
        synced,
        alreadyCorrect,
        errors,
        errorDetails:
          errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    console.error("Error syncing referrals:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/gamemasters/sync-referrals
 * Check sync status - how many users need syncing
 */
export async function GET() {
  try {
    await requireSectionAccess("gamemaster-management");

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get all active UserReferral records
    const userReferrals = await db
      .collection("userreferrals")
      .find({
        isActive: true,
        gameMasterId: { $exists: true, $ne: null },
      })
      .toArray();

    // Check each user to see if their referredByGameMasterId matches
    let needsSync = 0;
    let synced = 0;
    let missing = 0;
    const needsSyncUsers: Array<{
      userId: string;
      userName: string;
      gmId: string;
    }> = [];

    for (const referral of userReferrals) {
      const user = await db.collection("user").findOne({ id: referral.userId });

      if (!user) {
        missing++;
        continue;
      }

      if (user.referredByGameMasterId === referral.gameMasterId) {
        synced++;
      } else {
        needsSync++;
        if (needsSyncUsers.length < 10) {
          needsSyncUsers.push({
            userId: referral.userId,
            userName: referral.userName || "Unknown",
            gmId: referral.gameMasterId,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalReferrals: userReferrals.length,
        synced,
        needsSync,
        missingUsers: missing,
        sampleNeedsSync: needsSyncUsers,
      },
    });
  } catch (error) {
    console.error("Error checking sync status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
