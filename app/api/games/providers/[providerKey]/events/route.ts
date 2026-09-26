import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import {
  ingestProviderCallback,
  type IngestOutcome,
} from "@/lib/services/games/result-ingestion.service";

/**
 * POST /api/games/providers/:providerKey/events
 *
 * The signed result callback (X3, chapter 01 section 2.2 and chapter 06 section 2).
 *
 * NO SESSION, AND THAT IS CORRECT
 * -------------------------------
 * A provider is a server, not a logged-in person, so there is no session to check. It
 * authenticates with a bearer token and an HMAC over the raw body, both verified inside
 * `ingestProviderCallback`. Reason this is worth spelling out: an unauthenticated route is
 * exactly the shape of Prerequisite A, where `/api/simulator/*` trusted a plain header and
 * an anonymous caller could credit any wallet. The difference is that every gate here is
 * cryptographic and none of them can pass because configuration is missing - a provider
 * with no stored secret fails gate 3, and `externalGamesEnabled` defaulting to false fails
 * gate 2 before that.
 *
 * THE ROUTE IS DELIBERATELY THIN
 * ------------------------------
 * It reads the raw bytes, hands them to the one ingestion function, and maps the outcome to
 * a status code. It does not verify, score, or decide anything. Reason: chapter 02 section
 * 10 rule 3 says scores enter through exactly one function, and a route that did any part
 * of the work itself would be a second door - which is how Stage 0's competition entry
 * ended up with four writers that the plan described as two.
 */

/**
 * Reason for `force-dynamic`: this route must never be prerendered or cached. A cached 200
 * would tell a provider its retry succeeded while nothing was stored.
 */
export const dynamic = "force-dynamic";

/**
 * Maps an ingestion outcome to a status code.
 *
 * THE 2xx/non-2xx SPLIT IS A RETRY INSTRUCTION, NOT A JUDGEMENT
 * ------------------------------------------------------------
 * Chapter 01 section 2.2 says a provider backs off for AT LEAST 24 HOURS after any non-2xx.
 * So the question each outcome answers is not "was this good" but "would sending it again
 * help". That is why a duplicate and a late result both return 200: they are unwelcome but
 * final, and inviting a retry a day later achieves nothing except a second alert.
 *
 * The inverse matters more. A genuine storage failure returns 500 specifically BECAUSE we
 * want the retry - that is a real score we failed to keep, and the provider's retry is the
 * cheapest way to recover it.
 */
function statusFor(outcome: IngestOutcome): number {
  switch (outcome.result) {
    case "scored":
    case "duplicate_ignored":
    case "late_recorded_not_applied":
      return 200;
    // Already reported, identically. Final, so no retry.
    case "round_not_acceptable":
      return outcome.accepted ? 200 : 409;
    case "conflict_flagged":
      return 409;
    // Reason unknown providers get 401 rather than 404: a 404 would confirm which provider
    // keys exist, letting anyone enumerate our integrations from outside.
    case "provider_unknown":
    case "signature_invalid":
    case "timestamp_rejected":
      return 401;
    case "round_not_found":
      return 404;
    case "score_out_of_range":
      return 422;
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

    // ── THE RAW BYTES, BEFORE ANYTHING PARSES THEM ────────────────────────────────────
    //
    // This must be `.text()` and it must be first. A signature is computed over exact
    // bytes, and `JSON.parse` followed by re-serialisation does not reproduce them - key
    // order, whitespace and number formatting all shift. Calling `.json()` here would also
    // consume the body, so the raw form could never be recovered afterwards.
    const rawBody = await request.text();

    // Reason for `fromEntries` over a forEach that assigns into an object: assigning by a
    // variable key trips security/detect-object-injection, and the pre-commit hook allows
    // no warnings. `Headers` already lower-cases its keys, so nothing is lost.
    const headers = Object.fromEntries(request.headers.entries());

    await connectToDatabase();

    const outcome = await ingestProviderCallback({
      providerKey,
      rawBody,
      headers,
    });

    if (outcome.alert === "critical") {
      console.error(
        `❌ [Provider callback] ${providerKey} - ${outcome.result}: ${outcome.message}`,
        { eventId: outcome.eventId, roundId: outcome.roundId },
      );
    } else if (outcome.alert === "warning") {
      console.warn(
        `⚠️ [Provider callback] ${providerKey} - ${outcome.result}: ${outcome.message}`,
        { eventId: outcome.eventId },
      );
    }

    // Chapter 01 section 2.2's success shape. Returned as soon as the event is stored and
    // applied - never after badges, leaderboards or notifications, because a provider's
    // delivery timeout must not depend on how much downstream work a score triggers.
    return NextResponse.json(
      {
        received: outcome.accepted,
        eventId: outcome.eventId,
        result: outcome.result,
        message: outcome.message,
      },
      { status: statusFor(outcome) },
    );
  } catch (error) {
    // Reason for 500 rather than a quiet 200: an unexpected throw here means we may have
    // lost a real score, and 500 is what makes the provider try again.
    console.error("❌ Provider callback failed unexpectedly:", error);
    return NextResponse.json(
      { received: false, message: "Event could not be processed." },
      { status: 500 },
    );
  }
}
