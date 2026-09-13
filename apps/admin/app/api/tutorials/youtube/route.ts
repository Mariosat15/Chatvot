import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import {
  TutorialVideo,
  TUTORIAL_CATEGORIES,
  type TutorialCategory,
} from "@/database/models/tutorial-video.model";
import { parseYouTubeId } from "@/lib/tutorials/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `video-${Date.now()}`
  );
}

/**
 * POST /api/tutorials/youtube — create a YouTube-hosted tutorial.
 *
 * Reason: Disk-stored videos do not work across multiple servers (a file
 * uploaded on one VPS is missing on the others). Hosting on YouTube and
 * storing only the video id makes tutorials work identically on every
 * server with no shared storage.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "other") as TutorialCategory;
    const order = Number(body.order ?? 100);
    const isActive = body.isActive !== false;
    const youtubeUrl = String(body.youtubeUrl || body.youtubeId || "").trim();

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 },
      );
    }
    if (!TUTORIAL_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid category" },
        { status: 400 },
      );
    }

    const youtubeId = parseYouTubeId(youtubeUrl);
    if (!youtubeId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not read a valid YouTube link. Paste a URL like https://www.youtube.com/watch?v=… or https://youtu.be/…",
        },
        { status: 400 },
      );
    }

    // Ensure slug is unique (auto-suffix if needed)
    const baseSlug = toSlug(title);
    let slug = baseSlug;
    let suffix = 1;
    while (await TutorialVideo.exists({ slug })) {
      slug = `${baseSlug}-${suffix++}`;
      if (suffix > 100) {
        slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
        break;
      }
    }

    const created = await TutorialVideo.create({
      slug,
      title,
      description,
      category,
      source: "youtube",
      youtubeId,
      order: Number.isFinite(order) ? order : 100,
      isActive,
      uploadedBy: auth.adminId || "unknown",
      uploadedByName: auth.name,
    });

    return NextResponse.json({ success: true, item: created.toObject() });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [Tutorials YouTube POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to add YouTube tutorial: " +
          (err instanceof Error ? err.message : "unknown error"),
      },
      { status: 500 },
    );
  }
}
