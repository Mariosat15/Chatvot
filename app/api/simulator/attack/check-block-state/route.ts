/**
 * GET /api/simulator/attack/check-block-state?userId=...&ip=...
 *
 * Reports the current decline-block state for a test user and/or IP by calling
 * the same `isDeclineBlocked` helper the real deposit endpoints use.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
} from "@/lib/services/simulator/attack-tests/guards";
import { isDeclineBlocked } from "@/lib/utils/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const ip = searchParams.get("ip");

  if (userId && !isAttackTestUserId(userId)) {
    return NextResponse.json(
      { success: false, error: "userId must be a sim-attack-* id" },
      { status: 400 },
    );
  }

  let userBlocked = false;
  let userRetryAfterMs: number | undefined;
  let userBlockedUntil: number | undefined;
  if (userId) {
    const state = await isDeclineBlocked(userId);
    userBlocked = state.blocked;
    userRetryAfterMs = state.retryAfterMs;
    userBlockedUntil = state.blockedUntil;
  }

  let ipBlocked = false;
  let ipRetryAfterMs: number | undefined;
  let ipBlockedUntil: number | undefined;
  if (ip) {
    const state = await isDeclineBlocked(`ip:${ip}`);
    ipBlocked = state.blocked;
    ipRetryAfterMs = state.retryAfterMs;
    ipBlockedUntil = state.blockedUntil;
  }

  return NextResponse.json({
    success: true,
    userBlocked,
    retryAfterMs: userRetryAfterMs,
    blockedUntil: userBlockedUntil,
    ipBlocked,
    ipRetryAfterMs,
    ipBlockedUntil,
  });
}
