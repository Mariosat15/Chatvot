/**
 * Admin App Instrumentation
 *
 * Empty instrumentation file for the admin app.
 * Cache pre-warming is only needed for the main trading app.
 */

export async function register() {
  // Admin app doesn't need cache warming
  // This empty file prevents the root instrumentation.ts from being used
}
