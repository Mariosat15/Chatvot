/**
 * Present fleet Redis health for the Redis Cache admin screen.
 *
 * Each app server heartbeats every ~30s and stores `stats.redisConnected` from a
 * local PING. This module only shapes that stored fact for the UI — it does not
 * open a new Redis connection per server (that would require SSH or an agent).
 *
 * Model-free so a client component can import the types/helpers without pulling
 * Mongoose into the browser (R58).
 */

export const FLEET_HEARTBEAT_OFFLINE_MS = 90_000;

export type FleetRedisServerInput = {
  serverId: string;
  hostname?: string | null;
  role?: "primary" | "secondary" | string | null;
  status?: string | null;
  lastHeartbeat?: Date | string | null;
  domain?: string | null;
  stats?: { redisConnected?: boolean | null } | null;
};

export type FleetRedisServerRow = {
  serverId: string;
  hostname: string;
  role: "primary" | "secondary";
  /** Live online/offline after applying the heartbeat threshold. */
  status: "online" | "offline" | "degraded";
  redisConnected: boolean;
  timeSinceHeartbeatSeconds: number;
  domain: string;
};

export type FleetRedisSummary = {
  total: number;
  redisOk: number;
  redisFail: number;
  offline: number;
};

export function toFleetRedisRows(
  servers: readonly FleetRedisServerInput[],
  now: Date = new Date(),
): FleetRedisServerRow[] {
  const nowMs = now.getTime();
  return servers.map((server) => {
    const lastBeat = server.lastHeartbeat
      ? new Date(server.lastHeartbeat).getTime()
      : 0;
    const ageMs = Number.isFinite(lastBeat) ? nowMs - lastBeat : Number.POSITIVE_INFINITY;
    const isOffline = ageMs > FLEET_HEARTBEAT_OFFLINE_MS;
    const storedStatus = server.status === "degraded" ? "degraded" : "online";
    const role = server.role === "secondary" ? "secondary" : "primary";

    return {
      serverId: server.serverId,
      hostname: server.hostname?.trim() || server.serverId,
      role,
      status: isOffline ? "offline" : storedStatus,
      redisConnected: server.stats?.redisConnected === true,
      timeSinceHeartbeatSeconds: Number.isFinite(ageMs)
        ? Math.max(0, Math.round(ageMs / 1000))
        : 99999,
      domain: server.domain?.trim() || "",
    };
  });
}

export function summarizeFleetRedis(
  rows: readonly FleetRedisServerRow[],
): FleetRedisSummary {
  let redisOk = 0;
  let redisFail = 0;
  let offline = 0;
  for (const row of rows) {
    if (row.status === "offline") {
      offline += 1;
      redisFail += 1;
      continue;
    }
    if (row.redisConnected) redisOk += 1;
    else redisFail += 1;
  }
  return { total: rows.length, redisOk, redisFail, offline };
}
