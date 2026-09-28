import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import {
  launchPracticeRound,
  listPracticeRounds,
  type PracticeRefusal,
} from "@/lib/services/games/practice-round.service";

/**
 * /api/games/[slug]/practice/rounds - the practice area for any game.
 *
 * GET reads the caller's own recent practice rounds and NEVER creates one - a prefetch or a
 * poll must not open a round at the provider. POST starts (or reopens) a practice round.
 * The user id always comes from the session, never from the request.
 */

export const dynamic = "force-dynamic";

function statusFor(refusal: PracticeRefusal): number {
  switch (refusal) {
    case "not_found":
      return 404;
    case "practice_unsupported":
      return 400;
    case "round_already_live":
    case "attempts_exhausted":
    case "play_window_closed":
    case "play_window_too_short":
      return 409;
    case "title_unavailable":
    case "provider_unavailable":
    case "provider_error":
    case "misconfigured":
      return 503;
    default:
      return 500;
  }
}

const unauthorized = () =>
  NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return unauthorized();

    const { slug } = await params;
    const rounds = await listPracticeRounds(slug, session.user.id);
    if (!rounds) {
      return NextResponse.json({ success: false, error: "Game not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, rounds });
  } catch (error) {
    console.error("❌ Practice round state route failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return unauthorized();

    const { slug } = await params;
    const outcome = await launchPracticeRound(slug, {
      userId: session.user.id,
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
      resumed: outcome.resumed,
    });
  } catch (error) {
    console.error("❌ Practice round launch route failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
