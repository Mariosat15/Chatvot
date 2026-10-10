/**
 * Access control for the /api/simulator/attack/* routes.
 *
 * These routes probe the payment-defense layer (rate limiters, decline
 * velocity, webhook HMAC) so they MUST NEVER be reachable in production by
 * anyone except the admin kickoff flow running on the same machine. Every
 * attack route passes through `requireAttackTestAccess` as its first step.
 *
 * SEVEN LAYERS (any single failure = 403):
 *   1. DB toggle         AttackSuiteConfig.enabled === true (admin-controlled)
 *   2. Shared secret     X-Simulator-Attack-Secret header (constant-time compare
 *                        against AttackSuiteConfig.secret)
 *   3. Loopback only     client IP must be 127.0.0.1 or ::1 (or equivalents)
 *   4. Test-user prefix  any userId param must start with "sim-attack-"
 *   5. Self rate-limit   60 attack calls / minute / IP
 *   6. Admin kickoff     admin-app route verifies admin JWT before firing (layer 6 is enforced elsewhere)
 *   7. Audit log         admin kickoff writes auditLogService.log (enforced elsewhere)
 *
 * Layers 1-5 live in this file. Layers 6-7 live in the admin kickoff route.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
// Reason: relative imports so this guard resolves identically under both
// the main app's @/ alias (repo root) and the admin app's @/ alias
// (apps/admin/), where "@/lib/..." would otherwise map outside the tree.
import { getClientIP, checkRateLimit } from "../../../utils/rate-limiter";
import {
  isAttackSuiteEnabled,
  getAttackSuiteSecret,
} from "../attack-suite-config.service";

export const ATTACK_USER_PREFIX = "sim-attack-";
export const ATTACK_SECRET_HEADER = "x-simulator-attack-secret";

const LOOPBACK_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
]);

export interface AttackGuardFailure {
  ok: false;
  status: number;
  reason: string;
}

export interface AttackGuardSuccess {
  ok: true;
  clientIp: string;
}

export type AttackGuardResult = AttackGuardSuccess | AttackGuardFailure;

/**
 * Predicate for test user IDs. Anything that targets a userId must pass this.
 * Real user IDs are UUIDs — they will NEVER match this prefix.
 */
export function isAttackTestUserId(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  if (id.length > 200) return false; // sanity
  return id.startsWith(ATTACK_USER_PREFIX);
}

/**
 * Constant-time comparison. Falls back to false on length mismatch to avoid
 * leaking length via timingSafeEqual throwing.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function isLoopback(ip: string): boolean {
  if (!ip) return false;
  return LOOPBACK_IPS.has(ip);
}

/**
 * Apply layers 1-5. Returns either `{ ok: true, clientIp }` or a failure with
 * the status/reason that the route should return. No information about which
 * specific layer failed leaks to the client beyond 403 + "Forbidden".
 */
export async function requireAttackTestAccess(
  req: NextRequest | Request,
): Promise<AttackGuardResult> {
  // LAYER 1: DB toggle (admin-controlled via Attack Suite config)
  const enabled = await isAttackSuiteEnabled();
  if (!enabled) {
    return { ok: false, status: 403, reason: "disabled" };
  }

  // LAYER 2: Shared secret (stored in AttackSuiteConfig, rotated from admin UI)
  const expectedSecret = await getAttackSuiteSecret();
  if (!expectedSecret || expectedSecret.length < 16) {
    // Missing/too-short secret is treated as "disabled" to avoid weak defaults.
    return { ok: false, status: 403, reason: "disabled" };
  }
  const providedSecret = req.headers.get(ATTACK_SECRET_HEADER) ?? "";
  if (!safeCompare(providedSecret, expectedSecret)) {
    return { ok: false, status: 403, reason: "forbidden" };
  }

  // LAYER 3: Loopback only
  const clientIp = getClientIP(req);
  if (!isLoopback(clientIp)) {
    return { ok: false, status: 403, reason: "forbidden" };
  }

  // LAYER 5: Self rate-limit on the attack endpoints themselves
  // (Layer 4 is enforced per-route on the userId parameter — this file exports
  //  `isAttackTestUserId` for that purpose.)
  const limit = checkRateLimit(clientIp, {
    maxRequests: 60,
    windowMs: 60 * 1000,
    keyPrefix: "attack_self",
  });
  if (!limit.success) {
    return { ok: false, status: 429, reason: "rate_limited" };
  }

  return { ok: true, clientIp };
}

/**
 * Convenience helper: run the guard and return a NextResponse on failure, or
 * null on success. Keeps route handlers short.
 */
export async function guardAttackRoute(
  req: NextRequest,
): Promise<{ response: NextResponse } | { clientIp: string }> {
  const result = await requireAttackTestAccess(req);
  if (!result.ok) {
    return {
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: result.status },
      ),
    };
  }
  return { clientIp: result.clientIp };
}

/**
 * Enforce layer 4: any userId referenced by a request body must start with
 * `sim-attack-`. Returns true if safe, false otherwise.
 */
export function assertTestUserIds(
  ids: Array<string | null | undefined>,
): boolean {
  return ids.every((id) => id == null || isAttackTestUserId(id));
}
