/**
 * Centralized admin JWT secret management
 *
 * SECURITY: Never use fallback secrets in production
 */

import { createHash } from "crypto";

let cachedSecret: string | null = null;
let fingerprintLogged = false;

/**
 * Produce a safe, one-way fingerprint of a secret for diagnostics.
 *
 * Reason: admin sessions break silently when two servers in a fleet sign/verify
 * JWTs with different ADMIN_JWT_SECRET values (e.g. a stale value baked into
 * PM2's saved process dump overriding .env). The raw secret must never be
 * logged, but a short SHA-256 prefix is safe to print and lets an operator
 * confirm at a glance whether every server is using the SAME secret.
 */
export function fingerprintSecret(secret: string): string {
  return "sha256:" + createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

/**
 * Log the active secret's fingerprint exactly once per process.
 * Compare this line across servers — the fingerprint MUST match everywhere.
 */
function logSecretFingerprintOnce(): void {
  if (fingerprintLogged || !cachedSecret) return;
  fingerprintLogged = true;
  const source = process.env.ADMIN_JWT_SECRET ? "process env / .env" : "dev fallback";
  console.log(
    `🔑 [admin-auth] ADMIN_JWT_SECRET active — fingerprint ${fingerprintSecret(cachedSecret)} (source: ${source}). ` +
      "Multi-server: this fingerprint MUST be identical on every server, or admins get logged out on each request.",
  );
}

/**
 * Get the admin JWT secret - throws in production if not set
 */
export function getAdminJwtSecret(): string {
  // Return cached value if available
  if (cachedSecret) return cachedSecret;

  const secret = process.env.ADMIN_JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret && isProduction) {
    throw new Error(
      "CRITICAL: ADMIN_JWT_SECRET is required in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // In development, use a fallback but log a warning once
  if (!secret) {
    if (!cachedSecret) {
      console.warn(
        "⚠️  ADMIN_JWT_SECRET not set - using insecure fallback (OK for development only)"
      );
    }
    // snyk:ignore:next-line - Intentional dev-only fallback with warning
    cachedSecret = "dev-only-insecure-secret-do-not-use-in-production-32chars";
    logSecretFingerprintOnce();
    return cachedSecret;
  }

  cachedSecret = secret;
  logSecretFingerprintOnce();
  return cachedSecret;
}
