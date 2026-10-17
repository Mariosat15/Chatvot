/**
 * Announcing a model's writes as live events, from the schema itself.
 *
 * Reason it lives on the schema rather than at each call site: a competition is
 * written by admin create, publish, the Game Master routes, entry, the status
 * cron, finalization, cancellation and the emergency path, in both apps. A
 * call per writer is a list somebody forgets to extend, and a screen that is
 * not told stays stale with no error anywhere. Raw-driver writers bypass these
 * hooks and publish for themselves.
 *
 * Mirrored byte for byte into `apps/admin`; a test pins the two copies.
 */
import type { Query, Schema } from "mongoose";
import { publishLiveEvent, type LiveTopic } from "./live-events";

type Fields = Record<string, unknown>;

/** Who hears a change to this document. `undefined` means every signed-in player. */
export type LiveAudience = (doc: Fields) => readonly string[] | undefined;

// Reason: a join, a status change and a finalization can each write the same
// document several times inside a few milliseconds, and a screen only needs
// to hear once. It also lets a transaction commit before screens re-read.
const COALESCE_MS = 250;
const pending = new Set<string>();

function idOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) {
    const text = String(value);
    return /^[a-f0-9]{24}$/i.test(text) ? text : undefined;
  }
  return undefined;
}

export function announceLiveChange(
  topic: LiveTopic,
  id?: string,
  userIds?: readonly string[],
): void {
  // Reason: the suite saves thousands of documents with no socket server running.
  if (process.env.VITEST) return;
  const key = `${topic}|${id ?? ""}|${userIds ? userIds.join(",") : "*"}`;
  if (pending.has(key)) return;
  pending.add(key);
  setTimeout(() => {
    pending.delete(key);
    publishLiveEvent(topic, { id, userIds });
  }, COALESCE_MS).unref?.();
}

/**
 * A directed challenge concerns its two players. An open one is listed for
 * everybody, and taking the seat must clear it from every other Open tab, so
 * it stays a broadcast for its whole life.
 */
export const challengeAudience: LiveAudience = (doc) => {
  if (doc.openToAnyone === true) return undefined;
  const parties = [doc.challengerId, doc.challengedId].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return parties.length > 0 ? parties : undefined;
};

function announceDoc(topic: LiveTopic, audience: LiveAudience | undefined, doc: unknown): void {
  if (!doc || typeof doc !== "object") return;
  const fields = doc as Fields;
  announceLiveChange(topic, idOf(fields._id), audience?.(fields));
}

function announceQuery(topic: LiveTopic, query: Query<unknown, unknown>): void {
  // Reason: an update by filter has no document in hand, so the id comes from
  // the filter when it names one, and the audience is everybody.
  announceLiveChange(topic, idOf(query.getFilter()._id));
}

function changedCount(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const r = result as { modifiedCount?: number; upsertedCount?: number; deletedCount?: number };
  return (r.modifiedCount ?? 0) + (r.upsertedCount ?? 0) + (r.deletedCount ?? 0);
}

export function attachLiveEventHooks(
  schema: Schema,
  topic: LiveTopic,
  audience?: LiveAudience,
): void {
  // Reason: `save()` on an unmodified document writes nothing and still runs
  // post hooks, so the decision is taken before the save.
  schema.pre("save", function () {
    this.$locals.liveChanged = this.isNew || this.isModified();
  });
  schema.post("save", function (doc) {
    if (this.$locals.liveChanged) announceDoc(topic, audience, doc);
  });

  // Reason: only writes that changed something are announced, so a guarded
  // no-op update (a lock that lost, a sweep with nothing to do) stays silent.
  schema.post(["updateOne", "updateMany", "deleteOne", "deleteMany"], { document: false, query: true }, function (result: unknown) {
    if (changedCount(result) > 0) announceQuery(topic, this as Query<unknown, unknown>);
  });

  schema.post(["findOneAndUpdate", "findOneAndDelete", "findOneAndReplace"], function (doc: unknown) {
    announceDoc(topic, audience, doc);
  });

  schema.post("insertMany", function (docs: unknown) {
    if (Array.isArray(docs)) for (const doc of docs) announceDoc(topic, audience, doc);
  });
}
