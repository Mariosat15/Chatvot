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

    // Seed site pages (terms, privacy, etc.) — safe to call every startup
    setTimeout(async () => {
      try {
        const { seedSitePages } =
          await import("./lib/services/site-page-seed.service");
        await seedSitePages();
      } catch (err) {
        console.error("❌ [Instrumentation] Failed to seed site pages:", err);
      }
    }, 6000); // 6 second delay to let MongoDB connect first

    // Seed landing page templates — safe to call every startup
    setTimeout(async () => {
      try {
        const { seedLandingPageTemplates } =
          await import("./lib/services/landing-page-seed.service");
        await seedLandingPageTemplates();
      } catch (err) {
        console.error("❌ [Instrumentation] Failed to seed landing page templates:", err);
      }
    }, 7000); // 7 second delay

    // Start server fleet heartbeat (reports stats to MongoDB every 30s)
    setTimeout(async () => {
      try {
        const { startHeartbeat } =
          await import("./lib/services/server-heartbeat.service");
        startHeartbeat();
      } catch (err) {
        console.error("❌ [Instrumentation] Failed to start heartbeat:", err);
      }
    }, 10000); // 10 second delay to let MongoDB connect first

    // Start WebSocket event relay for cross-server messaging
    setTimeout(async () => {
      try {
        const { startWsEventRelay } =
          await import("./lib/services/ws-event-relay.service");
        await startWsEventRelay();
      } catch (err) {
        console.error("❌ [Instrumentation] Failed to start WS relay:", err);
      }
    }, 15000); // 15 second delay to let Redis connect first
  }
}
