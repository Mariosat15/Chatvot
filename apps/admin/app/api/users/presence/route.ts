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

    // Define threshold for "offline" (45 seconds without heartbeat)
    const offlineThreshold = new Date(Date.now() - 45 * 1000);

    // Map presence data with online status
    // Note: The main UserPresence model uses 'userId' not 'participantId'
    const presenceData = presences.map((p) => ({
      participantId: p.userId, // Map userId to participantId for consistency with frontend
      status:
        p.lastHeartbeat && new Date(p.lastHeartbeat) > offlineThreshold
          ? p.status || "online"
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
