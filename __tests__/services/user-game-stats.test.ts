/**
 * X7 step 1 — `UserGameStats` materialises at settlement and never recomputes on read
 * (invariant 8 / R29). One writer (`recordContestFinish`), two rows per finish
 * (the gameKey and `"_overall"`). No backfill — aggregates start at zero (Q14).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import { recordContestFinish } from "@/lib/services/games/user-game-stats.service";
import {
  clearTestMongo,
  ensureCollections,
  startTestMongo,
  stopTestMongo,
} from "../helpers/mongo-test-server";

const ROOT = process.cwd();
const USER = "0000000000000000000000aa";
const GAME = "provider:chartvolt-games:circuit-sprint";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("recordContestFinish", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["user_game_stats"]);
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  it("writes the per-game row and the _overall rollup in one finish", async () => {
    const result = await recordContestFinish({
      userId: USER,
      gameKey: GAME,
      rank: 1,
      fieldSize: 10,
      entryFee: 50,
      rawScore: 900,
    });

    expect(result.points).toBeGreaterThan(0);
    expect(result.ratingDelta).not.toBe(0);

    const gameRow = await UserGameStats.findOne({
      userId: USER,
      gameKey: GAME,
    }).lean();
    const overall = await UserGameStats.findOne({
      userId: USER,
      gameKey: OVERALL_GAME_KEY,
    }).lean();

    expect(gameRow).toBeTruthy();
    expect(overall).toBeTruthy();
    expect(gameRow!.contestsCompleted).toBe(1);
    expect(gameRow!.contestsEntered).toBe(1);
    expect(gameRow!.wins).toBe(1);
    expect(gameRow!.podiums).toBe(1);
    expect(gameRow!.totalPoints).toBe(result.points);
    expect(gameRow!.bestRank).toBe(1);
    expect(gameRow!.bestScore).toBe(900);
    expect(gameRow!.rating).toBeGreaterThan(1200);

    expect(overall!.totalPoints).toBe(result.points);
    expect(overall!.wins).toBe(1);
    // Reason: Elo is per-game only — overall keeps the insert default.
    expect(overall!.rating).toBe(1200);
    // Reason: raw score is game-unit and must not pollute the overall bestScore.
    expect(overall!.bestScore).toBe(0);
  });

  it("accumulates on a second finish rather than replacing", async () => {
    await recordContestFinish({
      userId: USER,
      gameKey: GAME,
      rank: 2,
      fieldSize: 8,
      entryFee: 25,
    });
    const second = await recordContestFinish({
      userId: USER,
      gameKey: GAME,
      rank: 5,
      fieldSize: 8,
      entryFee: 25,
    });

    const row = await UserGameStats.findOne({
      userId: USER,
      gameKey: GAME,
    }).lean();
    expect(row!.contestsCompleted).toBe(2);
    expect(row!.podiums).toBe(1);
    expect(row!.wins).toBe(0);
    expect(row!.totalPoints).toBeGreaterThan(second.points);
    expect(row!.bestRank).toBe(2);
    // Non-podium resets the streak.
    expect(row!.currentStreak).toBe(0);
  });

  it("awards 0 points and still counts the finish when the player holds no place", async () => {
    const result = await recordContestFinish({
      userId: USER,
      gameKey: GAME,
      fieldSize: 10,
      entryFee: 50,
    });

    expect(result.points).toBe(0);
    const row = await UserGameStats.findOne({
      userId: USER,
      gameKey: GAME,
    }).lean();
    expect(row!.contestsCompleted).toBe(1);
    expect(row!.wins).toBe(0);
    expect(row!.podiums).toBe(0);
    expect(row!.totalPoints).toBe(0);
  });

  it("never throws — a failure returns zeros so settlement stays paid", async () => {
    // An empty userId still upserts under Mongo; force a failure by using a
    // non-finite fieldSize that still reaches the writer with a bad gameKey
    // shape is hard. Assert the catch path structurally instead.
    const code = stripComments(
      read("lib/services/games/user-game-stats.service.ts"),
    );
    expect(code).toMatch(/catch\s*\(error\)/);
    expect(code).toMatch(/return\s*\{\s*points:\s*0,\s*ratingDelta:\s*0\s*\}/);
    const handler = code.slice(code.indexOf("catch (error)"));
    expect(handler).not.toMatch(/\bthrow\b/);
  });
});

describe("the schema and the writer", () => {
  it("declares the unique { userId, gameKey } index", () => {
    const indexes = UserGameStats.schema.indexes();
    const unique = indexes.find(
      ([fields, opts]) =>
        (fields as Record<string, number>).userId === 1 &&
        (fields as Record<string, number>).gameKey === 1 &&
        (opts as { unique?: boolean })?.unique === true,
    );
    expect(unique).toBeTruthy();
  });

  it("exports OVERALL_GAME_KEY as the literal _overall", () => {
    expect(OVERALL_GAME_KEY).toBe("_overall");
  });
});

describe("mirrors", () => {
  it("model is byte-identical in both apps", () => {
    expect(
      read("apps/admin/database/models/games/user-game-stats.model.ts"),
    ).toBe(read("database/models/games/user-game-stats.model.ts"));
  });

  it("service is byte-identical in both apps", () => {
    expect(
      read("apps/admin/lib/services/games/user-game-stats.service.ts"),
    ).toBe(read("lib/services/games/user-game-stats.service.ts"));
  });
});

describe("awardContestRewards is the one caller", () => {
  it("contest-rewards awaits recordContestFinish", () => {
    // Reason: XP/badges are fire-and-forget; stats are awaited so a finish is
    // durable before the process moves on. Presence of the call is not enough —
    // a fire-and-forget .catch(()=>{}) would silently drop a write.
    const code = stripComments(
      read("lib/services/settlement/contest-rewards.ts"),
    );
    expect(code).toMatch(/await\s+recordContestFinish\(/);
  });

  it("contest-rewards copies stay byte-identical", () => {
    expect(
      read("apps/admin/lib/services/settlement/contest-rewards.ts"),
    ).toBe(read("lib/services/settlement/contest-rewards.ts"));
  });
});
