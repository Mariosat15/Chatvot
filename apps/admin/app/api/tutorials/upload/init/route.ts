import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { TutorialVideo, TUTORIAL_CATEGORIES, type TutorialCategory } from "@/database/models/tutorial-video.model";
import TutorialUploadSession from "@/database/models/tutorial-upload-session.model";
import { resolveWritableTutorialDir } from "@/lib/tutorials/paths";
import { gcExpiredSessions, getSessionTmpDir } from "@/lib/tutorials/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — safely under any 10 MB proxy cap
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_THUMB_BYTES = 2 * 1024 * 1024;

function isAllowedVideoMime(mime: string): boolean {
  switch (mime) {
    case "video/mp4":
    case "video/webm":
    case "video/ogg":
    case "video/quicktime":
      return true;
    default:
      return false;
  }
}

function isAllowedThumbMime(mime: string): boolean {
  switch (mime) {
    case "image/png":
    case "image/jpeg":
    case "image/jpg":
    case "image/webp":
      return true;
    default:
      return false;
  }
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
 * POST /api/tutorials/upload/init
 *
 * Body (JSON):
 *   {
 *     title, description?, category, order?, isActive?,
 *     mimeType, totalSize,
 *     thumbnail?: { mimeType, base64 }    // optional, <= 2 MB total
 *   }
 *
 * Response:
 *   { success, sessionId, chunkSize, totalChunks, expiresAt }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    // Opportunistic cleanup — cheap, runs at most once per upload start.
    void gcExpiredSessions().catch(() => undefined);

    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "other") as TutorialCategory;
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 100;
    const isActive = body.isActive !== false;
    const mimeType = String(body.mimeType || "");
    const totalSize = Number(body.totalSize);

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
    if (!isAllowedVideoMime(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported video type: ${mimeType}. Use MP4 or WebM.`,
        },
        { status: 400 },
      );
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid totalSize" },
        { status: 400 },
      );
    }
    if (totalSize > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Video too large (${Math.round(totalSize / 1024 / 1024)} MB). Max 200 MB.`,
        },
        { status: 400 },
      );
    }

    // Ensure slug is unique on the TutorialVideo collection.
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

    const filename = `${slug}-${Date.now()}.${extFromMime(mimeType)}`;
    const sessionId = randomUUID();
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // Optional inline thumbnail (base64) — small enough to fit in this JSON body.
    let thumbnailFilename: string | undefined;
    if (body.thumbnail && body.thumbnail.base64) {
      const thumbMime = String(body.thumbnail.mimeType || "");
      if (!isAllowedThumbMime(thumbMime)) {
        return NextResponse.json(
          { success: false, error: "Thumbnail must be PNG, JPEG, or WebP" },
          { status: 400 },
        );
      }
      const thumbBuf = Buffer.from(String(body.thumbnail.base64), "base64");
      if (thumbBuf.length === 0 || thumbBuf.length > MAX_THUMB_BYTES) {
        return NextResponse.json(
          { success: false, error: "Thumbnail too large (max 2 MB)" },
          { status: 400 },
        );
      }
      const thumbDir = await resolveWritableTutorialDir("thumbnails");
      if (thumbDir) {
        try {
          const optimized = await sharp(thumbBuf)
            .resize(640, 360, { fit: "cover", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          thumbnailFilename = `${slug}-${Date.now()}.webp`;
          await writeFile(path.join(thumbDir, thumbnailFilename), optimized);
        } catch (thumbErr) {
          console.warn(
            "⚠️ [tutorials init] Thumbnail processing failed, continuing without:",
            thumbErr,
          );
          thumbnailFilename = undefined;
        }
      }
    }

    // Ensure tmp dir exists before we hand the sessionId back to the client.
    await getSessionTmpDir(sessionId);

    const session = await TutorialUploadSession.create({
      sessionId,
      adminId: auth.adminId || "unknown",
      adminName: auth.name,
      title,
      description,
      category,
      order,
      isActive,
      slug,
      filename,
      thumbnailFilename,
      mimeType,
      totalSize,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      receivedChunks: [],
      bytesReceived: 0,
      status: "pending",
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      expiresAt,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [tutorials init] error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to start upload: " +
          (err instanceof Error ? err.message : "unknown error"),
      },
      { status: 500 },
    );
  }
}
