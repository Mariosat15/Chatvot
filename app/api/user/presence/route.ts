import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import UserPresence from "@/database/models/user-presence.model";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

// ── Stale-cleanup throttle ─────────────────────────────────────────────
// Before this fix, every heartbeat (POST) ran updateMany to mark stale
// users offline. With N users heartbeating every 30s, that was N redundant
// updateMany operations per 30s. Now we only run cleanup once per 60s.
let lastStaleCleanupTime = 0;
const STALE_CLEANUP_INTERVAL_MS = 60_000; // 60 seconds

// GET - Get current user's presence or list of online users
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const listOnline = searchParams.get("online") === "true";

    if (listOnline) {
      const threshold = new Date(
        Date.now() - PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD,
      );

      const onlineUsers = await UserPresence.find({
        status: "online",
        lastHeartbeat: { $gte: threshold },
        userId: { $ne: session.user.id }, // Exclude self
      })
        .select(
          "userId username status acceptingChallenges lastSeen isInChallenge isInCompetition",
        )
        .lean();

      return NextResponse.json({ users: onlineUsers });
    }

    // Return current user's presence
    const presence = await UserPresence.findOne({
      userId: session.user.id,
    }).lean();
    return NextResponse.json({ presence });
  } catch (error) {
    console.error("Error fetching presence:", error);
    return NextResponse.json(
      { error: "Failed to fetch presence" },
      { status: 500 },
    );
  }
}

// POST - Update presence (heartbeat)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Check for action=offline query parameter (handles going offline without body)
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "offline") {
      // Go offline - no body needed
      await UserPresence.findOneAndUpdate(
        { userId: session.user.id },
        { $set: { status: "offline", lastSeen: new Date() } },
      );
      return NextResponse.json({ success: true, status: "offline" });
    }

    // Parse body safely - default to empty object if no body
    let body: {
      status?: string;
      currentPage?: string;
      acceptingChallenges?: boolean;
    } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body or invalid JSON - that's okay, use defaults
    }

    // Reason: sendBeacon on beforeunload sends { status: "offline" }.
    // Handle this explicitly so users go offline immediately on tab close.
    if (body.status === "offline") {
      await UserPresence.findOneAndUpdate(
        { userId: session.user.id },
        { $set: { status: "offline", lastSeen: new Date() } },
      );
      return NextResponse.json({ success: true, status: "offline" });
    }

    const { currentPage, acceptingChallenges } = body;

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      lastHeartbeat: now,
      lastSeen: now,
      status: "online",
    };

    if (currentPage !== undefined) {
      updateData.currentPage = currentPage;
    }

    if (acceptingChallenges !== undefined) {
      updateData.acceptingChallenges = acceptingChallenges;
    }

    // Capture connection info for the admin live-ops dashboard.
    // Reason: IP/UA/geo fields already exist on the schema but were never
    // populated. Cloudflare headers cost nothing to read and give us the
    // admin-visible geo enrichment without an extra GeoIP lookup.
    const hdr = request.headers;
    const ip =
      hdr.get("cf-connecting-ip") ||
      hdr.get("x-real-ip") ||
      hdr.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      undefined;
    const userAgent = hdr.get("user-agent") || undefined;
    const country = hdr.get("cf-ipcountry") || undefined;
    const city = hdr.get("cf-ipcity") || undefined;
    const region = hdr.get("cf-region") || undefined;
    if (ip) updateData.ipAddress = ip;
    if (userAgent) updateData.userAgent = userAgent;
    if (country) updateData.country = country;
    if (city) updateData.city = city;
    if (region) updateData.region = region;

    const presence = await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: updateData,
        $setOnInsert: {
          userId: session.user.id,
          username: session.user.name || "Unknown",
        },
      },
      { upsert: true, new: true },
    );

    // Mark stale users as offline — throttled to run at most once per 60s
    // to avoid redundant updateMany on every heartbeat from every user.
    const nowMs = Date.now();
    if (nowMs - lastStaleCleanupTime > STALE_CLEANUP_INTERVAL_MS) {
      lastStaleCleanupTime = nowMs;
      await UserPresence.updateMany(
        {
          status: { $ne: "offline" },
          lastHeartbeat: {
            $lt: new Date(
              nowMs - PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD,
            ),
          },
        },
        { $set: { status: "offline" } },
      );
    }

    return NextResponse.json({
      success: true,
      presence: {
        status: presence.status,
        acceptingChallenges: presence.acceptingChallenges,
      },
    });
  } catch (error) {
    console.error("Error updating presence:", error);
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 },
    );
  }
}

// PUT - Toggle accepting challenges
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { acceptingChallenges } = body;

    // Reason: `typeof`, not a truthiness check. Switching challenges OFF is the
    // whole point of this route, and `$set: { acceptingChallenges: undefined }`
    // is a no-op that still reports success.
    if (typeof acceptingChallenges !== "boolean") {
      return NextResponse.json(
        { error: "acceptingChallenges must be true or false" },
        { status: 400 },
      );
    }

    // Reason: upserts, where this used to 404 on a missing document. A player
    // who has never been online has no presence row, so the one player most
    // likely to be setting this before they start playing was the one it
    // refused - and the challenge create route reads the ABSENCE of the row as
    // "accepting", so the refusal left them reachable while telling them the
    // switch had been saved. `$setOnInsert` matches the heartbeat's, minus the
    // status and timestamps: changing a setting is not evidence of activity.
    const presence = await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: { acceptingChallenges },
        $setOnInsert: {
          userId: session.user.id,
          username: session.user.name || "Unknown",
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      success: true,
      acceptingChallenges: presence.acceptingChallenges,
    });
  } catch (error) {
    console.error("Error toggling accepting challenges:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}

// DELETE - Go offline
export async function DELETE(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { status: "offline", lastSeen: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error going offline:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }
}
