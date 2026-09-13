import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import {
  recordRoundProgress,
  type ProgressResult,
} from "@/lib/services/games/round-progress.service";

/**
 * POST /api/games/providers/:providerKey/progress
 *
 * A round reporting what the player has done SO FAR, while they are still playing.
 *
 * THE SIBLING ROUTE IS `/events` AND THE DIFFERENCE IS THE WHOLE POINT. That one carries a
 * result and goes through `applyResult`, the single ingestion door. This one carries
 * display-only figures and goes through `recordRoundProgress`, which writes `scoreBreakdown`
 * and `progressAt` and can write nothing else - no score, no status, nothing on a participant.
 * Two routes rather than a mode flag on one, because a flag is how the second door opens: a
 * body claiming `final: false` reaching the scoring path is one wrong branch away.
 *
 * NO SESSION, AND THAT IS CORRECT, for the same reason as `/events`: a provider is a server,
 * not a logged-in person. Every gate is cryptographic and none of them passes because
 * configuration is missing - a provider with no stored token is refused by gate 1, and
 * `externalGamesEnabled` defaulting to false refuses before that.
 *
 * THE ROUTE IS DELIBERATELY THIN. It reads the raw bytes, hands them over, and maps the
 * outcome to a status code. It verifies nothing and decides nothing, so there is no second
 * place the verification rules can drift to.
 */

/**
 * Reason for `force-dynamic`: a cached 200 would tell a game its progress was stored while
 * nothing had been written, and the board would sit still with everything reporting success.
 */
export const dynamic = "force-dynamic";

/**
 * THE 2xx/non-2xx SPLIT IS A RETRY INSTRUCTION, NOT A JUDGEMENT - the same rule as `/events`.
 *
 * It lands differently here, and deliberately so. Progress is superseded by the next board and
 * finally by the result, so **almost nothing is worth retrying**: a round that has finished, or
 * a report with nothing renderable in it, both return 200 because sending it again achieves
 * nothing. A round we cannot find is the one exception that keeps its 404, because that is
 * usually a game pointing at the wrong environment and a silent success would hide it for good.
 *
 * A genuine storage failure still returns 500. Not because the figures matter enough to chase,
 * but because a 500 is the only signal that distinguishes "we are broken" from "we heard you",
 * and a game that cannot tell those apart will keep hammering a dead endpoint.
 */
function statusFor(result: ProgressResult): number {
  switch (result) {
    case "recorded":
    // Final, and retrying cannot change either. See above.
    case "round_not_live":
    case "nothing_to_record":
      return 200;
    // Reason unknown providers get 401 rather than 404: a 404 would confirm which provider
    // keys exist, letting anyone enumerate our integrations from outside.
    case "provider_unknown":
    case "signature_invalid":
    case "timestamp_rejected":
      return 401;
    case "round_not_found":
      return 404;
    case "unparseable":
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

    // The RAW BYTES, before anything parses them, and this must be first. A signature is
    // computed over exact bytes; `JSON.parse` followed by re-serialisation does not reproduce
    // them, and calling `.json()` here would consume the body so the raw form could never be
    // recovered afterwards.
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    await connectToDatabase();

    const outcome = await recordRoundProgress({ providerKey, rawBody, headers });

    /*
     * REFUSALS ARE NOT LOGGED, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
     *
     * This endpoint is called once per solved board by every player in a contest, so it is the
     * highest-rate provider route by a wide margin. `/events` logs its refusals because one
     * lost result is one wrong payout; here a refused report costs a stale line on a board,
     * and a log line per refusal turns a misconfigured game into a flood that buries the
     * warnings that do matter.
     *
     * What makes the silence acceptable is that the response says exactly what happened, in
     * the same vocabulary as `/events`, so a provider integrating against this can see every
     * refusal from their own side.
     */
    return NextResponse.json(
      {
        received: outcome.accepted,
        result: outcome.result,
        message: outcome.message,
        roundId: outcome.roundId,
      },
      { status: statusFor(outcome.result) },
    );
  } catch (error) {
    console.error("❌ Provider progress callback failed unexpectedly:", error);
    return NextResponse.json(
      { received: false, message: "Progress could not be processed." },
      { status: 500 },
    );
  }
}
