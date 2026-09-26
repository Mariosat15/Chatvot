import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * X8 pass 4 — leaderboard columns and headings read nouns from the terminology pack.
 *
 * Client tables call `useTerms()`; the API builds board picker labels via `getTerms()`.
 * Trading-metric columns (P&L, Win Rate, Trader) stay literal — chapter 14 boundary 1 /
 * section 5: no trading vocabulary is a token.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const CLIENT = "components/leaderboard/LeaderboardClient.tsx";
const GLOBAL = "components/leaderboard/GlobalLeaderboardTable.tsx";
const GAMES = "components/leaderboard/GameLeaderboardTable.tsx";
const TRADING = "components/leaderboard/LeaderboardContent.tsx";
const CHALLENGE_BTN = "components/leaderboard/LeaderboardChallengeButton.tsx";
const API = "app/api/leaderboard/route.ts";

const SURFACE = [CLIENT, GLOBAL, GAMES, TRADING, CHALLENGE_BTN, API];

describe("X8 pass 4 leaderboard reaches the pack", () => {
  it("reads every file", () => {
    for (const file of SURFACE) {
      expect(readCode(file).length).toBeGreaterThan(400);
    }
  });

  it("API CALLS getTerms once for board labels", () => {
    const code = readCode(API);
    expect(code).toMatch(/getTerms\(\)/);
    expect(code.match(/getTerms\(\)/g)?.length).toBe(1);
    expect(code).toContain("terms.leaderboard");
    expect(code).toContain("terms.games");
  });

  it("hard-coded Global/Trading/Games Leaderboard picker labels are gone from the API", () => {
    const code = readCode(API);
    expect(code).not.toMatch(/["']Global Leaderboard["']/);
    expect(code).not.toMatch(/["']Trading Leaderboard["']/);
    expect(code).not.toMatch(/["']Games Leaderboard["']/);
  });

  it("client shells call useTerms (not getTerms)", () => {
    for (const file of [CLIENT, GLOBAL, GAMES, TRADING, CHALLENGE_BTN]) {
      const code = readCode(file);
      expect(code).toMatch(/\buseTerms\(\)/);
      expect(code).not.toMatch(/getTerms\(\)/);
    }
  });

  it("LeaderboardClient titles use leaderboard / games / players / contest / game / player", () => {
    const code = readCode(CLIENT);
    for (const token of [
      "terms.leaderboard",
      "terms.games",
      "terms.players",
      "terms.contest",
      "terms.game",
      "terms.player",
    ] as const) {
      expect(code).toContain(token);
    }
  });

  it("Global and Games tables use rank / player / score / players", () => {
    for (const file of [GLOBAL, GAMES]) {
      const code = readCode(file);
      expect(code).toContain("terms.rank");
      expect(code).toContain("terms.player");
      expect(code).toContain("terms.score");
      expect(code).toContain("terms.players");
    }
  });

  it("hard-coded Rank / Player / Score column literals are gone from Global and Games tables", () => {
    for (const file of [GLOBAL, GAMES]) {
      const code = readCode(file);
      // Reason: count occurrences inside JSX text — a bare identifier in a type
      // name (RankBadge) must not satisfy this. Match quoted or as sole child text.
      expect(code).not.toMatch(/>\s*Rank\s*</);
      expect(code).not.toMatch(/>\s*Player\s*</);
      expect(code).not.toMatch(/["']Score["']/);
    }
  });

  it("Trading board keeps Trader and uses leaderboard / rank / score / contests", () => {
    const code = readCode(TRADING);
    expect(code).toContain("Trader");
    expect(code).toContain("terms.leaderboard");
    expect(code).toContain("terms.rank");
    expect(code).toContain("terms.score");
    expect(code).toContain("terms.contests");
  });

  it("Challenge button label uses terms.challenge", () => {
    const code = readCode(CHALLENGE_BTN);
    expect(code).toContain("terms.challenge");
    expect(code).not.toMatch(/\?\s*["']Challenge["']/);
  });

  it("never case-folds a token", () => {
    for (const file of SURFACE) {
      const code = readCode(file);
      expect(code).not.toMatch(
        /\bterms\.[a-zA-Z]+\s*\.\s*(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\s*\(/,
      );
    }
  });
});
