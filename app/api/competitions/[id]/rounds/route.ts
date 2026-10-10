import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getPublicName } from "@/lib/utils/user-lookup";
import {
  launchContestRound,
  type LaunchRefusal,
} from "@/lib/services/games/round-launch.service";
import {
  getPlayState,
  type PlayStateRefusal,
} from "@/lib/services/games/round-status.service";
import { canViewContestById } from "@/lib/services/gamemaster/private-contest-access.service";
import { getCompetitionById } from "@/lib/actions/trading/competition.actions";

/**
 * Starts (or cancels) a contest whose start time has passed but whose stored status is still
 * `upcoming`, exactly as opening the lobby page does.
 *
 * Reason: the status cron runs once a minute, and the lobby page applies this same backup
 * start on render - so a player who reloaded saw Play while a player who stayed on the page
 * kept reading "Not started yet" until the cron caught up, which is the owner's 2 Oct 2026
 * report ("I must exit the lobby and come back"). Calling the one existing transition here,
 * rather than writing a second, keeps the page and the poll on a single rule.
 */
async function applyBackupStart(competitionId: string): Promise<void> {
  try {
    await getCompetitionById(competitionId);
  } catch (error) {
    console.warn("⚠️ Backup contest start failed; continuing with stored status:", error);
  }
}

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
 * A private contest the caller may not view answers exactly like a missing one. Reason: the
 * `not_a_participant` 403 below would otherwise confirm the contest exists to somebody the Game
 * Master did not invite (R117). A seated player always passes the check (D5).
 */
function privateNotFound() {
  return NextResponse.json(
    { success: false, error: "Competition not found", refusal: "not_found" },
    { status: 404 },
  );
}

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
    // A pause is 409 like the other lifecycle refusals rather than 503: the request conflicts
    // with the contest's current state, which is exactly what 409 means, and nothing about the
    // platform is unavailable. It stays a distinct refusal CODE for the client, though, because
    // the affordance differs - a paused contest resumes, so the UI offers "come back shortly".
    case "contest_paused":
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

/**
 * GET /api/competitions/[id]/rounds - the caller's own play state in this contest.
 *
 * Two jobs, and it is one endpoint because they want exactly the same data. Before playing,
 * the pre-flight panel needs the attempts remaining and any round left in flight. After the
 * provider's iframe reports that it has finished, the client polls this until the round leaves
 * a live status - because **the iframe's message is a UI hint and the real result arrives at
 * the signed callback from the provider's servers.** Asking our own database is the only way
 * to know whether a score actually landed.
 *
 * IT MUST NEVER CONSUME AN ATTEMPT. A GET is retried by browsers, prefetched by Next.js and
 * repeated by pollers; the POST beside it burns an attempt on creation, deliberately, so the
 * two must not be confusable. That is also why the play page renders a button rather than
 * launching on load - see `app/(root)/play/[competitionId]/page.tsx`.
 */
function statusForPlayState(refusal: PlayStateRefusal): number {
  switch (refusal) {
    case "not_found":
      return 404;
    case "not_a_participant":
      return 403;
    case "not_provider_contest":
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

    const { id: competitionId } = await params;

    // THE USER ID COMES FROM THE SESSION, NEVER FROM THE REQUEST. `getPlayState` scopes every
    // query to it, which is what stops this being a way to read another player's score before
    // the leaderboard is published. A query parameter here would be a silent information leak
    // that returns 200 with correct-looking data.
    const userId = session.user.id;
    if (!(await canViewContestById(competitionId, userId))) return privateNotFound();
    await applyBackupStart(competitionId);
    const outcome = await getPlayState(competitionId, userId);

    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error, refusal: outcome.refusal },
        { status: statusForPlayState(outcome.refusal) },
      );
    }

    return NextResponse.json({ success: true, ...outcome.state });
  } catch (error) {
    console.error("❌ Round state route failed:", error);
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

    const { id: competitionId } = await params;

    const userId = session.user.id;
    if (!(await canViewContestById(competitionId, userId))) {
      return privateNotFound();
    }
    await applyBackupStart(competitionId);
    const outcome = await launchContestRound(competitionId, {
      userId,
      // Reason: the provider receives a display name and nothing else. No email, no user
      // id from our side beyond the round's own opaque identifier, and never a wallet -
      // an external provider never touches money and is given no way to identify a
      // person off-platform.
      displayName: await getPublicName(session.user.id),
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
