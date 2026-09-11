/* eslint-disable @typescript-eslint/no-explicit-any */
// Reason for a rule-scoped disable rather than typing the `.lean()` rows: an explicitly-typed
// `.lean<{...}>()` makes the compiler check a hand-written interface instead of the schema, which
// is exactly where the missing `participant.score` read hid for a day (R32/R33) - a field that
// does not exist looks real, and no typecheck objects. The rows are guarded instead by a test
// comparing this route's select string against the dashboard action's, token for token, which is
// the only check that can actually catch the two diverging. Scoped to one rule so nothing else
// in this file goes unchecked. The sibling challenge endpoint carries the same nine warnings.
import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { createDashboardRankResolver } from "@/lib/services/games/dashboard-contest-rank.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/competitions/dashboard-live
 *
 * The live half of the dashboard's competition cards. Returns one row per ACTIVE competition
 * the caller has a seat in, in exactly the shape `ContestsSidebar` renders.
 *
 * WHY THIS EXISTS RATHER THAN REFRESHING THE PAGE. `getComprehensiveDashboardData` cannot be
 * polled: it does upwards of twenty database round trips, unbounded `TradeHistory` and
 * `WalletTransaction` reads, a ten-thousand-row participant fetch, and a global-leaderboard
 * rebuild that takes seconds on a cold cache. The contest lobbies re-read their page on a
 * timer because their page is cheap; this one is not, which is the whole reason the cards
 * were still frozen after the lobbies were fixed.
 *
 * WHY IT MUST AGREE WITH THE ACTION FIELD FOR FIELD, which is the part that is easy to get
 * wrong in a way nobody notices. The player loads the page, sees a figure, and fifteen
 * seconds later sees this endpoint's figure in the same place. Any field where the two
 * disagree LOOKS like the value changed. So:
 *
 *   - the rank is sorted by the SHARED resolver, not by a copy of the comparator;
 *   - `pnl` is the STORED participant value, exactly as the action reads it, and deliberately
 *     not recomputed live from open positions and forex prices. The challenge endpoint next
 *     door does recompute, and it is right to - a 1v1 is two numbers against each other. Here
 *     it would mean the number jumps on first refresh for every trading contest, which is a
 *     defect dressed as an improvement. Making both live is a separate change to BOTH the
 *     action and this route, in one commit;
 *   - an absent score stays absent. `score ?? 0` here would claim a score the player has not
 *     been given, which is the read-side form of R50.
 *
 * It is the competitions counterpart of `/api/challenges/dashboard-live`, which has existed
 * since long before games did. That asymmetry is why this was missed: the sidebar opens on
 * the challenges tab by default, so the polling worked on the path everybody tests.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    await connectToDatabase();

    // Reason: the caller's own seats first, so the competition read is scoped to contests
    // they are actually in. Same 200 limit as the action, so the two cannot disagree about
    // which contests exist for a player with a very long history.
    const myParticipations = await CompetitionParticipant.find({ userId })
      .select(
        "competitionId pnl pnlPercentage currentCapital startingCapital totalTrades winningTrades losingTrades winRate currentOpenPositions currentRank score status",
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    if (myParticipations.length === 0) {
      return NextResponse.json({ competitions: [] });
    }

    const myCompetitionIds = [
      ...new Set(
        (myParticipations as any[])
          .map((p: any) => p.competitionId?.toString())
          .filter(Boolean),
      ),
    ];

    const activeCompetitions = await Competition.find({
      _id: { $in: myCompetitionIds },
      status: "active",
    })
      .select(
        "_id name status startTime endTime prizePool prizePoolCredits currentParticipants startingCapital rules gameType gameKey",
      )
      .lean();

    if (activeCompetitions.length === 0) {
      return NextResponse.json({ competitions: [] });
    }

    const activeIds = (activeCompetitions as any[]).map((c: any) => c._id);

    // Reason: every participant of those contests, because a rank is a position among others
    // and cannot be derived from the caller's own row. Same select and same 10,000 cap as the
    // action's bulk read - including `score`, without which every provider rank is computed
    // from rows that have none.
    const allParticipants = await CompetitionParticipant.find({
      competitionId: { $in: activeIds },
    })
      .select(
        "userId competitionId pnl currentCapital startingCapital currentRank totalTrades winningTrades losingTrades status score",
      )
      .limit(10000)
      .lean();

    const participantsByCompetition = new Map<string, any[]>();
    for (const p of allParticipants as any[]) {
      const compId = p.competitionId?.toString();
      if (!compId) continue;
      if (!participantsByCompetition.has(compId)) {
        participantsByCompetition.set(compId, []);
      }
      participantsByCompetition.get(compId)!.push(p);
    }

    const myByCompetition = new Map<string, any>();
    for (const p of myParticipations as any[]) {
      const compId = p.competitionId?.toString();
      if (compId && !myByCompetition.has(compId)) {
        myByCompetition.set(compId, p);
      }
    }

    // Reason: ONE resolver for the whole request, so the score direction is read once per
    // game key rather than once per contest.
    const { resolveRank } = createDashboardRankResolver();

    const competitions = [];
    for (const competition of activeCompetitions as any[]) {
      const id = competition._id.toString();
      const mine = myByCompetition.get(id);
      if (!mine) continue;

      const participants = participantsByCompetition.get(id) || [];
      const currentRank = await resolveRank({
        competition,
        participants,
        userId,
        fallbackRank: mine.currentRank || 0,
      });

      competitions.push({
        id,
        name: competition.name,
        status: competition.status,
        startTime: competition.startTime,
        endTime: competition.endTime,
        prizePool: competition.prizePool || competition.prizePoolCredits || 0,
        currentRank,
        totalParticipants: competition.currentParticipants || 0,
        gameType: competition.gameType,
        // Reason: NOT `?? 0`. An absent score means no round has reported yet, and the card
        // renders "-" for that rather than claiming the player scored nothing.
        score: mine.score,
        pnl: mine.pnl || 0,
        pnlPercentage: mine.pnlPercentage || 0,
        openPositions: mine.currentOpenPositions || 0,
        rankingMethod: competition.rules?.rankingMethod || "pnl",
        currentCapital: mine.currentCapital || 0,
        startingCapital:
          mine.startingCapital || competition.startingCapital || 10000,
        totalTrades: mine.totalTrades || 0,
        winningTrades: mine.winningTrades || 0,
        losingTrades: mine.losingTrades || 0,
        winRate: mine.winRate || 0,
      });
    }

    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("❌ [Dashboard Live Competitions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live competition data" },
      { status: 500 },
    );
  }
}
