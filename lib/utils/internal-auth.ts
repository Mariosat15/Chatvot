/**
 * Internal service-to-service authentication.
 *
 * Several routes are reachable from the public internet but are only ever meant
 * to be called by our own processes (worker, admin app, API server). They prove
 * that with a shared secret from the environment.
 *
 * Reason: these checks previously used a literal fallback, e.g.
 * `process.env.INTERNAL_API_KEY || "internal-key"`, so a deployment that had
 * not set the variable accepted a publicly known string as its credential.
 * Every check here fails closed instead, with a single documented exception for
 * local development where the variables are typically unset.
 */

import crypto from "crypto";

/** A shorter secret than this is treated as unset rather than as protection. */
const MIN_SECRET_LENGTH = 16;

/**
 * Constant-time comparison. Returns false on length mismatch rather than
 * letting timingSafeEqual throw, which would leak length.
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

/**
 * Verify a caller-supplied internal credential against the configured secrets.
 *
 * Compares the provided value against each candidate in order, ignoring any
 * that are unset or too short to be real protection. Returns false when no
 * candidate is usable, except in local development, where an unconfigured
 * secret allows the call so local tooling keeps working.
 *
 * Callers pass the environment values themselves rather than variable names, so
 * that the set of accepted secrets is visible at the call site.
 *
 * @param provided    the credential the caller sent (header or body field)
 * @param candidates  accepted secrets, in priority order
 * @param context     label used in the server-side warning when misconfigured
 */
export function verifyInternalSecret(
  provided: string | null | undefined,
  candidates: Array<string | undefined>,
  context = "internal-auth",
): boolean {
  const configured = candidates.find(
    (value): value is string => !!value && value.length >= MIN_SECRET_LENGTH,
  );

  if (!configured) {
    if (process.env.NODE_ENV === "development") return true;
    console.error(
      `❌ [${context}] no internal secret is configured — refusing request`,
    );
    return false;
  }

  return safeCompare(provided ?? "", configured);
}
