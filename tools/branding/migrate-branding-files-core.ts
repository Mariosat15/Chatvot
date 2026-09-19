/**
 * The decision half of the branding-file migration, separated from the CLI so it can be
 * tested against a real database.
 *
 * SPLIT FOR THE REASON EVERY MIGRATION HERE HAS BEEN: the most important property of one is
 * what it refuses to touch, and that is an assertion about a query filter - the thing people
 * get wrong. A file whose `main()` runs at module scope cannot be imported by a test at all,
 * so the filter would only ever be read.
 *
 * WHAT THIS MOVES. Every uploaded hero, branding and game image used to be base64-encoded
 * into the `brandingFiles` map on the single shared `WhiteLabel` document. On 8 September 2026
 * that document reached 17,070,874 bytes on a game-logo upload and MongoDB refused the write,
 * at which point NO image on the platform could be stored. The new store is one document per
 * file. This drains the map into it.
 *
 * WHY IT IS STILL NEEDED NOW THAT NOTHING WRITES THERE. Two reasons, and the second is the
 * one that will bite if it is skipped. The images already in the map are in a store that
 * cannot be added to, so the next upload of any kind fails until it has headroom. And every
 * one of the 67 files calling `WhiteLabel.findOne()` used to transfer the whole map - which
 * `select: false` now prevents, but a 16MB document still has to be read by anything asking
 * for the map at all, which the fallback read does on every miss.
 *
 * WHAT IT REFUSES TO DO, pinned by tests rather than asserted here:
 *
 *  - It never deletes a file from disk. Disk is the fast path and this is about the backup.
 *  - It never overwrites a collection entry that already exists. A file re-uploaded since
 *    8 September is NEWER than the map's copy, so copying the map over it would restore an
 *    image an operator has already replaced. The map entry is still cleared, because it is
 *    the stale one.
 *  - It clears a map entry only after the collection is confirmed to hold that filename -
 *    read back, not merely written. Clearing on a successful write alone trusts the write;
 *    clearing before it loses the image outright.
 *  - It leaves an entry whose `data` is missing or empty, and reports it. There is nothing to
 *    copy, and deleting it would be the only operation in here that destroys information.
 */

import type { Connection } from "mongoose";
import { decodeBrandingFileKey } from "../../lib/utils/branding-file-key";

export interface FileReport {
  filename: string;
  bytes: number;
  /** What this script did, or would do, with this entry. */
  outcome: "copied" | "already-stored" | "empty" | "failed";
  detail?: string;
}

export interface MigrationOutcome {
  files: FileReport[];
  /** Entries that would be, or were, removed from the map. */
  clearable: number;
  cleared: number;
  /** Decoded bytes the map is holding, which is what the document is spending. */
  totalBytes: number;
}

interface LegacyEntry {
  data?: string;
  contentType?: string;
}

interface SettingsRow {
  _id: unknown;
  brandingFiles?: Record<string, LegacyEntry>;
}

export async function migrateBrandingFiles(
  connection: Connection,
  options: { apply: boolean },
): Promise<MigrationOutcome> {
  const db = connection.db;
  if (!db) throw new Error("No database handle.");

  // Reason: read with the raw driver rather than the model. The map is `select: false`, so a
  // model read needs to ask for it by name - and this script must work against a document
  // written by an older build whatever the current schema says about it.
  const settings = (await db
    .collection("whitelabels")
    .findOne({}, { projection: { brandingFiles: 1 } })) as SettingsRow | null;

  const entries = Object.entries(settings?.brandingFiles ?? {});
  const outcome: MigrationOutcome = {
    files: [],
    clearable: 0,
    cleared: 0,
    totalBytes: 0,
  };

  if (!settings || entries.length === 0) return outcome;

  const assets = db.collection("branding_asset");

  for (const [key, entry] of entries) {
    const filename = decodeBrandingFileKey(key);
    const bytes = entry?.data ? Buffer.from(entry.data, "base64").length : 0;
    outcome.totalBytes += bytes;

    if (!entry?.data) {
      outcome.files.push({ filename, bytes: 0, outcome: "empty" });
      continue;
    }

    const existing = await assets.findOne({ filename });
    if (existing) {
      // Newer than the map's copy by definition - it can only have got there since the
      // store changed. Report it as stored and still clear the stale map entry.
      outcome.files.push({ filename, bytes, outcome: "already-stored" });
      outcome.clearable += 1;
      if (options.apply) {
        await clearEntry(db, settings._id, key);
        outcome.cleared += 1;
      }
      continue;
    }

    if (!options.apply) {
      outcome.files.push({ filename, bytes, outcome: "copied" });
      outcome.clearable += 1;
      continue;
    }

    try {
      await assets.updateOne(
        { filename },
        {
          $set: {
            data: entry.data,
            contentType: entry.contentType || "image/png",
            bytes,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Read back before clearing. A write that reported success and a write that landed
      // are different facts, and the difference here is an image nobody can recover.
      const stored = await assets.findOne({ filename }, { projection: { _id: 1 } });
      if (!stored) {
        outcome.files.push({
          filename,
          bytes,
          outcome: "failed",
          detail: "written but not found on read-back; map entry left alone",
        });
        continue;
      }

      await clearEntry(db, settings._id, key);
      outcome.files.push({ filename, bytes, outcome: "copied" });
      outcome.clearable += 1;
      outcome.cleared += 1;
    } catch (error) {
      outcome.files.push({
        filename,
        bytes,
        outcome: "failed",
        detail: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return outcome;
}

/**
 * `$unset` of one map path, so the document shrinks one image at a time.
 *
 * Reason it is not a whole-document rewrite: the document is at the 16MB ceiling, and a
 * `save()` of it is precisely the operation that has been failing. `$unset` on a single path
 * sends the path name and nothing else.
 */
async function clearEntry(
  db: NonNullable<Connection["db"]>,
  id: unknown,
  key: string,
): Promise<void> {
  await db
    .collection("whitelabels")
    .updateOne({ _id: id as never }, { $unset: { [`brandingFiles.${key}`]: "" } });
}
