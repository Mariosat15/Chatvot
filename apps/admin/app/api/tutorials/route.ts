import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import {
  TutorialVideo,
  TUTORIAL_CATEGORIES,
  type TutorialCategory,
} from "@/database/models/tutorial-video.model";
import { resolveWritableTutorialDir } from "@/lib/tutorials/paths";

// Reason: Tutorial videos can be up to ~200 MB. Default Next.js body
// parsing is fine via `request.formData()` on Node runtime, but we
// must explicitly opt out of edge runtime and extend response time.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_THUMB_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);
const ALLOWED_THUMB_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `video-${Date.now()}`;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/ogg":
      return "ogv";
    case "video/quicktime":
      return "mov";
    default:
      return "bin";
  }
}

// GET /api/tutorials — list all tutorials (admin view)
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const items = await TutorialVideo.find({})
      .sort({ category: 1, order: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, items });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [Tutorials GET] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to list tutorials" },
      { status: 500 },
    );
  }
}

// POST /api/tutorials — upload + create
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const thumb = form.get("thumbnail") as File | null;
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "other") as TutorialCategory;
    const order = Number(form.get("order") || 100);
    const isActive = String(form.get("isActive") ?? "true") !== "false";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No video file provided" },
        { status: 400 },
      );
    }
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 },
      );
    }
    if (!ALLOWED_VIDEO_MIMES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported video type: ${file.type}. Use MP4 or WebM.`,
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Video too large (${Math.round(file.size / 1024 / 1024)} MB). Max 200 MB.`,
        },
        { status: 400 },
      );
    }
    if (!TUTORIAL_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid category" },
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

    // Resolve disk
    const videoDir = await resolveWritableTutorialDir();
    if (!videoDir) {
      return NextResponse.json(
        { success: false, error: "No writable Videos directory available" },
        { status: 500 },
      );
    }

    const filename = `${slug}-${Date.now()}.${extFromMime(file.type)}`;
    const videoPath = path.join(videoDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(videoPath, buffer);

    // Optional thumbnail
    let thumbnailFilename: string | undefined;
    if (thumb && thumb.size > 0) {
      if (!ALLOWED_THUMB_MIMES.has(thumb.type)) {
        return NextResponse.json(
          { success: false, error: "Thumbnail must be PNG, JPEG, or WebP" },
          { status: 400 },
        );
      }
      if (thumb.size > MAX_THUMB_BYTES) {
        return NextResponse.json(
          { success: false, error: "Thumbnail too large (max 2 MB)" },
          { status: 400 },
        );
      }
      const thumbDir = await resolveWritableTutorialDir("thumbnails");
      if (thumbDir) {
        try {
          const thumbBuf = Buffer.from(await thumb.arrayBuffer());
          const optimized = await sharp(thumbBuf)
            .resize(640, 360, { fit: "cover", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          thumbnailFilename = `${slug}-${Date.now()}.webp`;
          await writeFile(path.join(thumbDir, thumbnailFilename), optimized);
        } catch (thumbErr) {
          console.warn(
            "⚠️ [Tutorials POST] Thumbnail processing failed, continuing without:",
            thumbErr,
          );
          thumbnailFilename = undefined;
        }
      }
    }

    const created = await TutorialVideo.create({
      slug,
      title,
      description,
      category,
      filename,
      mimeType: file.type,
      sizeBytes: file.size,
      thumbnailFilename,
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
    console.error("❌ [Tutorials POST] error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to upload tutorial: " +
          (err instanceof Error ? err.message : "unknown error"),
      },
      { status: 500 },
    );
  }
}

// Helper exported for re-use by [id]/route.ts
export async function deleteTutorialFile(
  filename: string,
  subfolder?: "thumbnails",
): Promise<void> {
  // Try every candidate dir; remove whatever exists.
  const dir = await resolveWritableTutorialDir(subfolder);
  if (!dir) return;
  const target = path.join(dir, path.basename(filename));
  try {
    await stat(target);
    await unlink(target);
  } catch {
    // File missing — nothing to do
  }
}
