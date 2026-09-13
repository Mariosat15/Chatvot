import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";

/**
 * GET /api/users/presence
 * Get online/offline status. Optional ?userIds=id1,id2,... to return only those users (scales with 4k+ users).
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userIdsParam = searchParams.get("userIds");
    const userIds =
      userIdsParam?.split(",").map((id) => id.trim()).filter(Boolean) || null;

    const query =
      userIds && userIds.length > 0
        ? { userId: { $in: userIds } }
        : {};

    const presences = await db
      .collection("userpresences")
      .find(query)
      .toArray();

    // Reason: 120s threshold matches the user-facing route and accommodates
    // browser background-tab throttling (intervals can be delayed to ~60-120s).
    const offlineThreshold = new Date(Date.now() - 120 * 1000);

    // Reason: Use lastHeartbeat freshness as the sole source of truth.
    // The stored `status` field can be stale (e.g. "offline" from a previous
    // cleanup) even after the user sent a fresh heartbeat. Checking only
    // lastHeartbeat avoids the bug where `p.status || "online"` keeps showing
    // "offline" because "offline" is a truthy string that skips the fallback.
    const presenceData = presences.map((p) => ({
      participantId: p.userId,
      status:
        p.lastHeartbeat && new Date(p.lastHeartbeat) > offlineThreshold
          ? "online"
          : "offline",
      lastSeen: p.lastHeartbeat || p.lastSeen || p.updatedAt || p.createdAt,
      lastHeartbeat: p.lastHeartbeat,
      username: p.username,
    }));

    return NextResponse.json({
      presences: presenceData,
      total: presenceData.length,
      onlineCount: presenceData.filter((p) => p.status !== "offline").length,
      offlineCount: presenceData.filter((p) => p.status === "offline").length,
    });
  } catch (error) {
    console.error("Error fetching user presence:", error);
    return NextResponse.json(
      { error: "Failed to fetch user presence" },
      { status: 500 },
    );
  }
}
