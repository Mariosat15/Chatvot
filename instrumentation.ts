/**
 * Next.js Instrumentation (Main Trading App)
 *
 * This file is automatically called by Next.js when the server starts.
 * Use it for initialization tasks like cache pre-warming.
 *
 * Note: Admin app has its own instrumentation.ts in apps/admin/
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on Node.js server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("🚀 [Instrumentation] Main app server starting...");

    // Pre-warm aggregator cache in background (don't block server startup)
    // Small delay to ensure MongoDB connection is ready
    setTimeout(async () => {
      try {
        const { warmCache } =
          await import("./lib/services/candle-aggregator.service");
        await warmCache();
      } catch (err) {
        console.error("❌ [Instrumentation] Failed to warm cache:", err);
      }
    }, 5000); // 5 second delay to let server fully initialize
  }
}
