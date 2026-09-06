/**
 * Filesystem helpers for the backup feature.
 *
 * Backups live in a single root directory on the server (default:
 * <repo-root>/backups, overridable with the BACKUP_DIR env var). The folder is
 * gitignored and never served over HTTP because snapshots contain every
 * document in the database, including secrets stored in settings collections.
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import type {
  BackupManifest,
  LockInfo,
  RestoreStatus,
} from "./backup-types";

const LOCK_FILE = ".lock.json";
const RESTORE_STATUS_FILE = ".restore-status.json";
const MANIFEST_FILE = "manifest.json";

/** in_progress backups/locks older than this are treated as dead (crash). */
export const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Only allow safe folder names to avoid any path traversal. */
export function isValidBackupId(id: string): boolean {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(id);
}

/** Resolve the backup root. process.cwd() for the admin app is apps/admin. */
export function getBackupRoot(): string {
  const fromEnv = process.env.BACKUP_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  // Reason: PM2 runs the admin app with cwd = <repo>/apps/admin, so the repo
  // root (and a deploy-stable location) is two levels up.
  return path.resolve(process.cwd(), "..", "..", "backups");
}

export async function ensureBackupRoot(): Promise<string> {
  const root = getBackupRoot();
  await fsp.mkdir(root, { recursive: true });
  return root;
}

export function backupDir(id: string): string {
  if (!isValidBackupId(id)) throw new Error("Invalid backup id");
  return path.join(getBackupRoot(), id);
}

export function manifestPath(id: string): string {
  return path.join(backupDir(id), MANIFEST_FILE);
}

export function collectionFilePath(id: string, safeName: string): string {
  return path.join(backupDir(id), `${safeName}.ndjson.gz`);
}

/** Encode a collection name into a filesystem-safe token (reversible enough). */
export function encodeCollectionName(name: string): string {
  return Buffer.from(name, "utf8").toString("hex");
}

export async function readManifest(id: string): Promise<BackupManifest | null> {
  try {
    const raw = await fsp.readFile(manifestPath(id), "utf8");
    return JSON.parse(raw) as BackupManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: BackupManifest): Promise<void> {
  const dir = backupDir(manifest.id);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(
    manifestPath(manifest.id),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

export async function listBackupIds(): Promise<string[]> {
  const root = await ensureBackupRoot();
  const entries = await fsp.readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && isValidBackupId(e.name))
    .map((e) => e.name);
}

export async function deleteBackupDir(id: string): Promise<void> {
  await fsp.rm(backupDir(id), { recursive: true, force: true });
}

/** Recursively sum file sizes under a directory. */
export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      try {
        const st = await fsp.stat(full);
        total += st.size;
      } catch {
        // ignore vanished temp files
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Global operation lock
// ---------------------------------------------------------------------------

function lockPath(): string {
  return path.join(getBackupRoot(), LOCK_FILE);
}

export async function readLock(): Promise<LockInfo | null> {
  try {
    const raw = await fsp.readFile(lockPath(), "utf8");
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

export function isStale(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Date.now() - t > STALE_MS : true;
}

/**
 * Try to acquire the global lock. Returns true on success. A stale lock (older
 * than STALE_MS, e.g. from a crashed process) is overwritten.
 */
export async function acquireLock(lock: LockInfo): Promise<boolean> {
  await ensureBackupRoot();
  const existing = await readLock();
  if (existing && !isStale(existing.startedAt)) return false;
  await fsp.writeFile(lockPath(), JSON.stringify(lock, null, 2), "utf8");
  return true;
}

export async function releaseLock(): Promise<void> {
  await fsp.rm(lockPath(), { force: true });
}

// ---------------------------------------------------------------------------
// Restore status (single global file)
// ---------------------------------------------------------------------------

function restoreStatusPath(): string {
  return path.join(getBackupRoot(), RESTORE_STATUS_FILE);
}

export async function readRestoreStatus(): Promise<RestoreStatus | null> {
  try {
    const raw = await fsp.readFile(restoreStatusPath(), "utf8");
    return JSON.parse(raw) as RestoreStatus;
  } catch {
    return null;
  }
}

export async function writeRestoreStatus(status: RestoreStatus): Promise<void> {
  await ensureBackupRoot();
  await fsp.writeFile(
    restoreStatusPath(),
    JSON.stringify(status, null, 2),
    "utf8",
  );
}
