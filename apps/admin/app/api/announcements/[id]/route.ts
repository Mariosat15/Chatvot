import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SystemAnnouncement from "@/database/models/system-announcement.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    const session = await getAdminSession();
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
      `📢 Announcement ${id} updated by ${session?.email}: status=${announcement.status}`,
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
    await requireAdminAuth();
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
