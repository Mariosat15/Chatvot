/**
 * Restore a database to the exact state captured in a backup snapshot ("restore
 * point"). For every collection in the snapshot we drop the live collection and
 * re-insert its documents, then recreate its indexes. Finally we drop any
 * collection that exists now but was not part of the snapshot, so the database
 * mirrors the snapshot precisely.
 *
 * Documents are streamed line-by-line and inserted in batches, so memory usage
 * stays bounded for large collections.
 */

import fs from "fs";
import zlib from "zlib";
import readline from "readline";
import {
  BSON,
  type Db,
  type Document,
  type CreateIndexesOptions,
  type IndexSpecification,
} from "mongodb";
import type { BackupManifest, BackupCollectionInfo } from "./backup-types";
import { collectionFilePath, encodeCollectionName } from "./backup-paths";

const INSERT_BATCH = 1000;

export interface RestoreProgress {
  collectionsRestored: number;
  totalCollections: number;
}

async function dropIfExists(db: Db, name: string): Promise<void> {
  try {
    await db.collection(name).drop();
  } catch (err) {
    // NamespaceNotFound (26) is fine — nothing to drop.
    const code = (err as { code?: number })?.code;
    if (code !== 26) throw err;
  }
}

/** Recreate a collection's non-_id indexes, best-effort. */
async function recreateIndexes(
  db: Db,
  info: BackupCollectionInfo,
): Promise<void> {
  const coll = db.collection(info.name);
  for (const raw of info.indexes || []) {
    const spec = raw as Record<string, unknown>;
    const name = spec.name as string | undefined;
    const key = spec.key as IndexSpecification | undefined;
    if (!key || name === "_id_") continue; // _id index is automatic

    // Reason: rebuild options from the persisted spec but strip fields that
    // are managed by the server and rejected by createIndex. Build via computed
    // object literals (not obj[key] = v) to avoid object-injection warnings.
    const skip = new Set(["v", "key", "ns", "name", "background"]);
    let options: Record<string, unknown> = { name };
    for (const [k, v] of Object.entries(spec)) {
      if (skip.has(k)) continue;
      options = { ...options, [k]: v };
    }
    try {
      await coll.createIndex(key, options as unknown as CreateIndexesOptions);
    } catch (err) {
      console.warn(
        `⚠️ [restore] Could not recreate index ${name} on ${info.name}:`,
        (err as Error).message,
      );
    }
  }
}

async function restoreOneCollection(
  db: Db,
  backupId: string,
  info: BackupCollectionInfo,
): Promise<void> {
  await dropIfExists(db, info.name);

  // Recreate capped collections with their original options before inserting.
  const opts = info.options || {};
  if (opts.capped) {
    try {
      await db.createCollection(info.name, {
        capped: true,
        size: Number(opts.size) || 0,
        ...(opts.max ? { max: Number(opts.max) } : {}),
      });
    } catch {
      // fall through — insert will create it if needed
    }
  }

  const coll = db.collection(info.name);
  const filePath = collectionFilePath(backupId, encodeCollectionName(info.name));

  let inserted = 0;
  if (fs.existsSync(filePath)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });
    let batch: Document[] = [];
    for await (const line of rl) {
      if (!line.trim()) continue;
      batch.push(BSON.EJSON.parse(line, { relaxed: false }) as Document);
      if (batch.length >= INSERT_BATCH) {
        await coll.insertMany(batch, { ordered: false });
        inserted += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await coll.insertMany(batch, { ordered: false });
      inserted += batch.length;
    }
  }

  // Ensure empty collections still exist so the snapshot is mirrored exactly.
  if (inserted === 0 && !opts.capped) {
    try {
      await db.createCollection(info.name);
    } catch {
      // already exists — ignore
    }
  }

  await recreateIndexes(db, info);
}

/** Drop collections that exist now but were not part of the snapshot. */
async function dropExtraCollections(
  db: Db,
  snapshotNames: Set<string>,
): Promise<void> {
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const c of infos) {
    if (c.name.startsWith("system.")) continue;
    if (snapshotNames.has(c.name)) continue;
    await dropIfExists(db, c.name);
  }
}

/**
 * Restore the database from a completed snapshot. onProgress fires after each
 * collection so the caller can persist progress to the restore-status file.
 */
export async function restoreFromManifest(
  db: Db,
  manifest: BackupManifest,
  onProgress?: (p: RestoreProgress) => void,
): Promise<void> {
  const total = manifest.collections.length;
  let done = 0;

  for (const info of manifest.collections) {
    await restoreOneCollection(db, manifest.id, info);
    done += 1;
    onProgress?.({ collectionsRestored: done, totalCollections: total });
  }

  const snapshotNames = new Set(manifest.collections.map((c) => c.name));
  await dropExtraCollections(db, snapshotNames);
}
