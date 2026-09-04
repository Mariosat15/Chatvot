import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import {
  launchContestRound,
  type LaunchRefusal,
} from "@/lib/services/games/round-launch.service";

/**
 * POST /api/competitions/[id]/rounds - start a round in a provider-game competition.
 *
 * The player presses Play, we ask the provider to open a round for them, and they are sent
 * to the provider's `launchUrl`. The result comes back separately, to the signed callback
 * at `/api/games/providers/[providerKey]/events`.
 *
 * IT IS SAFE TO CALL TWICE. `createRound` is idempotent on a live round, so a double-click
 * or a retried request returns the SAME round rather than burning a second attempt - which
 * matters because an attempt is consumed on creation, deliberately, or a player could
 * abandon a bad round and retry for free forever.
 */

export const dynamic = "force-dynamic";

/**
 * HTTP status per refusal.
 *
 * The distinctions are the point. A player who has used every attempt (409) has not made a
 * bad request (400) and is not unauthorised (403) - and a client that cannot tell the
 * difference ends up showing "something went wrong" for the one case that is completely
 * normal and expected.
 */
function statusFor(refusal: LaunchRefusal): number {
  switch (refusal) {
    case "not_found":
      return 404;
    case "not_a_participant":
      return 403;
    case "not_provider_contest":
      return 400;
    case "contest_not_open":
    case "play_window_not_started":
    case "play_window_closed":
    case "play_window_too_short":
      return 409;
    case "attempts_exhausted":
    case "round_already_live":
      return 409;
    // A provider being down or a title paused is not the player's fault and is expected to
    // pass, so it must be retryable rather than looking like a permanent rejection.
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

    const { id: competitionId } = await params;

    const outcome = await launchContestRound(competitionId, {
      userId: session.user.id,
      // Reason: the provider receives a display name and nothing else. No email, no user
      // id from our side beyond the round's own opaque identifier, and never a wallet -
      // an external provider never touches money and is given no way to identify a
      // person off-platform.
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
      // Told to the client so a double-click can be distinguished from a fresh round -
      // the UI should not announce "attempt 2 started" when it resumed attempt 1.
      resumed: outcome.idempotent,
    });
  } catch (error) {
    console.error("❌ Round launch route failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
