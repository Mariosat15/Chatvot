import { ObjectId, type Db } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import { invalidateUserCaches } from "@/lib/utils/cache";
import { validateUsername } from "@/lib/utils/username";

/**
 * Username storage on the Better Auth `user` collection.
 *
 * Two fields: `username` (as the player typed it, shown to others) and `usernameLower`
 * (the uniqueness key). Uniqueness is enforced by a unique index rather than by a
 * read-then-write check, because two sign-ups racing for one name both pass the check.
 * The index is partial on `$type: "string"` so accounts predating usernames - which hold
 * no key at all - do not collide with each other on a shared missing value.
 */

const USER_COLLECTION = "user";
const USERNAME_INDEX_NAME = "usernameLower_unique";

let indexEnsured: Promise<void> | null = null;

export function ensureUsernameIndex(db: Db): Promise<void> {
  if (!indexEnsured) {
    indexEnsured = db
      .collection(USER_COLLECTION)
      .createIndex(
        { usernameLower: 1 },
        {
          name: USERNAME_INDEX_NAME,
          unique: true,
          partialFilterExpression: { usernameLower: { $type: "string" } },
        },
      )
      .then(() => undefined)
      .catch((error) => {
        indexEnsured = null;
        console.error("❌ Failed to ensure username index:", error);
      });
  }
  return indexEnsured;
}

async function getDb(): Promise<Db | null> {
  const mongoose = await connectToDatabase();
  return (mongoose.connection.db as unknown as Db) ?? null;
}

/** The three shapes a Better Auth user id takes in this collection (R68). */
export function userIdFilter(userId: string): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ id: userId }, { _id: userId }];
  if (ObjectId.isValid(userId)) or.push({ _id: new ObjectId(userId) });
  return { $or: or };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export type UsernameAvailability =
  | { available: true; value: string }
  | { available: false; error: string };

export async function checkUsernameAvailability(
  raw: unknown,
  excludeUserId?: string,
): Promise<UsernameAvailability> {
  const parsed = validateUsername(raw);
  if (!parsed.ok) return { available: false, error: parsed.error };

  const db = await getDb();
  if (!db) {
    return {
      available: false,
      error: "Something went wrong. Please contact support.",
    };
  }

  const existing = await db
    .collection(USER_COLLECTION)
    .findOne(
      { usernameLower: parsed.key },
      { projection: { _id: 1, id: 1 } },
    );

  if (existing) {
    const ownerIds = [existing.id, existing._id]
      .filter((v) => v !== undefined && v !== null)
      .map(String);
    if (!excludeUserId || !ownerIds.includes(excludeUserId)) {
      return { available: false, error: "That username is already taken" };
    }
  }
  return { available: true, value: parsed.value };
}

export type SetUsernameResult =
  | { success: true; username: string; previous?: string }
  | { success: false; error: string; code: "invalid" | "taken" | "not_found" | "error" };

/**
 * Sets (or changes) a user's username. The unique index decides a race: the loser gets
 * `taken` rather than a duplicate.
 */
export async function setUsername(
  userId: string,
  raw: unknown,
): Promise<SetUsernameResult> {
  const parsed = validateUsername(raw);
  if (!parsed.ok) return { success: false, error: parsed.error, code: "invalid" };

  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        error: "Something went wrong. Please contact support.",
        code: "error",
      };
    }
    await ensureUsernameIndex(db);

    const before = await db
      .collection(USER_COLLECTION)
      .findOneAndUpdate(
        userIdFilter(userId),
        { $set: { username: parsed.value, usernameLower: parsed.key } },
        { returnDocument: "before", projection: { username: 1 } },
      );

    if (!before) {
      return { success: false, error: "User not found", code: "not_found" };
    }

    invalidateUserCaches(userId);
    const previous =
      typeof before.username === "string" ? before.username : undefined;
    return { success: true, username: parsed.value, previous };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        success: false,
        error: "That username is already taken",
        code: "taken",
      };
    }
    console.error("❌ setUsername failed:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
      code: "error",
    };
  }
}
