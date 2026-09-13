import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { getArenaStandings } from "@/lib/services/games/arena-standings.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/competitions/[id]/standings
 *
 * The arena's standings rail, so it can be refreshed without re-rendering the page.
 *
 * WHY A ROUTE AND NOT A PAGE RE-READ, which is the important part of this file. The contest
 * lobbies re-read their own page on a timer, and that is the right answer there. It is
 * forbidden here: this page hosts a live round inside an iframe, and a refresh underneath a
 * player who has PAID for their attempt can disturb it - intermittently, unreproducibly, and
 * with real money already taken. A test forbids mounting `LiveContestRefresher` on the play
 * screen for exactly that reason, so the arena needs a read it can make without touching the
 * frame's subtree.
 *
 * IT COMPOSES NOTHING OF ITS OWN. `getArenaStandings` is the single producer, shared with the
 * page, so a player cannot be shown one shape on load and a different one fifteen seconds
 * later. See that service's header for why agreement with the first render is the property
 * being engineered for rather than liveness.
 *
 * A SESSION IS REQUIRED THOUGH A SEAT IS NOT. The standings are already public on the lobby,
 * so a seat check here would buy nothing; a session check keeps an anonymous caller from
 * driving two indexed reads per request against any contest id they can guess.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Refused before the session read, so a crawler following a bad in-app link is answered
    // with a 404 rather than being bounced through authentication for a contest that cannot
    // exist. One log line names the route and the value, deliberately: a silent guard makes a
    // link built from an `undefined` indistinguishable from a bot.
    if (!isCompetitionIdShaped(id)) {
      logMalformedCompetitionId("GET /api/competitions/[id]/standings", id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const standings = await getArenaStandings(id, session.user.id);

    return NextResponse.json(standings);
  } catch (error) {
    console.error("❌ [Arena Standings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch standings" },
      { status: 500 },
    );
  }
}
