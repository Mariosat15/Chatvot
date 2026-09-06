import path from "path";
import { mkdir, rm } from "fs/promises";
import { resolveWritableTutorialDir } from "./paths";
import TutorialUploadSession from "@/database/models/tutorial-upload-session.model";

/**
 * Tmp-folder helpers for chunked tutorial uploads.
 *
 * Each in-flight upload owns its own folder at
 * `<Videos-root>/.tmp-uploads/<sessionId>/` containing one
 * `<chunkIndex>.part` file per chunk. The folder is removed on
 * finalize, abort, or by `gcExpiredSessions()`.
 */

const TMP_SUBDIR = ".tmp-uploads";

/**
 * Get (and create) the tmp folder for a session under the Videos root.
 * Throws if no writable Videos directory exists.
 */
export async function getSessionTmpDir(sessionId: string): Promise<string> {
  const videoDir = await resolveWritableTutorialDir();
  if (!videoDir) {
    throw new Error("No writable Videos directory available");
  }
  const tmpRoot = path.join(videoDir, TMP_SUBDIR);
  await mkdir(tmpRoot, { recursive: true });
  // Reason: path.basename guards against any sessionId that might
  // contain separators; UUIDs already won't, but defence in depth.
  const sessionDir = path.join(tmpRoot, path.basename(sessionId));
  await mkdir(sessionDir, { recursive: true });
  return sessionDir;
}

/**
 * Best-effort removal of a session's tmp folder. Never throws.
 */
export async function cleanupSessionTmpDir(sessionId: string): Promise<void> {
  try {
    const videoDir = await resolveWritableTutorialDir();
    if (!videoDir) return;
    const sessionDir = path.join(
      videoDir,
      TMP_SUBDIR,
      path.basename(sessionId),
    );
    await rm(sessionDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(
      `⚠️ [tutorials] failed to cleanup tmp dir for session ${sessionId}:`,
      err,
    );
  }
}

/**
 * Sweep abandoned upload sessions: mark them aborted and delete their
 * tmp folders. Called opportunistically from `init` so cleanup happens
 * even when the MongoDB TTL monitor hasn't fired yet, and runs
 * regardless of the number of admins online.
 */
export async function gcExpiredSessions(): Promise<number> {
  const now = new Date();
  const expired = await TutorialUploadSession.find({
    status: "pending",
    expiresAt: { $lt: now },
  })
    .select({ sessionId: 1 })
    .lean();

  if (expired.length === 0) return 0;

  await Promise.all(
    expired.map((s) => cleanupSessionTmpDir(s.sessionId)),
  );

  await TutorialUploadSession.updateMany(
    { _id: { $in: expired.map((s) => s._id) } },
    { $set: { status: "aborted" } },
  );

  return expired.length;
}
