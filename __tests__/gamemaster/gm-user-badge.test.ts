/**
 * The Game Master badge beside a player's name (owner, 2 Oct 2026): "if a user is GM have a
 * badge next to his name in everywhere also in leaderboard of users in cards".
 *
 * Who counts is behavioural, against a real database, because the only interesting part is
 * the expiry half of the filter: the renewal job flips a lapsed row to `expired` on a
 * schedule, so `status: "active"` alone keeps the badge on someone whose role has ended.
 *
 * Where it appears is structural with comments stripped: a badge is a render, and the
 * failure being guarded is a name surface that never received one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestMongo, startTestMongo, stopTestMongo } from "../helpers/mongo-test-server";

vi.mock("@/database/mongoose", () => ({
  connectToDatabase: async () => mongoose.connection,
  default: async () => mongoose.connection,
}));

import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import {
  activeGameMasterFilter,
  getActiveGameMasterIds,
} from "@/lib/services/gamemaster/active-game-masters";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const DAY = 86_400_000;

describe("who counts as a Game Master", () => {
  beforeAll(async () => {
    await mongoose.connect(await startTestMongo());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await stopTestMongo();
  });
  beforeEach(async () => {
    await clearTestMongo();
  });

  it("is an active subscription whose end date has not passed", async () => {
    const now = Date.now();
    await GameMasterSubscription.collection.insertMany([
      { userId: "a".repeat(24), status: "active", endDate: new Date(now + 10 * DAY) },
      { userId: "b".repeat(24), status: "active", endDate: new Date(now - DAY) },
      { userId: "c".repeat(24), status: "expired", endDate: new Date(now + 10 * DAY) },
      { userId: "d".repeat(24), status: "suspended", endDate: new Date(now + 10 * DAY) },
    ]);
    expect(await getActiveGameMasterIds()).toEqual(["a".repeat(24)]);
  });

  it("the filter carries both halves", () => {
    const f = activeGameMasterFilter(new Date(0));
    expect(f).toEqual({ status: "active", endDate: { $gt: new Date(0) } });
  });
});

const SURFACES = [
  "components/leaderboard/GlobalLeaderboardTable.tsx",
  "components/leaderboard/GameLeaderboardTable.tsx",
  "components/leaderboard/LeaderboardContent.tsx",
  "components/leaderboard/MatchmakingCards.tsx",
  "components/trading/CompetitionLeaderboard.tsx",
  "components/trading/LiveRankingPanel.tsx",
  "components/trading/GameLiveRankingPanel.tsx",
  "components/games/ProviderLeaderboard.tsx",
  "components/games/arena/ChallengeStandingsPanel.tsx",
  "components/profile/ProfileCard.tsx",
];

/** Tables with a desktop row and a mobile card each need the badge on both. */
const TWO_LAYOUTS = new Set([
  "components/leaderboard/GlobalLeaderboardTable.tsx",
  "components/leaderboard/GameLeaderboardTable.tsx",
  "components/leaderboard/LeaderboardContent.tsx",
]);

describe("where the badge is drawn", () => {
  it.each(SURFACES)("badges the name on %s", (file) => {
    const renders = code(file).match(/<GameMasterBadge\s+userId=\{[^}]+\}/g) ?? [];
    expect(renders.length).toBe(TWO_LAYOUTS.has(file) ? 2 : 1);
  });

  it("the badge renders nothing unless the id is in the shared set", () => {
    const badge = code("components/gamemaster/GameMasterBadge.tsx");
    expect(badge).toMatch(/if \(!userId \|\| !ids\.has\(String\(userId\)\)\) return null;/);
  });

  it("every badge on a page shares one request", () => {
    const hook = code("hooks/useGameMasterIds.ts");
    expect(hook).toMatch(/^let inflight: Promise<Set<string>> \| null = null;/m);
    expect(hook.match(/fetch\(/g)?.length).toBe(1);
  });

  it("the id list is refused without a session, before it is read", () => {
    const route = code("app/api/gamemaster/active-ids/route.ts");
    const guard = route.indexOf("if (!session?.user?.id)");
    const read = route.indexOf("await getActiveGameMasterIds()");
    expect(guard).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(guard);
  });
});
