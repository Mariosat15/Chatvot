/**
 * POST /api/simulator/attack/simulate-decline
 *
 * Drives the decline-velocity tracker directly. The same `recordDecline` /
 * `clearDeclines` functions are what the real Nuvei/Stripe/Paddle webhooks
 * call, so proving them here proves them everywhere.
 *
 *   action: "record"  — record N declines, return state after each
 *   action: "clear"   — clear all decline history for the id
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
} from "@/lib/services/simulator/attack-tests/guards";
import { recordDecline, clearDeclines } from "@/lib/utils/rate-limiter";

export const dynamic = "force-dynamic";

interface DeclineBody {
  action?: "record" | "clear";
  userId?: string;
  ip?: string;
  count?: number;
}

export async function POST(req: NextRequest) {
  const guard = guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: DeclineBody;
  try {
    body = (await req.json()) as DeclineBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const action = body.action === "clear" ? "clear" : "record";
  const userId = body.userId;
  const ip = body.ip;

  if (userId && !isAttackTestUserId(userId)) {
    return NextResponse.json(
      { success: false, error: "userId must be a sim-attack-* id" },
      { status: 400 },
    );
  }

  // For IP-scoped tracking we use the same "ip:<addr>" namespace the real
  // webhooks use (see stripe/webhook + nuvei/webhook clearDeclines/recordDecline
  // calls). A plain-looking IP is fine; nothing else shares this keyspace.
  const ipKey = ip ? `ip:${ip}` : null;

  if (action === "clear") {
    if (userId) await clearDeclines(userId);
    if (ipKey) await clearDeclines(ipKey);
    return NextResponse.json({ success: true, action: "clear" });
  }

  const count = Math.min(Math.max(Number(body.count ?? 1), 1), 10);
  const events: Array<{
    attempt: number;
    target: "user" | "ip";
    blocked: boolean;
    declineCount: number;
    blockedUntil?: number;
  }> = [];

  for (let i = 1; i <= count; i++) {
    if (userId) {
      const r = await recordDecline(userId);
      events.push({
        attempt: i,
        target: "user",
        blocked: r.blocked,
        declineCount: r.declineCount,
        blockedUntil: r.blockedUntil,
      });
    }
    if (ipKey) {
      const r = await recordDecline(ipKey);
      events.push({
        attempt: i,
        target: "ip",
        blocked: r.blocked,
        declineCount: r.declineCount,
        blockedUntil: r.blockedUntil,
      });
    }
  }

  return NextResponse.json({ success: true, action: "record", events });
}
