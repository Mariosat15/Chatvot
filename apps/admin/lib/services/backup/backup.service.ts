/**
 * Orchestrates database backup / restore operations.
 *
 * Heavy work (dumping / restoring collections) runs in the background so the
 * HTTP request returns immediately and never hits an NGINX / proxy timeout on
 * large databases. Progress and results are persisted to files on disk
 * (manifest per backup, a single restore-status file, a global lock file) so the
 * admin UI can poll for state and a crashed process leaves a recoverable trail.
 *
 * Restore always creates an automatic "pre-restore safety snapshot" first, so a
 * restore can itself be undone.
 */

import mongoose from "mongoose";
import type { Db } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import { dumpDatabase } from "./backup-dump";
import { restoreFromManifest } from "./backup-restore";
import {
  acquireLock,
  backupDir,
  deleteBackupDir,
  ensureBackupRoot,
  getBackupRoot,
  isStale,
  isValidBackupId,
  listBackupIds,
  readLock,
  readManifest,
  readRestoreStatus,
  releaseLock,
  writeManifest,
  writeRestoreStatus,
} from "./backup-paths";
import type {
  BackupKind,
  BackupManifest,
  BackupState,
  BackupSummary,
  RestoreStatus,
} from "./backup-types";

const APP_VERSION = process.env.APP_VERSION || "1.0.0";

// Keeps background promises referenced so they are not garbage collected while
// the request that started them has already returned.
const running = new Set<Promise<unknown>>();

