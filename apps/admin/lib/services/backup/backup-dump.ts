/**
 * Dump every collection of a MongoDB database to a backup folder.
 *
 * Each collection is streamed (cursor -> gzip -> file) so memory stays bounded
 * regardless of database size. Documents are serialised as canonical Extended
 * JSON (one per line) so BSON types (ObjectId, Date, Decimal128, ...) are
 * preserved exactly on restore.
 */

import fsp from "fs/promises";
import fs from "fs";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { BSON, type Db } from "mongodb";
import type { BackupCollectionInfo } from "./backup-types";
import { backupDir, collectionFilePath, encodeCollectionName } from "./backup-paths";

export interface DumpResult {
  collections: BackupCollectionInfo[];
  totalDocuments: number;
  totalSizeBytes: number;
}

/** Skip internal collections that must not (and cannot) be backed up/restored. */
function shouldSkip(name: string): boolean {
  return name.startsWith("system.");
}

async function listUserCollections(
  db: Db,
): Promise<{ name: string; options: Record<string, unknown> }[]> {
  const infos = await db.listCollections({}, { nameOnly: false }).toArray();
  return infos
    .filter((c) => c.type !== "view" && !shouldSkip(c.name))
    .map((c) => ({
      name: c.name,
      options: (c.options as Record<string, unknown>) || {},
    }));
}

async function dumpOneCollection(
  db: Db,
  backupId: string,
  name: string,
  options: Record<string, unknown>,
): Promise<BackupCollectionInfo> {
  const coll = db.collection(name);
  const safeName = encodeCollectionName(name);
  const filePath = collectionFilePath(backupId, safeName);

  const cursor = coll.find({}, { noCursorTimeout: false }).batchSize(500);
  let documents = 0;

  // Reason: an async generator + pipeline gives us automatic backpressure
  // between the Mongo cursor, the gzip transform and the file write stream.
  async function* toLines(): AsyncGenerator<string> {
    for await (const doc of cursor) {
      documents += 1;
      yield BSON.EJSON.stringify(doc, { relaxed: false }) + "\n";
    }
  }

  await pipeline(toLines(), zlib.createGzip(), fs.createWriteStream(filePath));

  const indexes = (await coll
    .indexes()
    .catch(() => [])) as Record<string, unknown>[];
  const stat = await fsp.stat(filePath).catch(() => null);

  return {
    name,
    documents,
    sizeBytes: stat?.size ?? 0,
    indexes,
    options,
  };
}

/**
 * Dump the whole database into an already-created backup folder.
 * onCollection is invoked after each collection so callers can update progress.
 */
export async function dumpDatabase(
  db: Db,
  backupId: string,
  onCollection?: (info: BackupCollectionInfo, index: number, total: number) => void,
): Promise<DumpResult> {
  await fsp.mkdir(backupDir(backupId), { recursive: true });

  const collections = await listUserCollections(db);
  const result: BackupCollectionInfo[] = [];
  let totalDocuments = 0;

  // Reason: iterate via entries() (not collections[i]) to avoid the
  // security/detect-object-injection lint on computed index access.
  for (const [i, item] of collections.entries()) {
    const info = await dumpOneCollection(db, backupId, item.name, item.options);
    result.push(info);
    totalDocuments += info.documents;
    onCollection?.(info, i + 1, collections.length);
  }

  const totalSizeBytes = result.reduce((sum, c) => sum + c.sizeBytes, 0);
  return { collections: result, totalDocuments, totalSizeBytes };
}
