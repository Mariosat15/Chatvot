import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { unlink } from "fs/promises";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import TutorialUploadSession from "@/database/models/tutorial-upload-session.model";
import { cleanupSessionTmpDir } from "@/lib/tutorials/sessions";
import { resolveWritableTutorialDir } from "@/lib/tutorials/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/tutorials/upload/[sessionId]
 *
 * Aborts a pending upload — deletes chunk files, deletes any
 * pre-uploaded thumbnail, marks the session aborted. Idempotent.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireAdminAuth();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    const session = await TutorialUploadSession.findOne({ sessionId });

    if (!session) {
      // Idempotent — return success even if it never existed.
      return NextResponse.json({ success: true });
    }
    if (session.adminId !== (auth.adminId || "")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Remove the orphaned thumbnail (if any) — it was stored eagerly
    // during init, before the rest of the upload was committed.
    if (session.thumbnailFilename) {
      try {
        const thumbDir = await resolveWritableTutorialDir("thumbnails");
        if (thumbDir) {
          await unlink(
            path.join(thumbDir, path.basename(session.thumbnailFilename)),
          );
        }
      } catch {
        // best-effort
      }
    }

    await cleanupSessionTmpDir(sessionId);

    if (session.status === "pending") {
      session.status = "aborted";
      await session.save();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [tutorials abort] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to abort upload" },
      { status: 500 },
    );
  }
}
