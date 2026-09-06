import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import TutorialUploadSession from "@/database/models/tutorial-upload-session.model";
import { getSessionTmpDir } from "@/lib/tutorials/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defensive cap — single chunk should never exceed ~8 MB (nginx limit is
// typically 10 MB). The init endpoint advertises 5 MB.
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * PUT /api/tutorials/upload/[sessionId]/chunk?index=N
 *
 * Body: raw binary chunk (Content-Type: application/octet-stream)
 *
 * Response:
 *   { success, receivedChunks: number, totalChunks: number, bytesReceived: number }
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    const url = new URL(req.url);
    const indexParam = url.searchParams.get("index");
    const index = Number(indexParam);

    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid chunk index" },
        { status: 400 },
      );
    }

    const session = await TutorialUploadSession.findOne({ sessionId });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Upload session not found" },
        { status: 404 },
      );
    }
    if (session.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `Session is ${session.status}` },
        { status: 409 },
      );
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 410 },
      );
    }
    // Reason: each session is owned by its uploader to prevent
    // cross-admin tampering with someone else's in-flight upload.
    if (session.adminId !== (auth.adminId || "")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    if (index >= session.totalChunks) {
      return NextResponse.json(
        { success: false, error: "Chunk index out of range" },
        { status: 400 },
      );
    }

    // Read the raw body
    const arrayBuf = await req.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length === 0) {
      return NextResponse.json(
        { success: false, error: "Empty chunk" },
        { status: 400 },
      );
    }
    if (buf.length > MAX_CHUNK_BYTES) {
      return NextResponse.json(
        { success: false, error: "Chunk exceeds 8 MB limit" },
        { status: 413 },
      );
    }
    // Last chunk may be smaller, but earlier chunks must equal chunkSize.
    const expectedSize =
      index === session.totalChunks - 1
        ? session.totalSize - index * session.chunkSize
        : session.chunkSize;
    if (buf.length !== expectedSize) {
      return NextResponse.json(
        {
          success: false,
          error: `Chunk size mismatch (got ${buf.length}, expected ${expectedSize})`,
        },
        { status: 400 },
      );
    }

    const sessionDir = await getSessionTmpDir(sessionId);
    const chunkPath = path.join(sessionDir, `${index}.part`);
    await writeFile(chunkPath, buf);

    // Idempotent update — if the same chunk arrives twice (retry), it
    // overwrites the file but the addToSet keeps the index unique.
    const updated = await TutorialUploadSession.findOneAndUpdate(
      { sessionId, status: "pending" },
      {
        $addToSet: { receivedChunks: index },
        // Increment bytesReceived only when index wasn't already received
        // — handled by reading first; simpler approach: recompute after.
      },
      { new: true },
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Session no longer pending" },
        { status: 409 },
      );
    }

    // Recompute bytesReceived from the set of received indexes — robust
    // against duplicate-chunk retries.
    const fullChunkBytes =
      (updated.receivedChunks.length -
        (updated.receivedChunks.includes(updated.totalChunks - 1) ? 1 : 0)) *
      updated.chunkSize;
    const lastChunkBytes = updated.receivedChunks.includes(
      updated.totalChunks - 1,
    )
      ? updated.totalSize - (updated.totalChunks - 1) * updated.chunkSize
      : 0;
    const bytesReceived = fullChunkBytes + lastChunkBytes;

    if (bytesReceived !== updated.bytesReceived) {
      updated.bytesReceived = bytesReceived;
      await updated.save();
    }

    return NextResponse.json({
      success: true,
      receivedChunks: updated.receivedChunks.length,
      totalChunks: updated.totalChunks,
      bytesReceived,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [tutorials chunk] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to receive chunk" },
      { status: 500 },
    );
  }
}
