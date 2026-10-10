/**
 * WebSocket Event Relay Service
 *
 * Subscribes to a Redis pub/sub channel for cross-server WebSocket events.
 * When the admin app on any server broadcasts a messaging event (new message,
 * transfer, resolve, etc.), this relay picks it up and forwards it to the
 * LOCAL WebSocket server so clients connected to THIS server get real-time updates.
 *
 * Started automatically by instrumentation.ts on all servers (primary + secondary).
 */

const REDIS_WS_CHANNEL = "chartvolt:ws-events";

let relayStarted = false;

export async function startWsEventRelay(): Promise<void> {
  if (relayStarted) return;
  relayStarted = true;

  const serverId = process.env.SERVER_ID || "unknown";

  try {
    const { getRedisConfig } = await import("./redis.service");
    const config = await getRedisConfig();

    if (!config || !config.enabled) return;

    const Redis = (await import("ioredis")).default;

    const opts: Record<string, unknown> = {
      host: config.host,
      port: config.port,
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        return Math.min(times * 1000, 30000);
      },
      lazyConnect: false,
    };

    if (config.password) {
      opts.password = config.password;
    }

    const subscriber = new Redis(opts as any);
    const wsInternalUrl =
      process.env.WEBSOCKET_INTERNAL_URL || "http://localhost:3003";

    subscriber.on("connect", () => {
      console.log("📨 [WS Relay] Connected to Redis for messaging events");
    });

    subscriber.on("error", (err: Error) => {
      if (Math.random() < 0.05) {
        console.error("📨 [WS Relay] Redis error:", err.message);
      }
    });

    await subscriber.subscribe(REDIS_WS_CHANNEL);

    subscriber.on("message", async (channel: string, message: string) => {
      if (channel !== REDIS_WS_CHANNEL) return;

      try {
        const event = JSON.parse(message);

        // Skip events that originated from this server (already delivered locally)
        if (event.originServerId === serverId) return;

        // Forward to local WebSocket server
        await fetch(`${wsInternalUrl}${event.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.payload),
        });
      } catch {
        // Silently ignore relay failures
      }
    });
  } catch {
    relayStarted = false;
  }
}
