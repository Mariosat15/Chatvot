import path from "path";
import { mkdir, writeFile, unlink } from "fs/promises";

/**
 * Resolves possible disk locations for the Tutorials Videos folder.
 *
 * Reason: PM2 launches the admin app with cwd=`<repo-root>/apps/admin`
 * (see ecosystem.config.js). The Videos folder lives at the REPO
 * ROOT, so from the admin's cwd that is `../../Videos`. We MUST try
 * that path FIRST, otherwise mkdir() will happily create a stray
 * `apps/admin/Videos/` that the main app (which runs from the repo
 * root) can never see, and uploads will 404 on playback.
 *
 * Order matters: the FIRST writable directory found is used for new
 * uploads. Subsequent directories are tried as fallbacks for reads.
 */
export function getTutorialVideoDirCandidates(): string[] {
  const cwd = process.cwd();
  return [
    // Repo root from apps/admin (the canonical, shared location)
    path.join(cwd, "..", "..", "Videos"),
    // Repo root if admin ever runs from there directly
    path.join(cwd, "Videos"),
    // Other monorepo layouts (apps/* sibling)
    path.join(cwd, "..", "Videos"),
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
