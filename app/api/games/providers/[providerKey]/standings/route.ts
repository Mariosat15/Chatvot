import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import {
  answerRoundStandings,
  type StandingsResult,
} from "@/lib/services/games/round-standings.service";

/**
 * POST /api/games/providers/:providerKey/standings
 *
 * A game server asking where the players seated in one contest stand on that game's leaderboard,
 * so it can order a race grid (skill-only Volt Velocity, 13 Oct 2026). Read-only.
 *
 * No session, for the same reason as `/events` and `/progress`: a provider is a server. Every
 * gate is cryptographic and lives in the service; this route reads raw bytes and maps the result.
 */
export const dynamic = "force-dynamic";

function statusFor(result: StandingsResult): number {
  switch (result) {
    case "answered":
      return 200;
    case "provider_unknown":
    case "signature_invalid":
    case "timestamp_rejected":
      return 401;
    case "unparseable":
    case "rounds_invalid":
      return 400;
    default:
      return 500;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  try {
    const { providerKey } = await params;
    // Raw bytes first: the signature is over the exact body.
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    await connectToDatabase();
    const outcome = await answerRoundStandings({ providerKey, rawBody, headers });

    return NextResponse.json(
      outcome.accepted
        ? { standings: outcome.standings }
        : { result: outcome.result, message: outcome.message },
      { status: statusFor(outcome.result) },
    );
  } catch (error) {
    console.error("❌ Provider standings request failed unexpectedly:", error);
    return NextResponse.json(
      { message: "Standings could not be answered." },
      { status: 500 },
    );
  }
}
