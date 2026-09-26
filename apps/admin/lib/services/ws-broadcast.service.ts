/**
 * WebSocket Broadcast Service
 *
 * Sends WebSocket events to the local server AND publishes to Redis
 * so all servers in the fleet can relay the event to their connected clients.
 */

const WS_EVENTS_CHANNEL = "chartvolt:ws-events";

/**
 * Broadcast a WebSocket event to all servers in the fleet.
 * 1. Sends to the local WebSocket server (localhost:3003)
 * 2. Publishes to Redis so other servers can relay to their clients
 */
export async function broadcastWsEvent(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const wsInternalUrl =
    process.env.WS_INTERNAL_URL || "http://localhost:3003";

  // Send to local WebSocket server
  try {
    await fetch(`${wsInternalUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Local WS server unreachable — not critical
  }

  // Publish to Redis for other servers (include sourceServerId so the
  // receiving relay can skip events that originated from this server)
  try {
    const os = await import("os");
    const sourceServerId = process.env.SERVER_ID || os.hostname();
    const { getRedis } = await import("./redis.service");
    const redis = await getRedis();
    if (redis) {
      await redis.publish(
        WS_EVENTS_CHANNEL,
        JSON.stringify({ endpoint, payload, sourceServerId }),
      );
    }
  } catch {
    // Redis unavailable — single-server mode, local broadcast is sufficient
  }
}
