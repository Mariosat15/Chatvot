/**
 * Next.js Instrumentation
 * 
 * This file is automatically called by Next.js when the server starts.
 * Use it for initialization tasks like cache pre-warming.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on Node.js server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [Instrumentation] Next.js server starting...');
    
    // Pre-warm aggregator cache in background (don't block server startup)
    // Small delay to ensure MongoDB connection is ready
    setTimeout(async () => {
      try {
        const { warmCache } = await import('@/lib/services/candle-aggregator.service');
        await warmCache();
      } catch (err) {
        console.error('❌ [Instrumentation] Failed to warm cache:', err);
      }
    }, 5000); // 5 second delay to let server fully initialize
  }
}
