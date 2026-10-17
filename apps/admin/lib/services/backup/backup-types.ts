/**
 * Shared types for the database backup / restore feature.
 *
 * A "backup" is a point-in-time snapshot of the entire MongoDB database stored
 * on the server as a folder containing one gzipped NDJSON file per collection
 * (canonical Extended JSON, so BSON types survive a round-trip) plus a
 * manifest.json describing the snapshot.
 */

export type BackupStatus = "in_progress" | "completed" | "failed";

export type BackupKind = "manual" | "pre_restore";

/** Metadata captured for a single collection inside a snapshot. */
export interface BackupCollectionInfo {
  name: string;
  documents: number;
  sizeBytes: number;
  /** Raw index specs as returned by collection.indexes() (used on restore). */
  // Reason: index shapes vary (TTL, partial, text, collation) so we persist
  // the full spec and recreate them verbatim rather than reconstructing.
  indexes: Record<string, unknown>[];
  /** collection options (e.g. capped/size/max) captured from listCollections. */
  options?: Record<string, unknown>;
}

/** manifest.json written into every backup folder. */
export interface BackupManifest {
  id: string;
  label: string;
  kind: BackupKind;
  status: BackupStatus;
  dbName: string;
  appVersion: string;
  createdAt: string; // ISO
  completedAt?: string; // ISO
  createdBy?: string; // admin email
  collections: BackupCollectionInfo[];
  totalDocuments: number;
  totalSizeBytes: number;
  error?: string;
}

/** Lightweight shape returned to the admin UI list. */
export interface BackupSummary {
  id: string;
  label: string;
  kind: BackupKind;
  status: BackupStatus;
  dbName: string;
  createdAt: string;
  completedAt?: string;
  createdBy?: string;
  collectionCount: number;
  totalDocuments: number;
  totalSizeBytes: number;
  error?: string;
  /** True when an in_progress backup is old enough to be considered dead. */
  stale?: boolean;
}

export type RestorePhase =
  | "safety_backup"
  | "restoring"
  | "cleanup"
  | "done";

/** Current/last restore operation status (single global file). */
export interface RestoreStatus {
  status: BackupStatus;
  phase: RestorePhase;
  backupId: string;
  backupLabel: string;
  safetyBackupId?: string;
  startedAt: string;
  finishedAt?: string;
  collectionsRestored: number;
  totalCollections: number;
  error?: string;
  createdBy?: string;
}

/** Global operation lock to prevent concurrent backup/restore. */
export interface LockInfo {
  op: "backup" | "restore";
  id: string;
  startedAt: string;
  pid: number;
}

/** Combined state returned by the list endpoint for a single poll. */
export interface BackupState {
  backups: BackupSummary[];
  restore: RestoreStatus | null;
  lock: LockInfo | null;
  backupRoot: string;
}
