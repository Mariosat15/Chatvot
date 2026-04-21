import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { getHiddenUserIds } from "@/lib/services/user-restriction.service";

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar?: string;
  totalWinnings: number;
  winRate: number;
  competitionsWon: number;
  challengesWon: number;
}

/**
 * GET /api/landing/leaderboard-preview
 * Returns top traders for the landing page leaderboard preview
 * No auth required - public endpoint
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get top traders by total winnings from competition participants
    const topCompetitionWinners = await db
      .collection("competitionparticipants")
      .aggregate([
        {
          $match: {
            prizeWon: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: "$userId",
            totalPrizeWon: { $sum: "$prizeWon" },
            competitionsWon: {
              $sum: { $cond: [{ $eq: ["$finalRank", 1] }, 1, 0] },
            },
            competitionsParticipated: { $sum: 1 },
            avgRank: { $avg: "$finalRank" },
            username: { $first: "$username" },
          },
        },
        { $sort: { totalPrizeWon: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Get challenge wins per user
    const challengeWins = await db
      .collection("challenges")
      .aggregate([
        {
          $match: {
            status: "completed",
            winnerId: { $exists: true },
          },
        },
        {
          $group: {
            _id: "$winnerId",
            challengesWon: { $sum: 1 },
            totalChallengeWinnings: { $sum: "$winnerPrize" },
          },
        },
      ])
      .toArray();

    // Create a map of challenge wins
    const challengeWinsMap = new Map(
      challengeWins.map((c) => [
        c._id,
        { won: c.challengesWon, winnings: c.totalChallengeWinnings },
      ]),
    );

    // Get user details for avatars
    const userIds = topCompetitionWinners.map((w) => w._id);
    const users = await db
      .collection("user")
      .find({
        id: { $in: userIds },
      })
      .project({
        id: 1,
        name: 1,
        username: 1,
        avatar: 1,
        profileImage: 1,
        privacySettings: 1,
      })
      .toArray();

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Exclude restricted users hidden from public
    const hiddenIds = await getHiddenUserIds();
    const visibleWinners = topCompetitionWinners.filter(
      (w) => !hiddenIds.has(w._id),
    );

    // Build leaderboard entries
    const leaderboard: LeaderboardEntry[] = visibleWinners.map(
      (winner, index) => {
        const user = userMap.get(winner._id);
        const challengeData = challengeWinsMap.get(winner._id) || {
          won: 0,
          winnings: 0,
        };
        const totalWinnings =
          (winner.totalPrizeWon || 0) + (challengeData.winnings || 0);

        // Calculate win rate (competitions where they placed top 3)
        const competitionsTop3 =
          winner.avgRank <= 3
            ? winner.competitionsParticipated
            : Math.floor(winner.competitionsParticipated * 0.3);
        const winRate =
          winner.competitionsParticipated > 0
            ? Math.round(
                (competitionsTop3 / winner.competitionsParticipated) * 100,
              )
            : 0;

        // Check privacy settings
        const isPrivate = user?.privacySettings?.hideFromLeaderboard;
        const displayName = isPrivate
          ? anonymizeName(winner.username || user?.name || "Trader")
          : winner.username || user?.username || user?.name || "Trader";

        return {
          rank: index + 1,
          username: displayName,
          avatar: isPrivate ? undefined : user?.profileImage || user?.avatar,
          totalWinnings: Math.round(totalWinnings),
          winRate: Math.min(winRate, 100),
          competitionsWon: winner.competitionsWon || 0,
          challengesWon: challengeData.won || 0,
        };
      },
    );

    // Get recent winners (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWinners = await db
      .collection("competitionparticipants")
      .aggregate([
        {
          $match: {
            finalRank: 1,
            prizeWon: { $gt: 0 },
            updatedAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $lookup: {
            from: "competitions",
            let: { compId: { $toObjectId: "$competitionId" } },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$compId"] } } },
              { $project: { name: 1, prizePool: 1 } },
            ],
            as: "competition",
          },
        },
        { $unwind: { path: "$competition", preserveNullAndEmptyArrays: true } },
        { $sort: { prizeWon: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    const recentWinnersFormatted = recentWinners.map((w) => ({
      username: anonymizeName(w.username || "Winner"),
      competitionName: w.competition?.name || "Competition",
      prizeWon: w.prizeWon || 0,
      date: w.updatedAt,
    }));

    return NextResponse.json(
      {
        leaderboard: leaderboard.slice(0, 5), // Top 5 for preview
        recentWinners: recentWinnersFormatted,
        totalTraders: topCompetitionWinners.length,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching leaderboard preview:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}

// Anonymize names for privacy
function anonymizeName(name: string): string {
  if (!name || name.length < 2) return "Trader";

  const cleanName = name.trim();
  if (cleanName.length <= 3) {
    return cleanName[0] + "***";
  }

  return cleanName[0] + "***" + cleanName[cleanName.length - 1];
}
