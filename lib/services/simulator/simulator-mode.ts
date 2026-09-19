/**
 * Simulator Mode Utilities
 *
 * Helpers for detecting simulator mode in API requests.
 *
 * SECURITY: the simulator routes act on behalf of an arbitrary user id and can
 * mutate wallets, orders and contests. They are therefore privileged internal
 * endpoints, not public API. Access requires ALL of the following outside
 * development:
 *
 *   1. X-Simulator-Mode: true          declares intent
 *   2. ENABLE_SIMULATOR=true           deployment opts in
 *   3. X-Internal-Secret               matches INTERNAL_API_SECRET (constant-time)
 *
 * Reason: a previous version accepted the X-Simulator-Mode header on its own
 * whenever INTERNAL_API_SECRET happened to be unset, and most routes never
 * called this helper at all. That allowed an unauthenticated caller to act as
 * any user. Both holes are closed here: the guard now fails closed on a missing
 * or weak secret, and `guardSimulatorRoute` gives every route one line to adopt.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** A shorter secret than this is treated as unset rather than as protection. */
const MIN_SECRET_LENGTH = 16;

export const SIMULATOR_MODE_HEADER = "X-Simulator-Mode";
export const SIMULATOR_USER_HEADER = "X-Simulator-User-Id";
export const INTERNAL_SECRET_HEADER = "X-Internal-Secret";

/**
 * Constant-time string comparison. Returns false on length mismatch rather
 * than letting timingSafeEqual throw, which would leak length.
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

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Whether simulator endpoints are permitted in this deployment at all.
 * Always on in development; production must opt in explicitly.
 */
export function isSimulatorEnabled(): boolean {
  if (isDevelopment()) return true;
  return process.env.ENABLE_SIMULATOR === "true";
}

/**
 * Check that a request is a genuine internal simulator call.
 *
 * Outside development this requires the declared header, the deployment opt-in,
 * and a valid internal secret. A missing or too-short INTERNAL_API_SECRET fails
 * closed, so a misconfigured deployment refuses simulator traffic instead of
 * accepting anonymous traffic.
 */
export function isSimulatorRequest(request: NextRequest | Request): boolean {
  if (request.headers.get(SIMULATOR_MODE_HEADER) !== "true") return false;
  if (!isSimulatorEnabled()) return false;

  const requiredSecret = process.env.INTERNAL_API_SECRET;
  if (!requiredSecret || requiredSecret.length < MIN_SECRET_LENGTH) {
    return isDevelopment();
  }

  return safeCompare(
    request.headers.get(INTERNAL_SECRET_HEADER) ?? "",
    requiredSecret,
  );
}

/**
 * Get the simulated user ID from request headers.
 *
 * Only trust this after `isSimulatorRequest` has returned true — on its own the
 * header is attacker-controlled and names the account to act as.
 */
export function getSimulatorUserId(
  request: NextRequest | Request,
): string | null {
  return request.headers.get(SIMULATOR_USER_HEADER);
}

/**
 * Route guard. Returns a 403 response to return immediately, or null to
 * proceed. Every /api/simulator route should start with this.
 *
 * Development keeps its previous ergonomics: local calls need no headers.
 */
export function guardSimulatorRoute(
  request: NextRequest | Request,
): NextResponse | null {
  if (isSimulatorRequest(request)) return null;
  if (isDevelopment()) return null;

  return NextResponse.json(
    { success: false, error: "Simulator mode not enabled" },
    { status: 403 },
  );
}

/**
 * Create headers for simulator requests. Includes INTERNAL_API_SECRET
 * when available so the target route can verify the caller.
 */
export function createSimulatorHeaders(
  userId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Simulator-Mode": "true",
    "Content-Type": "application/json",
  };

  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    headers["X-Internal-Secret"] = secret;
  }

  if (userId) {
    headers["X-Simulator-User-Id"] = userId;
  }

  return headers;
}

/**
 * Validate that simulator mode is enabled
 * Throws error if not
 */
export function requireSimulatorEnabled(): void {
  if (!isSimulatorEnabled()) {
    throw new Error("Simulator mode is not enabled");
  }
}
