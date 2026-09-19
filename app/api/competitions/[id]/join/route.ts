import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import {
  isSimulatorRequest,
  getSimulatorUserId,
} from "@/lib/services/simulator/simulator-mode";
import {
  enterContest,
  type ContestEntryActor,
  type ContestEntryFailureCode,
} from "@/lib/services/contest-entry.service";

/**
 * POST /api/competitions/[id]/join
 *
 * Stage 0, Defect 1: this route used to be a second, independent implementation of
 * competition entry. It skipped email verification, the restriction check, the fraud gate
 * and the level requirement, and - the money defect - it took the entry fee without adding
 * it to `prizePool`, so a competition entered here under-paid its winners at finalization.
 *
 * All of that now comes from `lib/services/contest-entry.service.ts`, which both this route
 * and the `enterCompetition` server action call. What is left here is transport: work out
 * who is asking, then translate the service's result into an HTTP status.
 */

/**
 * Reason: the service decides *why* an entry was refused; only the transport knows what a
 * status code means. Keeping the mapping in one table stops the two drifting, and makes the
 * one genuinely important distinction explicit - `contended` is 409 (retry this) rather than
 * 500 (the server is broken), because a lost write race is not a server fault and a 500
 * tells browsers and load balancers otherwise.
 */
const STATUS_BY_CODE: Record<ContestEntryFailureCode, number> = {
  invalid_id: 400,
  email_unverified: 403,
  restricted: 403,
  fraud_blocked: 403,
  not_found: 404,
  not_open: 400,
  registration_closed: 400,
  full: 400,
  level_requirement: 403,
  no_wallet: 400,
  insufficient_balance: 400,
  contended: 409,
  failed: 500,
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: competitionId } = await context.params;

    // Reason: this branch acts as whichever user id the caller names and debits that user's
    // wallet. It once accepted the X-Simulator-User-Id header on its own, which let an
    // unauthenticated caller enter a competition as anybody. It now requires the internal
    // secret, and `isSimulatorRequest` fails closed when that secret is missing or weak.
    const allowSimulatorMode = isSimulatorRequest(request);

    let actor: ContestEntryActor;

    if (allowSimulatorMode) {
      let bodyUserId: string | undefined;
      try {
        const body = await request.json();
        bodyUserId = body?.userId;
      } catch {
        // No body, or not JSON. The header is the other way in.
      }

      const simulatorUserId = getSimulatorUserId(request) || bodyUserId;
      if (!simulatorUserId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "userId required in simulator mode (X-Simulator-User-Id header or body.userId)",
          },
          { status: 400 },
        );
      }

      const suffix = simulatorUserId.slice(-6);
      actor = {
        userId: simulatorUserId,
        email: `simuser_${suffix}@test.simulator`,
        username: `SimUser_${suffix}`,
        emailVerified: true,
        // Reason: skips the person-level gates only - email verification, restrictions and
        // fraud - which synthetic users cannot satisfy. Every contest and money guard,
        // including the prize-pool increment, still applies.
        trusted: true,
      };
    } else {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }

      const requestHeaders = await headers();
      actor = {
        userId: session.user.id,
        email: session.user.email || "",
        username: session.user.name || session.user.email || "Unknown",
        emailVerified:
          (session.user as { emailVerified?: boolean }).emailVerified === true,
        ip:
          requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          requestHeaders.get("x-real-ip") ||
          requestHeaders.get("cf-connecting-ip") ||
          undefined,
      };
    }

    const result = await enterContest(competitionId, actor);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: STATUS_BY_CODE[result.code] ?? 500 },
      );
    }

    return NextResponse.json({
      success: true,
      participantId: result.participantId,
      alreadyEntered: result.alreadyEntered,
      ...(result.alreadyEntered ? { message: "Already joined" } : {}),
      competition: result.competition,
    });
  } catch (error) {
    console.error("Competition join error:", error);
    // Reason: the message is deliberately generic. The previous version returned
    // `error.message` verbatim, which handed the storage engine's own wording to an
    // unauthenticated caller. Detail belongs in the log.
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
