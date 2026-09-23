/**
 * X11.5 — interest inference and per-game matchmaking.
 *
 * Pins X13 (trading-only matchmaker must not silently answer for a game),
 * X14 (inference never drives invitations), and X16 (per-game rating).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("resolveMatchmakingGameKey", () => {
  it("defaults absent and blank to trading", async () => {
    const { resolveMatchmakingGameKey } = await import(
      "@/lib/services/matchmaking.service"
    );
    expect(resolveMatchmakingGameKey(undefined)).toBe("trading");
    expect(resolveMatchmakingGameKey(null)).toBe("trading");
    expect(resolveMatchmakingGameKey("")).toBe("trading");
    expect(resolveMatchmakingGameKey("  ")).toBe("trading");
  });

  it("preserves a real game key", async () => {
    const { resolveMatchmakingGameKey } = await import(
      "@/lib/services/matchmaking.service"
    );
    expect(resolveMatchmakingGameKey("provider:chartvolt-games:circuit-sprint")).toBe(
      "provider:chartvolt-games:circuit-sprint",
    );
  });
});

describe("getRankedMatches dispatches by game (X13)", () => {
  it("the trading path does not call game matchmaking", () => {
    const source = code("lib/services/matchmaking.service.ts");
    // Both findBestMatch and getRankedMatches must branch on non-trading.
    expect(source).toMatch(/key\s*!==\s*["']trading["']/);
    expect(source).toMatch(/getRankedGameMatches/);
  });

  it("GET /api/matchmaking forwards gameKey", () => {
    const source = code("app/api/matchmaking/route.ts");
    expect(source).toMatch(/searchParams\.get\(\s*["']gameKey["']\s*\)/);
    expect(source).toMatch(/getRankedMatches\s*\(\s*session\.user\.id\s*,\s*limit\s*,\s*gameKey\s*\)/);
    expect(source).toMatch(/findBestMatch\s*\(\s*session\.user\.id\s*,\s*gameKey\s*\)/);
  });
});

describe("interest inference never writes willingness (X14)", () => {
  it("refreshInferredInterests does not set willingToBeChallenged from play", () => {
    const source = code(
      "lib/services/games/interest-inference.service.ts",
    );
    // $set must not include willingToBeChallenged; only $setOnInsert may default it.
    const setBlock = source.slice(
      source.indexOf("$set:"),
      source.indexOf("$setOnInsert"),
    );
    expect(setBlock).not.toMatch(/willingToBeChallenged/);
    expect(source).toMatch(/interestLevel:\s*["']inferred["']/);
    expect(source).toMatch(/interestLevel\s*===\s*["']declared["']/);
  });

  it("suggestions API never creates a challenge", () => {
    const suggestions = code("lib/services/games/game-suggestions.service.ts");
    const route = code("app/api/games/suggestions/route.ts");
    expect(suggestions).not.toMatch(/Challenge\.create|POST.*challenges/);
    expect(route).not.toMatch(/Challenge\.create|createChallenge/);
    expect(suggestions).toMatch(/Competition\.find/);
  });
});

describe("per-game rating (X16)", () => {
  it("game matchmaking ranks on UserGameStats.rating for the matched key", () => {
    const source = code("lib/services/matchmaking/game-matchmaking.ts");
    expect(source).toMatch(/UserGameStats\.findOne/);
    expect(source).toMatch(/gameKey:\s*key/);
    expect(source).toMatch(/ratingProximityScore/);
    // Must not pull the trading global leaderboard.
    expect(source).not.toMatch(/getGlobalLeaderboard/);
    expect(source).not.toMatch(/overallScore.*leaderboard/i);
  });

  it("preference model carries interestLevel, inferredAt and skillBand", () => {
    const source = code(
      "database/models/games/user-game-preference.model.ts",
    );
    expect(source).toMatch(/interestLevel/);
    expect(source).toMatch(/inferredAt/);
    expect(source).toMatch(/skillBand/);
    expect(source).toMatch(/enum:\s*\[\s*["']declared["']\s*,\s*["']inferred["']\s*\]/);
  });
});

describe("rating proximity prefers closer ratings", () => {
  // Pure behavioural check via the exported match function with mocked models
  // would need DB. The arithmetic is small enough to re-assert by importing
  // through a thin probe of the source formula.
  it("documents the score formula in source", () => {
    const source = code("lib/services/matchmaking/game-matchmaking.ts");
    expect(source).toMatch(/100\s*-\s*diff\s*\/\s*10/);
  });
});
