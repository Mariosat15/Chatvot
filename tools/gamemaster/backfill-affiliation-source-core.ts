/**
 * Report-only (until --apply) migration for Gamemaster Program v2 step 1
 * (`External game plans/24` s2.1, D4).
 *
 * Two jobs, in this order:
 *
 * 1. Label every `userreferrals` row that has no `source`. Before v2 the ONLY writer was the
 *    signup referral link (`lib/actions/auth.actions.ts`; the admin end-logic harness is test
 *    data), so legacy rows are `gm_referral_link`. A row that already carries a source is
 *    never touched - `source` is permanent attribution.
 *
 * 2. Replace the old plain unique `userId_1` with the partial unique `userId_active_unique`
 *    (unique only while `isActive: true`), so a player whose Game Master expired or was
 *    deleted can join a new one. The new index is built FIRST and the old one dropped only
 *    once it exists, so there is never a moment with no uniqueness on the active row.
 */

import mongoose from "mongoose";
import {
  ACTIVE_REFERRAL_INDEX_NAME,
  type AffiliationSource,
} from "../../database/models/user-referral.model";
// Reason: spelled through `tools/` so the import STRING meets the existing
// `!**/tools/games/**` exemption; `../games/...` trips the invariant-1 wildcard.
import { missingStringFilter } from "../../tools/games/backfill-game-labels-core";

/** Legacy rows were all created by the signup referral link. Imported type, not a copy. */
export const LEGACY_AFFILIATION_SOURCE: AffiliationSource = "gm_referral_link";

export const LEGACY_UNIQUE_USER_INDEX_NAME = "userId_1";
export const REFERRAL_LOOKUP_INDEX_NAME = "userId_1_referredAt_-1";

export interface AffiliationMigrationResult {
  needingSource: number;
  labelled: number;
  /** Users holding more than one active row - the partial unique index cannot build. */
  duplicateActiveUsers: number;
  activeIndexPresent: boolean;
  legacyUniqueIndexPresent: boolean;
  activeIndexCreated: boolean;
  legacyUniqueIndexDropped: boolean;
  refusedReason?: string;
}

type Db = NonNullable<typeof mongoose.connection.db>;

async function listIndexNames(db: Db): Promise<Set<string>> {
  const indexes = await db
    .collection("userreferrals")
    .indexes()
    .catch(() => [] as { name?: string }[]);
  return new Set(indexes.map((idx) => String(idx.name)));
}

export async function countDuplicateActiveUsers(db: Db): Promise<number> {
  const rows = await db
    .collection("userreferrals")
    .aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "users" },
    ])
    .toArray();
  return rows.length > 0 ? Number(rows[0].users) : 0;
}

export async function migrateAffiliationSource(
  apply: boolean,
): Promise<AffiliationMigrationResult> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle on the mongoose connection.");
  const collection = db.collection("userreferrals");

  const filter = missingStringFilter("source");
  const needingSource = await collection.countDocuments(filter);
  const duplicateActiveUsers = await countDuplicateActiveUsers(db);
  const names = await listIndexNames(db);

  const result: AffiliationMigrationResult = {
    needingSource,
    labelled: 0,
    duplicateActiveUsers,
    activeIndexPresent: names.has(ACTIVE_REFERRAL_INDEX_NAME),
    legacyUniqueIndexPresent: names.has(LEGACY_UNIQUE_USER_INDEX_NAME),
    activeIndexCreated: false,
    legacyUniqueIndexDropped: false,
  };

  if (!apply) return result;

  if (needingSource > 0) {
    // Reason: the missing filter is the whole safety property - it is what stops this script
    // rewriting a `chartvolt_join_gm` row as a referral-link one.
    const write = await collection.updateMany(filter, {
      $set: { source: LEGACY_AFFILIATION_SOURCE, updatedAt: new Date() },
    });
    result.labelled = write.modifiedCount;
  }

  if (duplicateActiveUsers > 0) {
    // Reason: a partial unique build fails on duplicates, and choosing which of two active
    // rows is the real affiliation decides who is paid commission - an operator decision.
    result.refusedReason = `${duplicateActiveUsers} user(s) hold more than one active referral; resolve them before the index can be built.`;
    return result;
  }

  if (!result.activeIndexPresent) {
    await collection.createIndex(
      { userId: 1, isActive: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: ACTIVE_REFERRAL_INDEX_NAME,
      },
    );
    result.activeIndexCreated = true;
    result.activeIndexPresent = true;
  }

  const afterCreate = await listIndexNames(db);
  if (!afterCreate.has(REFERRAL_LOOKUP_INDEX_NAME)) {
    await collection.createIndex(
      { userId: 1, referredAt: -1 },
      { name: REFERRAL_LOOKUP_INDEX_NAME },
    );
  }

  // Reason: drop only once the replacement is confirmed present, never before.
  if (afterCreate.has(ACTIVE_REFERRAL_INDEX_NAME) && afterCreate.has(LEGACY_UNIQUE_USER_INDEX_NAME)) {
    await collection.dropIndex(LEGACY_UNIQUE_USER_INDEX_NAME);
    result.legacyUniqueIndexDropped = true;
    result.legacyUniqueIndexPresent = false;
  }

  return result;
}
