import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { startTestMongo, stopTestMongo, clearTestMongo } from "../helpers/mongo-test-server";
import {
  canEnterPrivateContest,
  publicContestsFilter,
  visibleContestsFilter,
  withVisibleContests,
} from "@/lib/services/gamemaster/visible-contests";

/**
 * Gamemaster Program v2, step 5 (`External game plans/24` s4, R117): private Game Master
 * contests are filtered out of every list another player sees.
 *
 * The filters are run against REAL documents, not compared to an expected object. Whether
 * `null` inside `$in` matches a missing field is a fact about MongoDB, and a filter that is
 * only ever compared to a literal proves the literal, never the query.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const GM = "6500000000000000000000b1";
const OTHER_GM = "6500000000000000000000b2";
const PLAYER = "6500000000000000000000a1";

async function names(filter: Record<string, unknown>): Promise<string[]> {
  const rows = await mongoose.connection
    .db!.collection("competitions")
    .find(filter)
    .project({ name: 1 })
    .toArray();
  return rows.map((r) => String(r.name)).sort();
}

describe("the discovery filters, against real documents", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });
  afterEach(async () => {
    await clearTestMongo();
  });

  async function seed(): Promise<void> {
    await mongoose.connection.db!.collection("competitions").insertMany([
      { name: "legacy", status: "active" },
      { name: "null", status: "active", visibility: null },
      { name: "blank", status: "active", visibility: "" },
      { name: "public", status: "active", visibility: "public" },
      { name: "mine-private", status: "active", visibility: "gm_private", gameMasterId: GM },
      { name: "other-private", status: "active", visibility: "gm_private", gameMasterId: OTHER_GM },
      { name: "unknown", status: "active", visibility: "friends_only", gameMasterId: GM },
      { name: "draft-public", status: "draft", visibility: "public" },
    ]);
  }

  it("an anonymous viewer sees every public shape, including a missing field", async () => {
    await seed();
    expect(await names(publicContestsFilter())).toEqual(
      ["blank", "draft-public", "legacy", "null", "public"],
    );
  });

  it("an unrecognised stored value is HIDDEN, agreeing with the entry gate", async () => {
    await seed();
    // Reason: the plan said `$ne: "gm_private"`, which would list "unknown" to everybody while
    // the entry gate reads it as private - the list and the door disagreeing, towards a leak.
    expect(await names(publicContestsFilter())).not.toContain("unknown");
    expect(canEnterPrivateContest({ visibility: "friends_only", gameMasterId: GM }, OTHER_GM)).toBe(
      false,
    );
  });

  it("an affiliated player also sees their Game Master's private contests, and nobody else's", async () => {
    await seed();
    const seen = await names(visibleContestsFilter({ userId: PLAYER, affiliatedGameMasterId: GM }));
    expect(seen).toContain("mine-private");
    expect(seen).not.toContain("other-private");
  });

  it("a Game Master sees their own private contest", async () => {
    await seed();
    const seen = await names(visibleContestsFilter({ userId: GM, affiliatedGameMasterId: null }));
    expect(seen).toContain("mine-private");
    expect(seen).not.toContain("other-private");
  });

  it("an unaffiliated signed-in player sees public contests only", async () => {
    await seed();
    expect(await names(visibleContestsFilter({ userId: PLAYER, affiliatedGameMasterId: null })))
      .not.toContain("mine-private");
  });

  it("withVisibleContests keeps the caller's own $or rather than replacing it", async () => {
    await seed();
    // Reason: the reader's own `$or` excludes the draft. A spread would overwrite it with the
    // visibility `$or` and the draft would reappear while the visibility half looked correct.
    const query = { $or: [{ status: "active" }, { status: "upcoming" }] };
    const seen = await names(withVisibleContests(query, { userId: PLAYER, affiliatedGameMasterId: GM }));
    expect(seen).not.toContain("draft-public");
    expect(seen).toContain("mine-private");
  });

  it("the prefix addresses a $lookup result", async () => {
    await mongoose.connection.db!.collection("competitions").insertMany([
      { name: "wrapped-private", competition: { visibility: "gm_private" } },
      { name: "wrapped-public", competition: { visibility: "public" } },
    ]);
    expect(await names(publicContestsFilter("competition."))).toEqual(["wrapped-public"]);
  });
});

describe("canEnterPrivateContest", () => {
  it("admits anybody to a public contest", () => {
    expect(canEnterPrivateContest({ visibility: "public" }, null)).toBe(true);
    expect(canEnterPrivateContest({}, null)).toBe(true);
  });
  it("admits only the creator's affiliates to a private one", () => {
    const contest = { visibility: "gm_private", gameMasterId: GM };
    expect(canEnterPrivateContest(contest, GM)).toBe(true);
    expect(canEnterPrivateContest(contest, OTHER_GM)).toBe(false);
    expect(canEnterPrivateContest(contest, null)).toBe(false);
    expect(canEnterPrivateContest(contest, "")).toBe(false);
  });
  it("admits nobody to a private contest with no creator", () => {
    expect(canEnterPrivateContest({ visibility: "gm_private" }, GM)).toBe(false);
  });
});

describe("every reader another player sees applies the filter", () => {
  // Reason: the CALL is asserted, never the import - an import satisfies a bare match while
  // the query beside it still lists everything.
  const readers: [string, RegExp][] = [
    ["lib/actions/trading/competition.actions.ts", /Competition\.find\(withVisibleContests\(query,\s*viewer\)\)/],
    ["lib/services/games/player-catalogue.service.ts", /Competition\.find\(withVisibleContests\(query,\s*viewer\)\)/],
    ["lib/services/games/game-suggestions.service.ts", /Competition\.find\(\s*withVisibleContests\(/],
    ["app/api/competitions/route.ts", /Competition\.find\(\s*withVisibleContests\(/],
    ["app/api/dashboard/competitions/route.ts", /Competition\.find\(\s*withVisibleContests\(/],
    ["app/api/landing/competitions/route.ts", /\.find\(withVisibleContests\(/],
    ["app/api/landing/live-activity/route.ts", /\{\s*\$match:\s*publicContestsFilter\("competition\."\)\s*\}/],
    ["app/api/landing/leaderboard-preview/route.ts", /\{\s*\$match:\s*publicContestsFilter\("competition\."\)\s*\}/],
  ];
  it.each(readers)("%s filters its query", (file, pattern) => {
    expect(code(file)).toMatch(pattern);
  });

  it("the anonymous routes never pass a viewer", () => {
    for (const file of [
      "app/api/dashboard/competitions/route.ts",
      "app/api/landing/competitions/route.ts",
      "app/api/landing/live-activity/route.ts",
    ]) {
      expect(code(file)).not.toMatch(/resolve(Request)?ContestViewer/);
    }
  });

  it("the leaderboard preview projects visibility, or every private win reads as public", () => {
    expect(code("app/api/landing/leaderboard-preview/route.ts")).toMatch(
      /\$project:\s*\{\s*name:\s*1,\s*prizePool:\s*1,\s*visibility:\s*1\s*\}/,
    );
  });

  it("the game page passes the viewer through to its contest list", () => {
    expect(code("app/(root)/games/[slug]/page.tsx")).toMatch(/getGamePageData\(slug,\s*viewer\)/);
    expect(code("lib/services/games/game-page.service.ts")).toMatch(
      /listContestsForGame\(card\.gameKey,\s*viewer\)/,
    );
  });

  it("a failed affiliation read degrades to public-only, never to everything", () => {
    const source = code("lib/services/gamemaster/contest-viewer.service.ts");
    expect(source).toMatch(/catch[\s\S]*affiliatedGameMasterId:\s*null/);
  });
});
