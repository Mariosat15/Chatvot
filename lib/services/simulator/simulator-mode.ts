/**
 * Simulator Mode Utilities
 *
 * Helpers for detecting simulator mode in API requests
 */

import { NextRequest } from "next/server";

/**
 * Check if the request is from the simulator.
 * When INTERNAL_API_SECRET is configured, the caller must also send
 * X-Internal-Secret to prove it is a trusted internal service.
 */
export function isSimulatorRequest(request: NextRequest): boolean {
  const hasSimHeader = request.headers.get("X-Simulator-Mode") === "true";
  if (!hasSimHeader) return false;

  const requiredSecret = process.env.INTERNAL_API_SECRET;
  if (requiredSecret) {
    return request.headers.get("X-Internal-Secret") === requiredSecret;
  }
  // Reason: Backward-compatible — if the secret isn't configured, accept the
  // header alone so existing deployments without the env var keep working.
  return true;
}

/**
 * Get the simulated user ID from request headers
 */
export function getSimulatorUserId(request: NextRequest): string | null {
  return request.headers.get("X-Simulator-User-Id");
}

/**
 * Check if we should allow simulator mode
 * Only enabled in development or when explicitly allowed
 */
export function isSimulatorEnabled(): boolean {
  // Always allow in development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Allow if explicitly enabled
  return process.env.ENABLE_SIMULATOR === "true";
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
