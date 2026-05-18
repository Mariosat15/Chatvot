import path from "path";
import { access } from "fs/promises";
import { constants } from "fs";

/**
 * Resolves possible disk locations for the Tutorials Videos folder.
 *
 * Reason: The Videos folder lives at the REPO ROOT and is committed
 * to git so it ships with every whitelabel deployment. The main app
 * runs at the repo root (cwd === root), but we still allow fallbacks
 * for unusual deployment layouts.
 *
 * Mirror of `apps/admin/lib/tutorials/paths.ts` — keep both in sync.
 */
export function getTutorialVideoDirCandidates(): string[] {
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
