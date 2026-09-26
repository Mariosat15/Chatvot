import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import { Server } from "@/database/models/server.model";
import {
  summarizeFleetRedis,
  toFleetRedisRows,
} from "@/lib/admin/fleet-redis-status";

/**
 * GET /api/redis-settings/fleet-status
 *
 * Per-server Redis connectivity from the fleet heartbeat (same source as
 * Server Fleet → Redis: Yes/No). Granted by the `redis` section so a Redis
 * operator does not need the separate `server-fleet` grant.
 */
export async function GET() {
  // Reason: Redis Cache owns this screen; section grant is the auth answer.
  const guard = await guardSection("redis");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    const servers = await Server.find()
      .select("serverId hostname role status lastHeartbeat domain stats.redisConnected")
      .sort({ role: 1, hostname: 1 })
      .lean();

    const rows = toFleetRedisRows(servers);
    const summary = summarizeFleetRedis(rows);

    return NextResponse.json({ servers: rows, summary });
  } catch (error) {
    console.error("[Redis Fleet Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fleet Redis status" },
      { status: 500 },
    );
  }
}
