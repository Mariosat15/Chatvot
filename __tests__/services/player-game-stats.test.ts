/**
 * X7 step 3 — profile reads UserGameStats; does not invent aggregates.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureCollections,
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import { getPlayerGameProfile } from "@/lib/services/games/player-game-stats.service";
import { CROSS_GAME_SCORING_STARTED_CAPTION } from "@/lib/services/games/game-leaderboard.service";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/database/models/games/provider-game.model", () => ({
  default: {
    findOne: () => ({
      select: () => ({
        lean: async () => ({ displayName: "Circuit Sprint" }),
      }),
    }),
  },
}));

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("player-game-stats.service (X7 step 3)", () => {
  beforeAll(async () => {
    await startTestMongo();
    await ensureCollections(["usergamestats"]);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  it("returns empty overall with the Q14 caption when the player has no rows", async () => {
    const profile = await getPlayerGameProfile("user-new");
    expect(profile.overall?.contestsEntered).toBe(0);
    expect(profile.overall?.totalPoints).toBe(0);
    expect(profile.perGame).toEqual([]);
    expect(profile.startsFromCaption).toBe(CROSS_GAME_SCORING_STARTED_CAPTION);
  });

  it("reads overall and per-game rows without summing enabled games", async () => {
    await UserGameStats.create([
      {
        userId: "u1",
        gameKey: OVERALL_GAME_KEY,
        contestsEntered: 5,
        contestsCompleted: 4,
        wins: 2,
        podiums: 3,
        totalPoints: 420,
        seasonPoints: 100,
        bestRank: 1,
        currentStreak: 2,
      },
      {
        userId: "u1",
        gameKey: TRADING_GAME_TYPE,
        contestsEntered: 3,
        contestsCompleted: 3,
        wins: 1,
        podiums: 2,
        totalPoints: 200,
        seasonPoints: 50,
        rating: 1300,
        bestRank: 2,
        currentStreak: 1,
      },
      {
        userId: "u1",
        gameKey: "provider:chartvolt-games:circuit-sprint",
        contestsEntered: 2,
        contestsCompleted: 1,
        wins: 1,
        podiums: 1,
        totalPoints: 220,
        seasonPoints: 50,
        rating: 1250,
        bestRank: 1,
        currentStreak: 1,
      },
    ]);

    const profile = await getPlayerGameProfile("u1");
    expect(profile.overall?.totalPoints).toBe(420);
    expect(profile.overall?.wins).toBe(2);
    expect(profile.perGame).toHaveLength(2);
    // Reason: trading first, then others by points — never by enabled catalogue.
    expect(profile.perGame[0].gameKey).toBe(TRADING_GAME_TYPE);
    expect(profile.perGame[0].isTrading).toBe(true);
    expect(profile.perGame[1].label).toBe("Circuit Sprint");
    expect(profile.perGame[1].rating).toBe(1250);
  });

  it("does not invent a per-game card for a game the player never played", async () => {
    await UserGameStats.create({
      userId: "u2",
      gameKey: OVERALL_GAME_KEY,
      contestsEntered: 1,
      totalPoints: 10,
    });
    const profile = await getPlayerGameProfile("u2");
    expect(profile.perGame).toEqual([]);
  });

  it("service file must not call getEnabledGameTypes", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "lib/services/games/player-game-stats.service.ts"),
      "utf8",
    );
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(/getEnabledGameTypes/);
  });

  it("profile page loads getPlayerGameProfile and does not sum totalPoints itself", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "app/(root)/profile/page.tsx"),
      "utf8",
    );
    const stripped = stripComments(page);
    expect(stripped).toMatch(/getPlayerGameProfile/);
    expect(stripped).not.toMatch(/totalPoints\s*\+/);
    expect(stripped).not.toMatch(/reduce\s*\(/);
  });

  it("overview mounts CrossGameStanding and TradingPerformanceCard", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "app/(root)/profile/ModernProfilePage.tsx"),
      "utf8",
    );
    const stripped = stripComments(page);
    expect(stripped).toMatch(/<CrossGameStanding[\s\S]*profile=\{gameProfile\}/);
    expect(stripped).toMatch(/<TradingPerformanceCard[\s\S]*combinedStats=\{combinedStats\}/);
  });

  it("CrossGameStanding shows the Q14 caption and normalised points headline", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components/profile/CrossGameStanding.tsx"),
      "utf8",
    );
    const stripped = stripComments(src);
    expect(stripped).toMatch(/startsFromCaption/);
    expect(stripped).toMatch(/normalised points/);
    expect(stripped).toMatch(/Cross-game standing/);
    // Reason: must not recompute — reads profile.overall only.
    expect(stripped).not.toMatch(/reduce\s*\(/);
    expect(stripped).not.toMatch(/getEnabledGameTypes/);
  });

  it("trading card keeps profit label scoped", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components/profile/TradingPerformanceCard.tsx"),
      "utf8",
    );
    const stripped = stripComments(src);
    expect(stripped).toMatch(/>\s*Total Profit\s*</);
    expect(stripped).toMatch(/Trading/);
    expect(stripped).toMatch(/totalPnL/);
  });

  it("header quick stats label trading metrics as trading", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "components/profile/ProfileHeader.tsx"),
      "utf8",
    );
    const stripped = stripComments(src);
    expect(stripped).toMatch(/Trading trades/);
    expect(stripped).toMatch(/Trading win %/);
    expect(stripped).not.toMatch(/label="Total Trades"/);
    expect(stripped).not.toMatch(/label="Win Rate"/);
  });

  it("public profile route does not leak UserGameStats", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/user/profile/public/route.ts"),
      "utf8",
    );
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(/UserGameStats/);
    expect(stripped).not.toMatch(/getPlayerGameProfile/);
    expect(stripped).not.toMatch(/totalPoints/);
  });
});
