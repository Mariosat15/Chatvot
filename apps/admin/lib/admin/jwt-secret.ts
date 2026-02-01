/**
 * Centralized admin JWT secret management
 *
 * SECURITY: Never use fallback secrets in production
 */

let cachedSecret: string | null = null;

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
    cachedSecret = "dev-only-insecure-secret-do-not-use-in-production-32chars";
    return cachedSecret;
  }

  cachedSecret = secret;
  return cachedSecret;
}
