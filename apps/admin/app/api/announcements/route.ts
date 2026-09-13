import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SystemAnnouncement from "@/database/models/system-announcement.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const filter: Record<string, unknown> = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    const [announcements, total] = await Promise.all([
      SystemAnnouncement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SystemAnnouncement.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      announcements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get announcements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAuth();
    const session = await getAdminSession();
    await connectToDatabase();

    const body = await req.json();
    const {
      title,
      message,
      type = "info",
      scheduledStart,
      scheduledEnd,
      dismissible = true,
      showCountdown = false,
      activateNow = false,
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 },
      );
    }

    let status: "draft" | "active" | "scheduled" = "draft";
    let isActive = false;

    if (activateNow) {
      status = "active";
      isActive = true;
    } else if (scheduledStart) {
      status = "scheduled";
    }

    const announcement = await SystemAnnouncement.create({
      title: title.slice(0, 200),
      message: message.slice(0, 2000),
      type,
      status,
      isActive,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
      dismissible,
      showCountdown,
      createdBy: session?.adminId || "unknown",
      createdByEmail: session?.email || "unknown",
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create announcement error:", error);
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 },
    );
  }
}
