import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyGameMasterAuth } from "@/lib/admin/auth";
import mongoose from "mongoose";
import { buildReferralLink } from "@/lib/services/gamemaster/referral-link";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * GET /api/gamemaster/link
 * Get the current referral link
 */
export async function GET() {
  try {
    const auth = await verifyGameMasterAuth();
    if (!auth.isAuthenticated || !auth.isGameMaster) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({
        userId: auth.userId,
        status: "active",
      });

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 404 },
      );
    }

    // Reason: the stored referralLink on older subscriptions points at /register,
    // which does not exist. The link is derived from the code on every read so
    // those subscriptions are repaired without a data migration.
    return NextResponse.json({
      referralCode: subscription.referralCode,
      referralLink: buildReferralLink(subscription.referralCode),
    });
  } catch (error) {
    console.error("❌ Error fetching referral link:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

/**
 * POST /api/gamemaster/link
 * Regenerate the referral link (generates new code)
 */
export async function POST() {
  try {
    const auth = await verifyGameMasterAuth();
    if (!auth.isAuthenticated || !auth.isGameMaster) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({
        userId: auth.userId,
        status: "active",
      });

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 404 },
      );
    }

    // Generate new unique referral code
    let newCode: string;
    let isUnique = false;
    while (!isUnique) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      newCode = "GM";
      for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await db.collection("gamemastersubscriptions").findOne({
        referralCode: newCode,
      });
      if (!existing) isUnique = true;
    }

    const newLink = buildReferralLink(newCode!);

    // Update subscription with new code
    await db.collection("gamemastersubscriptions").updateOne(
      { _id: subscription._id },
      {
        $set: {
          referralCode: newCode!,
          referralLink: newLink,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({
      success: true,
      referralCode: newCode!,
      referralLink: newLink,
      message:
        "Referral link regenerated successfully. Your old link will no longer work.",
    });
  } catch (error) {
    console.error("❌ Error regenerating referral link:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
