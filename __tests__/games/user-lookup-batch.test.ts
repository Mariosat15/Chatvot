import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";

// Reason: `user-lookup.ts` reads the raw `user` collection off the mongoose module itself
// (`(await connectToDatabase()).connection.db`), so the mock must be the module, not a
// connection.
vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose,
  default: async () => mongoose,
}));

import { getUsersByIds } from "../../lib/utils/user-lookup";

/**
 * The batch user lookup, which is what puts players' faces on a game leaderboard.
 *
 * WHY THIS IS TESTED AGAINST A REAL DATABASE RATHER THAN BY READING THE QUERY. The defect it
 * pins was a query FILTER, and a filter is exactly the thing a structural test cannot judge:
 * `{ id: { $in: ids } }` reads perfectly and returns nothing at all for an account whose
 * document keeps its identity in `_id`. Better Auth's MongoDB adapter does precisely that, so
 * `session.user.id` is an ObjectId string - which is why `getUserById` beside it has carried
 * three fallbacks since it was written, and why the batch version finding nobody produced no
 * error, no log line and a board of initials after the owner asked for avatars.
 *
 * The `id`-field case is asserted too. It is the shape the function was written for, and a
 * "fix" that only handled `_id` would swap one silent empty answer for another.
 */

const WITH_ID_FIELD = "68b5c1a2d4e5f60718293a41";
const OBJECT_ID_ONLY = "68b5c1a2d4e5f60718293a42";
const STRING_ID_ONLY = "user-string-id-42";

async function seedUsers() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("no database");

  await db.collection("user").insertMany([
    {
      _id: new ObjectId(WITH_ID_FIELD),
      id: WITH_ID_FIELD,
      name: "Marios Atticus",
      email: "marios@example.com",
      profileImage: "/uploads/marios.webp",
    },
    {
      _id: new ObjectId(OBJECT_ID_ONLY),
      name: "Maria Constantinou",
      email: "maria@example.com",
      // Better Auth's own field name, which the lookup resolves after `profileImage`.
      image: "/uploads/maria.webp",
    },
    {
      _id: STRING_ID_ONLY as unknown as ObjectId,
      name: "Andy Nicolaou",
      email: "andy@example.com",
    },
  ]);
}

describe("getUsersByIds", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
    await seedUsers();
  });

  it("finds a player whose identity lives in `_id` rather than in an `id` field", async () => {
    const users = await getUsersByIds([OBJECT_ID_ONLY]);

    // The id the CALLER passed is the key, because that is the string on the leaderboard row.
    const found = users.get(OBJECT_ID_ONLY);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Maria Constantinou");
    // `image` is Better Auth's field; a face stored there is the same face `/leaderboard` shows.
    expect(found?.profileImage).toBe("/uploads/maria.webp");
  });

  it("still finds a player with an `id` field, which is the shape it was written for", async () => {
    const users = await getUsersByIds([WITH_ID_FIELD]);
    expect(users.get(WITH_ID_FIELD)?.profileImage).toBe("/uploads/marios.webp");
  });

  it("finds a string `_id`, the third shape the single lookup handles", async () => {
    const users = await getUsersByIds([STRING_ID_ONLY]);
    expect(users.get(STRING_ID_ONLY)?.name).toBe("Andy Nicolaou");
  });

  it("answers for a mixed board in one query and omits an id it does not know", async () => {
    const users = await getUsersByIds([
      WITH_ID_FIELD,
      OBJECT_ID_ONLY,
      STRING_ID_ONLY,
      "68b5c1a2d4e5f60718293aff",
    ]);

    expect(users.size).toBe(3);
    expect(users.has("68b5c1a2d4e5f60718293aff")).toBe(false);
  });

  it("carries no picture for a player who has none, rather than an empty string", async () => {
    const users = await getUsersByIds([STRING_ID_ONLY]);
    // Reason: the board draws initials when `profileImage` is falsy, and an empty string would
    // reach `<ProfileImage src="">` instead - a broken image where a fallback belongs.
    expect(users.get(STRING_ID_ONLY)?.profileImage).toBeUndefined();
  });
});
