import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import {
  launchChallengeRound,
  type ChallengeLaunchRefusal,
} from "@/lib/services/games/challenge-round-launch.service";
import {
  getChallengePlayState,
  type ChallengePlayStateRefusal,
} from "@/lib/services/games/challenge-round-status.service";

/**
 * POST /api/challenges/[id]/rounds - start a round in a provider-game challenge.
 *
 * The challenge-side sibling of `app/api/competitions/[id]/rounds/route.ts` - see that
 * file's header for the two properties this shares with it: it is safe to call twice
 * (idempotent on a live round), and the GET beside it must never consume an attempt.
 */

export const dynamic = "force-dynamic";

function statusFor(refusal: ChallengeLaunchRefusal): number {
  switch (refusal) {
    case "not_found":
      return 404;
    case "not_a_participant":
      return 403;
    case "not_provider_challenge":
      return 400;
    case "challenge_not_open":
    case "play_window_not_started":
    case "play_window_closed":
    case "play_window_too_short":
      return 409;
    case "attempts_exhausted":
    case "round_already_live":
      return 409;
    case "title_unavailable":
    case "provider_unavailable":
    case "provider_error":
      return 503;
    case "misconfigured":
      return 503;
    default:
      return 500;
  }
}

/**
 * GET /api/challenges/[id]/rounds - the caller's own play state in this challenge.
 *
 * See the competition route's header for why polling this rather than trusting the
 * provider's iframe message is the only correct way to know whether a round has resolved.
 */
function statusForPlayState(refusal: ChallengePlayStateRefusal): number {
  switch (refusal) {
    case "not_found":
      return 404;
    case "not_a_participant":
      return 403;
    case "not_provider_challenge":
      return 400;
    case "misconfigured":
      return 503;
    default:
      return 500;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: challengeId } = await params;

    // THE USER ID COMES FROM THE SESSION, NEVER FROM THE REQUEST - see the competition
    // route's header for why.
    const outcome = await getChallengePlayState(challengeId, session.user.id);

    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error, refusal: outcome.refusal },
        { status: statusForPlayState(outcome.refusal) },
      );
    }

    return NextResponse.json({ success: true, ...outcome.state });
  } catch (error) {
    console.error("❌ Challenge round state route failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: challengeId } = await params;

    const outcome = await launchChallengeRound(challengeId, {
      userId: session.user.id,
      // Reason: same rule as the competition route - the provider receives a display name
      // and nothing else identifying the player off-platform.
      displayName: session.user.name || undefined,
    });

    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error, refusal: outcome.refusal },
        { status: statusFor(outcome.refusal) },
      );
    }

    return NextResponse.json({
      success: true,
      roundId: outcome.roundId,
      launchUrl: outcome.launchUrl,
      attemptNumber: outcome.attemptNumber,
      resumed: outcome.idempotent,
    });
  } catch (error) {
    console.error("❌ Challenge round launch route failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
