import path from "path";
import { access } from "fs/promises";
import { constants } from "fs";

/**
 * Resolves possible disk locations for the Tutorials Videos folder.
 *
 * Reason: The Videos folder lives at the REPO ROOT (the canonical
 * location). The main app's cwd is the repo root, so cwd/Videos
 * resolves directly. We also include `apps/admin/Videos` as a
 * fallback so files that were uploaded BEFORE the admin's write path
 * was reordered to canonical-first (and may therefore be sitting in
 * the admin app's local Videos folder) are still served instead of
 * 404'ing.
 *
 * Mirror of `apps/admin/lib/tutorials/paths.ts` — keep both in sync.
 */
export function getTutorialVideoDirCandidates(): string[] {
  const cwd = process.cwd();
  return [
    // Canonical: repo root (the main app's cwd)
    path.join(cwd, "Videos"),
    // Fallback: admin's local folder if older uploads landed there
    path.join(cwd, "apps", "admin", "Videos"),
    // Unusual layouts
    path.join(cwd, "..", "Videos"),
    path.join(cwd, "..", "..", "Videos"),
  ];
}

export function getTutorialThumbnailDirCandidates(): string[] {
  return getTutorialVideoDirCandidates().map((p) =>
    path.join(p, "thumbnails"),
  );
}

/**
 * Locate an existing readable file by basename across all candidate
 * directories. Returns the absolute path or null.
 */
export async function findTutorialFile(
  filename: string,
  subfolder?: "thumbnails",
): Promise<string | null> {
  const safe = path.basename(filename);
  const bases = subfolder
    ? getTutorialThumbnailDirCandidates()
    : getTutorialVideoDirCandidates();
  for (const dir of bases) {
    const p = path.join(dir, safe);
    try {
      await access(p, constants.R_OK);
      return p;
    } catch {
      continue;
    }
  }
  return null;
}
