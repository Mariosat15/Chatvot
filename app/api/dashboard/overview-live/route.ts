import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import UserGameStats from "@/database/models/games/user-game-stats.model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lightweight Overview KPI poll — wallet credits/prizes + stored contest win rate.
 *
 * Deliberately NOT `getComprehensiveDashboardData`. Contest cards use the existing
 * dashboard-live endpoints; Compete online uses `/api/user/presence?userIds=`.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    await connectToDatabase();

    const [wallet, overallStats] = await Promise.all([
      CreditWallet.findOne({ userId })
        .select(
          "creditBalance totalWonFromCompetitions totalWonFromChallenges",
        )
        .lean(),
      UserGameStats.findOne({ userId, gameKey: "_overall" })
        .select("contestsCompleted wins")
        .lean(),
    ]);

    const creditBalance =
      typeof wallet?.creditBalance === "number" ? wallet.creditBalance : 0;
    const totalPrizesWon =
      (wallet?.totalWonFromCompetitions || 0) +
      (wallet?.totalWonFromChallenges || 0);

    const contestsCompleted = overallStats?.contestsCompleted ?? 0;
    const wins = overallStats?.wins ?? 0;
    const contestWinRate =
      contestsCompleted > 0
        ? Math.round((wins / contestsCompleted) * 1000) / 10
        : null;

    return NextResponse.json(
      {
        creditBalance,
        totalPrizesWon,
        contestWinRate,
        serverNow: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching overview live stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview stats" },
      { status: 500 },
    );
  }
}
