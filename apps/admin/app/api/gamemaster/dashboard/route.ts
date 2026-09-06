import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyGameMasterAuth } from "@/lib/admin/auth";
import mongoose from "mongoose";

/**
 * GET /api/gamemaster/dashboard
 * Get game master dashboard stats
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

    // Get subscription details
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

    // Get referred users with details (all, not just 10)
    const referredUsers = await db
      .collection("user")
      .find({
        referredByGameMasterId: auth.userId,
      })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        createdAt: 1,
        image: 1,
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Get total referred users count
    const totalReferredUsers = await db.collection("user").countDocuments({
      referredByGameMasterId: auth.userId,
    });

    // Get all competitions created by this game master (up to 50)
    const competitions = await db
      .collection("competitions")
      .find({
        gameMasterId: auth.userId,
      })
      .project({
        _id: 1,
        name: 1,
        status: 1,
        currentParticipants: 1,
        maxParticipants: 1,
        prizePool: 1,
        entryFee: 1,
        startTime: 1,
        endTime: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get total competitions created
    const totalCompetitions = await db
      .collection("competitions")
      .countDocuments({
        gameMasterId: auth.userId,
      });

    // Get active competitions count
    const activeCompetitions = await db
      .collection("competitions")
      .countDocuments({
        gameMasterId: auth.userId,
        status: "active",
      });

    // Get earnings summary
    const earningsAgg = await db
      .collection("gamemasterearnings")
      .aggregate([
        { $match: { gameMasterId: auth.userId } },
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
      ])
      .toArray();

    const earnings = earningsAgg[0] || {
      totalEarnings: 0,
      paidEarnings: 0,
      pendingEarnings: 0,
      totalTransactions: 0,
    };

    // Get all earnings (up to 100)
    const recentEarnings = await db
      .collection("gamemasterearnings")
      .find({
        gameMasterId: auth.userId,
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Get completed competitions count
    const completedCompetitions = await db
      .collection("competitions")
      .countDocuments({
        gameMasterId: auth.userId,
        status: "completed",
      });

    // Calculate days remaining
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(subscription.endDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    return NextResponse.json({
      subscription: {
        id: subscription._id.toString(),
        packageName: subscription.packageName,
        status: subscription.status,
        referralCode: subscription.referralCode,
        referralLink: subscription.referralLink,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextRenewalDate: subscription.nextRenewalDate,
        autoRenew: subscription.autoRenew,
        renewalPrice: subscription.renewalPrice,
        daysRemaining,
        limits: subscription.limits,
        currentPeriodCompetitionsCreated:
          subscription.currentPeriodCompetitionsCreated,
      },
      stats: {
        totalReferredUsers,
        totalCompetitions,
        activeCompetitions,
        completedCompetitions,
        ...earnings,
      },
      recentReferrals: referredUsers.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        image: u.image,
      })),
      recentCompetitions: competitions.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        status: c.status,
        participants: c.currentParticipants,
        maxParticipants: c.maxParticipants,
        prizePool: c.prizePool,
        entryFee: c.entryFee,
        startTime: c.startTime,
        endTime: c.endTime,
        createdAt: c.createdAt,
      })),
      recentEarnings: recentEarnings.map((e) => ({
        id: e._id.toString(),
        sourceType: e.sourceType,
        sourceName: e.sourceName,
        referredUserName: e.referredUserName,
        entryFeeAmount: e.entryFeeAmount,
        netEarning: e.netEarning,
        status: e.status,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching game master dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
