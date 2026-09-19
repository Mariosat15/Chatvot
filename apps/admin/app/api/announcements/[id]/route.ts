import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SystemAnnouncement from "@/database/models/system-announcement.model";
import { guardSection } from "@/lib/admin/section-route-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("system-announcements");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const { id } = await params;
    const body = await req.json();
    const update: Record<string, unknown> = {};

    const allowedFields = [
      "title",
      "message",
      "type",
      "scheduledStart",
      "scheduledEnd",
      "dismissible",
      "showCountdown",
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    // Handle activate/deactivate toggle
    if (body.isActive !== undefined) {
      update.isActive = body.isActive;
      update.status = body.isActive ? "active" : "draft";
    }

    // Handle status change
    if (body.status !== undefined) {
      update.status = body.status;
      if (body.status === "active") update.isActive = true;
      if (body.status === "expired" || body.status === "draft")
        update.isActive = false;
    }

    if (body.title) update.title = String(body.title).slice(0, 200);
    if (body.message) update.message = String(body.message).slice(0, 2000);

    const announcement = await SystemAnnouncement.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 },
      );
    }

    console.log(
      `📢 Announcement ${id} updated by ${guard.admin.email}: status=${announcement.status}`,
    );

    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update announcement error:", error);
    return NextResponse.json(
      { error: "Failed to update announcement" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("system-announcements");
    if (!guard.ok) return guard.response;
    await connectToDatabase();

    const { id } = await params;
    const result = await SystemAnnouncement.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete announcement error:", error);
    return NextResponse.json(
      { error: "Failed to delete announcement" },
      { status: 500 },
    );
  }
}
