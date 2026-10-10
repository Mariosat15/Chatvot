import { ObjectId } from "mongodb";

/**
 * A query filter matching a Better Auth `user` document by any of the shapes its id takes.
 *
 * Reason: Better Auth's MongoDB adapter keeps the identity in `_id`, so `session.user.id` is an
 * ObjectId string and many documents have no `id` field at all. A filter on `{ id }` alone
 * matches nothing for those accounts, with no error and nothing in a log - the R68 defect that
 * hid every leaderboard avatar. `getUsersByIds` fixed it for one reader; this is the same three
 * shapes for every other raw-driver lookup.
 *
 * Model-free and mirrored into `apps/admin` byte for byte (pinned by a test).
 */
export function userIdFilter(userIds: readonly string[]): Record<string, unknown> {
  const ids = [...new Set(userIds.filter((id) => typeof id === "string" && id !== ""))];
  const clauses: Record<string, unknown>[] = [{ id: { $in: ids } }];
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (objectIds.length > 0) clauses.push({ _id: { $in: objectIds } });
  clauses.push({ _id: { $in: ids } });
  return { $or: clauses };
}

/**
 * Every string a caller might hold for this user document: the declared `id` and the `_id`.
 * Index results under all of them, or a document found through `_id` is fetched and then
 * missed when the caller looks it up by the string it passed in.
 */
export function userDocumentIds(doc: { id?: unknown; _id?: unknown }): string[] {
  const out: string[] = [];
  if (doc.id) out.push(String(doc.id));
  if (doc._id) {
    const documentId = String(doc._id);
    if (!out.includes(documentId)) out.push(documentId);
  }
  return out;
}
