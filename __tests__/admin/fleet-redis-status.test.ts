import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FLEET_HEARTBEAT_OFFLINE_MS,
  summarizeFleetRedis,
  toFleetRedisRows,
} from "../../apps/admin/lib/admin/fleet-redis-status";
import { stripComments, handlerPattern } from "../helpers/route-guard-audit";

const ROOT = join(__dirname, "..", "..");
const ROUTE = join(
  ROOT,
  "apps/admin/app/api/redis-settings/fleet-status/route.ts",
);
const CARD = join(
  ROOT,
  "apps/admin/components/admin/FleetRedisStatusCard.tsx",
);
const SECTION = join(
  ROOT,
  "apps/admin/components/admin/RedisSettingsSection.tsx",
);

describe("fleet Redis status shaping", () => {
  it("marks a fresh heartbeat with redisConnected as Redis OK and online", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const rows = toFleetRedisRows(
      [
        {
          serverId: "sec-1",
          hostname: "ChartVoltVPs2",
          role: "secondary",
          status: "online",
          lastHeartbeat: new Date(now.getTime() - 15_000),
          stats: { redisConnected: true },
        },
      ],
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("online");
    expect(rows[0].redisConnected).toBe(true);
    expect(rows[0].timeSinceHeartbeatSeconds).toBe(15);
    expect(summarizeFleetRedis(rows)).toEqual({
      total: 1,
      redisOk: 1,
      redisFail: 0,
      offline: 0,
    });
  });

  it("treats a silent heartbeat as offline even if redisConnected was true", () => {
    // Reason: a stored true from hours ago is not evidence Redis is up now — the
    // server itself is gone, so the row must fail closed for the Redis column too.
    const now = new Date("2026-09-25T12:00:00.000Z");
    const rows = toFleetRedisRows(
      [
        {
          serverId: "dead-1",
          hostname: "old-box",
          role: "primary",
          status: "online",
          lastHeartbeat: new Date(
            now.getTime() - FLEET_HEARTBEAT_OFFLINE_MS - 1,
          ),
          stats: { redisConnected: true },
        },
      ],
      now,
    );

    expect(rows[0].status).toBe("offline");
    expect(summarizeFleetRedis(rows).offline).toBe(1);
    expect(summarizeFleetRedis(rows).redisFail).toBe(1);
    expect(summarizeFleetRedis(rows).redisOk).toBe(0);
  });

  it("counts an online server with redisConnected false as a Redis fail", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const rows = toFleetRedisRows(
      [
        {
          serverId: "pri-1",
          hostname: "srv",
          role: "primary",
          lastHeartbeat: now,
          stats: { redisConnected: false },
        },
      ],
      now,
    );

    expect(rows[0].redisConnected).toBe(false);
    expect(summarizeFleetRedis(rows)).toEqual({
      total: 1,
      redisOk: 0,
      redisFail: 1,
      offline: 0,
    });
  });
});

describe("fleet Redis route and UI wiring", () => {
  it("fleet-status GET is granted by redis, not server-fleet", () => {
    // Reason: Redis Cache operators must see fleet Redis health without needing
    // the separate Server Fleet section grant. Naming server-fleet here would
    // silently lock the new panel behind the wrong permission.
    const source = stripComments(readFileSync(ROUTE, "utf8"));
    const handlers = [...source.matchAll(handlerPattern())].map((m) => m[1]);
    expect(handlers).toEqual(["GET"]);
    expect(source).toMatch(/guardSection\(\s*["']redis["']\s*\)/);
    expect(source).not.toMatch(/guardSection\(\s*["']server-fleet["']\s*\)/);
  });

  it("Redis Cache mounts FleetRedisStatusCard", () => {
    const section = stripComments(readFileSync(SECTION, "utf8"));
    expect(section).toMatch(/<FleetRedisStatusCard\s*\/>/);
    expect(section).toMatch(
      /from\s+["']@\/components\/admin\/FleetRedisStatusCard["']/,
    );
  });

  it("card fetches the fleet-status endpoint", () => {
    const card = stripComments(readFileSync(CARD, "utf8"));
    expect(card).toMatch(
      /fetch\(\s*["']\/api\/redis-settings\/fleet-status["']\s*\)/,
    );
  });
});
