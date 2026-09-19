/**
 * POST /api/simulator/attack/simulate-login
 *
 * Gated by the 7-layer attack guard. Exercises the real login-defense layer
 * (validateLogin + recordFailedLogin) without going through better-auth,
 * which would require a real password to verify.
 *
 * We test the ATO brute-force defense specifically: we invoke recordFailedLogin
 * N times for a sim-attack-* email and then probe validateLogin to confirm
 * the lockout triggered as expected.
 *
 * Actions:
 *   - "record-failures" → calls recordFailedLogin count times. Returns the
 *     per-attempt lockout state.
 *   - "probe"           → calls validateLogin once. Returns whether the email
 *     is currently allowed to log in.
 *   - "clear"           → best-effort cleanup of AccountLockout + fraud alert
 *     records created during the scenario.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  ATTACK_USER_PREFIX,
} from "@/lib/services/simulator/attack-tests/guards";
import {
  validateLogin,
  recordFailedLogin,
} from "@/lib/services/registration-security.service";
import { connectToDatabase } from "@/database/mongoose";

export const dynamic = "force-dynamic";

function isAttackTestEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  if (email.length > 200) return false;
  // Only allow sim-attack-*@* emails so real users can never be targeted here.
  return email.startsWith(ATTACK_USER_PREFIX);
}

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

  const action = typeof body.action === "string" ? body.action : "";
  const email = body.email;
  const ip = typeof body.ip === "string" ? body.ip : "127.0.0.1";

  if (!isAttackTestEmail(email)) {
    return NextResponse.json(
      { success: false, error: "email must be sim-attack-*" },
      { status: 400 },
    );
  }

  if (action === "record-failures") {
    const count = Math.min(
      Math.max(1, typeof body.count === "number" ? body.count : 1),
      20,
    );

    const events: Array<{
      attempt: number;
      locked: boolean;
      remainingAttempts: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      try {
        const res = await recordFailedLogin({ email, ip });
        events.push({
          attempt: i + 1,
          locked: !!res.locked,
          remainingAttempts: res.remainingAttempts,
        });
      } catch (err) {
        console.error("simulate-login record-failures error:", err);
        events.push({
          attempt: i + 1,
          locked: false,
          remainingAttempts: -1,
        });
      }
    }

    return NextResponse.json({ success: true, events });
  }

  if (action === "probe") {
    try {
      const res = await validateLogin({ email, ip });
      return NextResponse.json({
        success: true,
        allowed: res.allowed,
        code: res.code,
        reason: res.reason,
        lockoutUntil: res.lockoutUntil,
      });
    } catch (err) {
      console.error("simulate-login probe error:", err);
      return NextResponse.json(
        { success: false, error: "probe failed" },
        { status: 500 },
      );
    }
  }

  if (action === "clear") {
    try {
      const mongoose = await connectToDatabase();
      const db = mongoose.connection.db;
      if (db) {
        // Clear active lockouts for this sim-attack email.
        await db.collection("accountlockouts").deleteMany({ email });
        // Clear any fraud alerts referencing this test email.
        await db.collection("fraudalerts").deleteMany({
          alertType: "brute_force",
          primaryUserId: email,
        });
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("simulate-login clear error:", err);
      return NextResponse.json(
        { success: false, error: "clear failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 },
  );
}