function track(p: Promise<unknown>): void {
  running.add(p);
  void p.finally(() => running.delete(p));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function generateBackupId(kind: BackupKind): string {
  const d = new Date();
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(16).slice(2, 6);
  const prefix = kind === "pre_restore" ? "prerestore" : "backup";
  return `${prefix}_${ts}_${rand}`;
}

async function getDb(): Promise<Db> {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not available");
  return db as unknown as Db;
}

/**
 * Dump the current database into a backup folder and finalise its manifest.
 * Throws on failure (caller decides how to record it). Returns the completed
 * manifest.
 */
async function dumpAndFinalize(base: BackupManifest): Promise<BackupManifest> {
  await writeManifest(base); // visible as in_progress immediately
  const db = await getDb();
  const dump = await dumpDatabase(db, base.id);
  const completed: BackupManifest = {
    ...base,
    status: "completed",
    completedAt: new Date().toISOString(),
    collections: dump.collections,
    totalDocuments: dump.totalDocuments,
    totalSizeBytes: dump.totalSizeBytes,
  };
  await writeManifest(completed);
  return completed;
}

function baseManifest(
  id: string,
  label: string,
  kind: BackupKind,
  dbName: string,
  createdBy?: string,
): BackupManifest {
  return {
    id,
    label,
    kind,
    status: "in_progress",
    dbName,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    createdBy,
    collections: [],
    totalDocuments: 0,
    totalSizeBytes: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreateBackupInput {
  label?: string;
  createdBy?: string;
}

/** Start a manual backup in the background. Returns the new backup id. */
export async function createBackup(
  input: CreateBackupInput,
): Promise<{ id: string }> {
  await ensureBackupRoot();
  const db = await getDb();
  const id = generateBackupId("manual");
  const label =
    input.label?.trim() ||
    `Manual backup — ${new Date().toLocaleString("en-GB")}`;
  const base = baseManifest(
    id,
    label,
    "manual",
    db.databaseName,
    input.createdBy,
  );

  const locked = await acquireLock({
    op: "backup",
    id,
    startedAt: new Date().toISOString(),
    pid: process.pid,
  });
  if (!locked) {
    throw new Error(
      "Another backup or restore is already running. Please wait for it to finish.",
    );
  }

  await writeManifest(base);

  track(
    (async () => {
      try {
        await dumpAndFinalize(base);
      } catch (err) {
        await writeManifest({
          ...base,
          status: "failed",
          completedAt: new Date().toISOString(),
          error: (err as Error).message,
        }).catch(() => {});
        console.error("❌ [backup] Failed:", err);
      } finally {
        await releaseLock();
      }
    })(),
  );

  return { id };
}

/** List all snapshots (newest first) with live status. */
export async function listBackups(): Promise<BackupSummary[]> {
  const ids = await listBackupIds();
  const manifests = await Promise.all(ids.map((id) => readManifest(id)));
  const summaries: BackupSummary[] = [];

  for (const m of manifests) {
    if (!m) continue;
    const stale = m.status === "in_progress" && isStale(m.createdAt);
    summaries.push({
      id: m.id,
      label: m.label,
      kind: m.kind,
      status: m.status,
      dbName: m.dbName,
      createdAt: m.createdAt,
      completedAt: m.completedAt,
      createdBy: m.createdBy,
      collectionCount: m.collections?.length ?? 0,
      totalDocuments: m.totalDocuments ?? 0,
      totalSizeBytes: m.totalSizeBytes ?? 0,
      error: m.error,
      stale,
    });
  }

  summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return summaries;
}

/** Combined state for a single UI poll. */
export async function getBackupState(): Promise<BackupState> {
  const [backups, restore, lock] = await Promise.all([
    listBackups(),
    readRestoreStatus(),
    readLock(),
  ]);
  return { backups, restore, lock, backupRoot: getBackupRoot() };
}

/** Delete a snapshot from disk. */
export async function deleteBackup(id: string): Promise<void> {
  if (!isValidBackupId(id)) throw new Error("Invalid backup id");

  const lock = await readLock();
  if (lock && lock.id === id && !isStale(lock.startedAt)) {
    throw new Error("This backup is currently in progress and cannot be deleted.");
  }
  const restore = await readRestoreStatus();
  if (
    restore &&
    restore.status === "in_progress" &&
    !isStale(restore.startedAt) &&
    (restore.backupId === id || restore.safetyBackupId === id)
  ) {
    throw new Error("A restore using this backup is in progress.");
  }

  await deleteBackupDir(id);
}

/**
 * Start a restore in the background. Creates a pre-restore safety snapshot
 * first, then mirrors the database to the selected snapshot.
 */
export async function restoreBackup(
  id: string,
  createdBy?: string,
): Promise<{ started: true }> {
  if (!isValidBackupId(id)) throw new Error("Invalid backup id");

  const target = await readManifest(id);
  if (!target) throw new Error("Backup not found");
  if (target.status !== "completed") {
    throw new Error("Only completed backups can be restored");
  }

  const locked = await acquireLock({
    op: "restore",
    id,
    startedAt: new Date().toISOString(),
    pid: process.pid,
  });
  if (!locked) {
    throw new Error(
      "Another backup or restore is already running. Please wait for it to finish.",
    );
  }

  const status: RestoreStatus = {
    status: "in_progress",
    phase: "safety_backup",
    backupId: id,
    backupLabel: target.label,
    startedAt: new Date().toISOString(),
    collectionsRestored: 0,
    totalCollections: target.collections.length,
    createdBy,
  };
  await writeRestoreStatus(status);

  track(runRestore(target, status, createdBy));
  return { started: true };
}

async function runRestore(
  target: BackupManifest,
  status: RestoreStatus,
  createdBy?: string,
): Promise<void> {
  try {
    const db = await getDb();

    // 1) Automatic safety snapshot so this restore can be undone.
    const safetyId = generateBackupId("pre_restore");
    const safetyBase = baseManifest(
      safetyId,
      `Safety snapshot before restoring "${target.label}"`,
      "pre_restore",
      db.databaseName,
      createdBy,
    );
    await dumpAndFinalize(safetyBase);
    status = { ...status, safetyBackupId: safetyId, phase: "restoring" };
    await writeRestoreStatus(status);

    // 2) Mirror the database to the selected snapshot.
    await restoreFromManifest(db, target, async (p) => {
      status = {
        ...status,
        collectionsRestored: p.collectionsRestored,
        totalCollections: p.totalCollections,
      };
      await writeRestoreStatus(status).catch(() => {});
    });

    status = {
      ...status,
      status: "completed",
      phase: "done",
      finishedAt: new Date().toISOString(),
    };
    await writeRestoreStatus(status);
  } catch (err) {
    await writeRestoreStatus({
      ...status,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: (err as Error).message,
    }).catch(() => {});
    console.error("❌ [restore] Failed:", err);
  } finally {
    await releaseLock();
  }
}

/** Exposed for callers that only need the on-disk path (diagnostics). */
export function backupLocation(id: string): string {
  return backupDir(id);
}
