import path from "path";
import { mkdir, writeFile, unlink } from "fs/promises";

/**
 * Resolves possible disk locations for the Tutorials Videos folder.
 *
 * Reason: This repo can run from two cwd's depending on which Next.js
 * process is calling — the main app at the repo root or the admin app
 * under apps/admin. The Videos folder lives at the REPO ROOT (so it is
 * committed to git and shared between whitelabel deployments), so we
 * walk up to find it.
 *
 * Order matters: the FIRST writable directory found is used for new
 * uploads. The other directories are tried as fallbacks for reads.
 */
export function getTutorialVideoDirCandidates(): string[] {
  // From repo root (main app): cwd/Videos
  // From apps/admin: cwd/../../Videos
  // From any other monorepo layout: cwd/../Videos
  return [
    path.join(process.cwd(), "Videos"),
    path.join(process.cwd(), "..", "Videos"),
    path.join(process.cwd(), "..", "..", "Videos"),
  ];
}

export function getTutorialThumbnailDirCandidates(): string[] {
  return getTutorialVideoDirCandidates().map((p) =>
    path.join(p, "thumbnails"),
  );
}

/**
 * Find (or create) the first writable Videos directory.
 * Returns the absolute path or null if every candidate fails.
 */
export async function resolveWritableTutorialDir(
  subfolder?: "thumbnails",
): Promise<string | null> {
  const bases = subfolder
    ? getTutorialThumbnailDirCandidates()
    : getTutorialVideoDirCandidates();

  for (const dir of bases) {
    try {
      await mkdir(dir, { recursive: true });
      const testFile = path.join(dir, ".write-test");
      await writeFile(testFile, "ok");
      try {
        await unlink(testFile);
      } catch {
        // Cleanup is best-effort
      }
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}
