/**
 * POST /api/simulator/attack/deposit-flood
 *
 * Probes the same rate-limiter functions the real deposit endpoints call:
 *   - mode="user" → RateLimiters.deposit(userId)   (5/min)
 *   - mode="ip"   → RateLimiters.depositByIp(ip)   (10/min)
 *
 * Returns the result of every attempt so the scenario can assert the exact
 * request number where the limiter kicks in.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  guardAttackRoute,
  isAttackTestUserId,
} from "@/lib/services/simulator/attack-tests/guards";
import { RateLimiters } from "@/lib/utils/rate-limiter";

export const dynamic = "force-dynamic";

interface FloodBody {
  mode?: "user" | "ip";
  userId?: string;
  ipAddress?: string;
  count?: number;
}

export async function POST(req: NextRequest) {
  const guard = await guardAttackRoute(req);
  if ("response" in guard) return guard.response;

  let body: FloodBody;
  try {
    body = (await req.json()) as FloodBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const mode = body.mode === "ip" ? "ip" : "user";
  const count = Math.min(Math.max(Number(body.count ?? 20), 1), 100);

  if (mode === "user") {
    const userId = body.userId;
    if (!userId || !isAttackTestUserId(userId)) {
      return NextResponse.json(
        { success: false, error: "userId must be a sim-attack-* id" },
        { status: 400 },
      );
    }

    const results: Array<{
      index: number;
      allowed: boolean;
      remaining: number;
      retryAfterMs?: number;
    }> = [];
    for (let i = 1; i <= count; i++) {
      const r = RateLimiters.deposit(userId);
      results.push({
        index: i,
        allowed: r.success,
        remaining: r.remaining,
        retryAfterMs: r.retryAfterMs,
      });
    }
    return NextResponse.json({ success: true, mode, userId, results });
  }

  // mode === "ip"
  const ip = body.ipAddress;
  if (!ip || typeof ip !== "string" || ip.length > 64) {
    return NextResponse.json(
      { success: false, error: "ipAddress required" },
      { status: 400 },
    );
  }

  const results: Array<{
    index: number;
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
  }> = [];
  for (let i = 1; i <= count; i++) {
    const r = RateLimiters.depositByIp(ip);
    results.push({
      index: i,
      allowed: r.success,
      remaining: r.remaining,
      retryAfterMs: r.retryAfterMs,
    });
  }
  return NextResponse.json({ success: true, mode, ipAddress: ip, results });
}
