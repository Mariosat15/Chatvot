import { NextRequest, NextResponse } from "next/server";
import { createReadStream, createWriteStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { TutorialVideo } from "@/database/models/tutorial-video.model";
import TutorialUploadSession from "@/database/models/tutorial-upload-session.model";
import { resolveWritableTutorialDir } from "@/lib/tutorials/paths";
import { cleanupSessionTmpDir, getSessionTmpDir } from "@/lib/tutorials/sessions";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/tutorials/upload/[sessionId]/finalize
 *
 * Stitches the chunks for a completed session into the final video
 * file under <repo-root>/Videos/, creates a TutorialVideo row, and
 * removes the tmp folder.
 *
 * Response: { success, item }
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const { sessionId } = await ctx.params;

    const session = await TutorialUploadSession.findOne({ sessionId });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Upload session not found" },
        { status: 404 },
      );
    }
    if (session.adminId !== (auth.adminId || "")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    if (session.status === "completed") {
      return NextResponse.json(
        { success: false, error: "Session already completed" },
        { status: 409 },
      );
    }
    if (session.status === "aborted") {
      return NextResponse.json(
        { success: false, error: "Session was aborted" },
        { status: 410 },
      );
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 410 },
      );
    }

    // Check all chunks received
    if (session.receivedChunks.length !== session.totalChunks) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing chunks: have ${session.receivedChunks.length}/${session.totalChunks}`,
        },
        { status: 400 },
      );
    }

    const videoDir = await resolveWritableTutorialDir();
    if (!videoDir) {
      return NextResponse.json(
        { success: false, error: "No writable Videos directory" },
        { status: 500 },
      );
    }

    const sessionDir = await getSessionTmpDir(sessionId);
    const finalPath = path.join(videoDir, path.basename(session.filename));

    // Stream-concatenate chunks 0..N-1 into the final file.
    const writeStream = createWriteStream(finalPath);
    try {
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `${i}.part`);
        // Verify the chunk exists & is readable before piping.
        await stat(chunkPath);
        await pipeline(createReadStream(chunkPath), writeStream, {
          end: i === session.totalChunks - 1,
        });
      }
    } catch (concatErr) {
      writeStream.destroy();
      console.error("❌ [tutorials finalize] concat failed:", concatErr);
      return NextResponse.json(
        { success: false, error: "Failed to assemble video file" },
        { status: 500 },
      );
    }

    // Sanity-check final size
    const finalStat = await stat(finalPath);
    if (finalStat.size !== session.totalSize) {
      console.error(
        `❌ [tutorials finalize] size mismatch: got ${finalStat.size}, expected ${session.totalSize}`,
      );
      return NextResponse.json(
        { success: false, error: "Final file size mismatch" },
        { status: 500 },
      );
    }

    // Create the TutorialVideo row
    const created = await TutorialVideo.create({
      slug: session.slug,
      title: session.title,
      description: session.description,
      category: session.category,
      filename: session.filename,
      mimeType: session.mimeType,
      sizeBytes: session.totalSize,
      thumbnailFilename: session.thumbnailFilename,
      order: session.order,
      isActive: session.isActive,
      uploadedBy: session.adminId,
      uploadedByName: session.adminName,
    });

    session.status = "completed";
    session.finalizedAt = new Date();
    await session.save();

    // Remove tmp folder (best-effort, non-blocking).
    void cleanupSessionTmpDir(sessionId);

    return NextResponse.json({ success: true, item: created.toObject() });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [tutorials finalize] error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to finalize upload: " +
          (err instanceof Error ? err.message : "unknown error"),
      },
      { status: 500 },
    );
  }
}
