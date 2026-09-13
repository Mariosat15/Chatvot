import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { Server } from "@/database/models/server.model";

const OFFLINE_THRESHOLD = 90000; // 90 seconds without heartbeat = offline

export async function GET() {
  try {
    await connectToDatabase();

    const servers = await Server.find().sort({ role: 1, hostname: 1 }).lean();

    const now = new Date();

    const serversWithStatus = servers.map((server) => {
      const lastBeat = new Date(server.lastHeartbeat);
      const timeSinceHeartbeat = now.getTime() - lastBeat.getTime();
      const isOffline = timeSinceHeartbeat > OFFLINE_THRESHOLD;

      return {
        ...server,
        status: isOffline ? "offline" : server.status,
        timeSinceHeartbeat: Math.round(timeSinceHeartbeat / 1000),
      };
    });

    const totalServers = serversWithStatus.length;
    const onlineServers = serversWithStatus.filter(
      (s) => s.status === "online",
    ).length;
    const degradedServers = serversWithStatus.filter(
      (s) => s.status === "degraded",
    ).length;
    const offlineServers = serversWithStatus.filter(
      (s) => s.status === "offline",
    ).length;
    const primaryServers = serversWithStatus.filter(
      (s) => s.role === "primary",
    ).length;

    const totalWSConnections = serversWithStatus.reduce(
      (sum, s) => sum + (s.stats?.wsConnections || 0),
      0,
    );
    const avgCPU =
      totalServers > 0
        ? Math.round(
            serversWithStatus.reduce(
              (sum, s) => sum + (s.stats?.cpuPercent || 0),
              0,
            ) / totalServers,
          )
        : 0;
    const avgMemory =
      totalServers > 0
        ? Math.round(
            serversWithStatus.reduce(
              (sum, s) => sum + (s.stats?.memoryPercent || 0),
              0,
            ) / totalServers,
          )
        : 0;

    return NextResponse.json({
      servers: serversWithStatus,
      summary: {
        total: totalServers,
        online: onlineServers,
        degraded: degradedServers,
        offline: offlineServers,
        primary: primaryServers,
        secondary: totalServers - primaryServers,
        totalWSConnections,
        avgCPU,
        avgMemory,
      },
    });
  } catch (error) {
    console.error("[Server Fleet] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch server fleet data" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/server-fleet?serverId=xxx
 * Remove a server from the fleet (e.g., decommissioned server)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json(
        { error: "serverId is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const result = await Server.deleteOne({ serverId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Server not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted: serverId });
  } catch (error) {
    console.error("[Server Fleet] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete server" },
      { status: 500 },
    );
  }
}
