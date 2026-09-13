import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/** GET /api/health-overview — compact admin health snapshot (DB, users, process). */
export async function GET() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const readyState = mongoose.connection.readyState;
    const mem = process.memoryUsage();
    const timestamp = new Date().toISOString();
    const database = {
      status: readyState === 1 ? ("connected" as const) : ("disconnected" as const),
      readyState,
    };

    let total = 0;
    let online = 0;
    let active = 0;
    let recentFailedAudits = 0;

    const db = mongoose.connection.db;
    if (db && readyState === 1) {
      const heartbeatSince = new Date(Date.now() - 120_000);
      const hourAgo = new Date(Date.now() - 3_600_000);
      [total, online, active, recentFailedAudits] = await Promise.all([
        db.collection("user").countDocuments({}),
        db.collection("userpresences").countDocuments({
          lastHeartbeat: { $gte: heartbeatSince },
        }),
        db.collection("competitions").countDocuments({ status: "active" }),
        db
          .collection("auditlogs")
          .countDocuments({ status: "failed", createdAt: { $gte: hourAgo } })
          .catch(() => 0),
      ]);
    }

    const heapRatio =
      mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (readyState !== 1) status = "critical";
    else if (recentFailedAudits > 20 || heapRatio > 0.92) status = "degraded";

    return NextResponse.json({
      status,
      uptime: process.uptime(),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
      },
      database,
      users: { total, online },
      competitions: { active },
      timestamp,
    });
  } catch (error) {
    console.error("❌ health-overview:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
