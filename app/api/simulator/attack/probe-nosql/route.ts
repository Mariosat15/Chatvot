/**
 * POST /api/simulator/attack/probe-nosql
 *
 * Gated by the 7-layer attack guard. Probes the NoSQL-injection defense by
 * invoking signInWithEmail with a non-string `email` (an object that would
 * become a Mongo query operator if reached unvalidated, e.g., `{ $gt: "" }`).
 *
 * The test is considered PASSING when signInWithEmail returns
 * `{ success: false }` without signing anyone in. Any other outcome means
 * the type guard is absent or insufficient.
 *
 * We do NOT send real credentials — the payload is always a query-operator
 * object. Even without the guard, Mongo's matching rules would NOT return a
 * valid user password to better-auth in any realistic attack setup, but we
 * explicitly check for the guard rather than relying on downstream behavior.
 */

import { NextRequest, NextResponse } from "next/server";
import { guardAttackRoute } from "@/lib/services/simulator/attack-tests/guards";
import { signInWithEmail } from "@/lib/actions/auth.actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const mode =
    typeof body.mode === "string" ? body.mode : "object-email";

  // Build the crafted payload — all variants are non-string email fields.
  let craftedEmail: unknown;
  let craftedPassword: unknown = "not-a-real-password";

  switch (mode) {
    case "object-email-gt":
      craftedEmail = { $gt: "" };
      break;
    case "object-email-ne":
      craftedEmail = { $ne: null };
      break;
    case "array-email":
      craftedEmail = ["a@test.com", "b@test.com"];
      break;
    case "object-password":
      craftedEmail = "sim-attack-probe@test.simulator";
      craftedPassword = { $gt: "" };
      break;
    default:
      craftedEmail = { $gt: "" };
      break;
  }

  // Capture a pre-call timestamp. After signInWithEmail runs, any
  // `nosql_injection_attempt` alert recorded after this instant is one we
  // just caused — we tag it so cleanup can reliably remove it without
  // deleting real production alerts that happen to be contemporaneous.
  const probeStartedAt = new Date();

  try {
    // Bypass TS to simulate what a crafted Server Action payload could send.
    const result = await signInWithEmail({
      email: craftedEmail as unknown as string,
      password: craftedPassword as unknown as string,
    });

    const rejected =
      result &&
      typeof result === "object" &&
      "success" in result &&
      (result as { success?: boolean }).success === false;

    // Best-effort: tag the alert(s) we just produced so cleanup is idempotent
    // and reliable. We do not await failures — the test result stands
    // regardless. Reason: a simulator probe must never fail the scenario just
    // because a cleanup-marker write hiccuped.
    try {
      const { connectToDatabase } = await import("@/database/mongoose");
      const mongoose = await connectToDatabase();
      const coll = mongoose.connection.db?.collection("securityalerts");
      if (coll) {
        await coll.updateMany(
          {
            alertType: "nosql_injection_attempt",
            source: "signInWithEmail",
            createdAt: { $gte: probeStartedAt },
          },
          { $set: { "metadata.simulator": true } },
        );
      }
    } catch (tagErr) {
      console.warn("probe-nosql: failed to tag simulator alerts:", tagErr);
    }

    return NextResponse.json({
      success: true,
      rejected,
      result,
    });
  } catch (err) {
    // An exception is also a "rejection" in the sense that no session was
    // created. Report it so the scenario can decide.
    return NextResponse.json({
      success: true,
      rejected: true,
      threw: true,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
