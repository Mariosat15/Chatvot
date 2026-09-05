import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import ProviderEvent from "@/database/models/games/provider-event.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * GET /api/games/rounds/[roundId] - one round, with everything needed to judge it.
 *
 * WHY THE RAW EVENTS ARE THE POINT OF THIS SCREEN. When a round is stuck, the question is
 * almost never "what does our database say" - it is "did the provider ever tell us anything,
 * and if so what was wrong with it". `provider_event` stores every callback before any
 * validation runs, precisely so a rejected one leaves evidence, and `processingResult` says
 * which of the eleven gates refused it. Without that an operator can only guess between "the
 * provider never called", "the signature was wrong" and "the score was out of range" - three
 * problems with three different owners.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const guard = await guardSection("round-inspector");
  if (!guard.ok) return guard.response;

  try {
    const { roundId } = await params;
    await connectToDatabase();

    const round = await GameRound.findOne({ roundId }).lean<{
      contestId?: unknown;
      userId?: string;
      status?: string;
    } | null>();

    if (!round) {
      return NextResponse.json({ error: "No round with that id." }, { status: 404 });
    }

    // Every delivery attempt for this round, newest first, rejected ones included - a rejected
    // event is the most informative row on the screen.
    const events = await ProviderEvent.find({ roundId })
      .sort({ receivedAt: -1 })
      .limit(50)
      .lean();

    const contest = round.contestId
      ? await Competition.findById(round.contestId)
          .select(
            "name status gameKey unresolvedRoundPolicy attemptsPolicy playWindowEnd resultGracePeriodSeconds prizePool",
          )
          .lean()
      : null;

    // The participant's stored score, so an operator can see what this round did or did not
    // contribute. Read separately rather than joined because a practice round has no seat.
    const participant =
      round.contestId && round.userId
        ? await CompetitionParticipant.findOne({
            competitionId: String(round.contestId),
            userId: round.userId,
          })
            .select("score status username")
            .lean()
        : null;

    // How many rounds still hold this contest, so the screen can say whether resolving this
    // one would actually release it.
    const stillUnresolved = round.contestId
      ? await GameRound.countDocuments({
          contestId: round.contestId,
          status: "unresolved",
        })
      : 0;

    return NextResponse.json({
      success: true,
      round,
      events,
      contest,
      participant,
      stillUnresolved,
    });
  } catch (error) {
    console.error("❌ Failed to load round detail:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
