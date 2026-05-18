import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import {
  TutorialVideo,
  TUTORIAL_CATEGORIES,
  type TutorialCategory,
} from "@/database/models/tutorial-video.model";
import { deleteTutorialFile } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/tutorials/[id] — update editable metadata only (no file replacement here)
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    const { id } = await ctx.params;
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.description === "string")
      update.description = body.description;
    if (
      typeof body.category === "string" &&
      TUTORIAL_CATEGORIES.includes(body.category as TutorialCategory)
    ) {
      update.category = body.category;
    }
    if (typeof body.order === "number") update.order = body.order;
    if (typeof body.isActive === "boolean") update.isActive = body.isActive;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const item = await TutorialVideo.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Tutorial not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, item });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [Tutorials PUT] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update tutorial" },
      { status: 500 },
    );
  }
}

// DELETE /api/tutorials/[id] — remove file from disk + DB record
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();
    const { id } = await ctx.params;

    const item = await TutorialVideo.findById(id).lean();
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Tutorial not found" },
        { status: 404 },
      );
    }

    if (item.filename) {
      await deleteTutorialFile(item.filename);
    }
    if (item.thumbnailFilename) {
      await deleteTutorialFile(item.thumbnailFilename, "thumbnails");
    }

    await TutorialVideo.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [Tutorials DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete tutorial" },
      { status: 500 },
    );
  }
}
