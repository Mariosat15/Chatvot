import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * X8 pass 3 — provider contest shell reads nouns from the terminology pack.
 *
 * Server lobbies call `getTerms()` once; the arena rail is `"use client"` and calls
 * `useTerms()`. Trading lobby paths are deliberately excluded (chapter 14 s5).
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const LOBBY = "components/games/ProviderContestLobby.tsx";
const CHALLENGE_LOBBY = "components/games/ProviderChallengeLobby.tsx";
const ARENA_BOARD = "components/games/arena/ArenaLeaderboardPanel.tsx";
const ARENA_FACTS = "components/games/arena/ArenaContestPanel.tsx";
const ARENA_IDENTITY = "components/games/arena/ArenaIdentity.tsx";

const SURFACE = [LOBBY, CHALLENGE_LOBBY, ARENA_BOARD, ARENA_FACTS, ARENA_IDENTITY];

describe("X8 pass 3 contest shell reaches the pack", () => {
  it("reads every file", () => {
    for (const file of SURFACE) {
      expect(readCode(file).length).toBeGreaterThan(400);
    }
  });

  it("provider lobbies CALL getTerms once each", () => {
    for (const file of [LOBBY, CHALLENGE_LOBBY, ARENA_FACTS, ARENA_IDENTITY]) {
      const code = readCode(file);
      expect(code).toMatch(/getTerms\(\)/);
      expect(code.match(/getTerms\(\)/g)?.length).toBe(1);
    }
  });

  it("ArenaLeaderboardPanel calls useTerms (client rail)", () => {
    const code = readCode(ARENA_BOARD);
    expect(code).toMatch(/\buseTerms\(\)/);
    expect(code).not.toMatch(/getTerms\(\)/);
  });

  it("ProviderContestLobby uses contest / contests / players / prizePool / entryFee / leaderboard / game", () => {
    const code = readCode(LOBBY);
    for (const token of [
      "terms.contests",
      "terms.players",
      "terms.prizePool",
      "terms.entryFee",
      "terms.leaderboard",
      "terms.contest",
      "terms.game",
    ] as const) {
      expect(code).toContain(token);
    }
  });

  it("ProviderChallengeLobby uses challenges / challenge / opponent / game", () => {
    const code = readCode(CHALLENGE_LOBBY);
    expect(code).toMatch(/terms\.challenges/);
    expect(code).toMatch(/terms\.challenge/);
    expect(code).toMatch(/terms\.opponent/);
    expect(code).toMatch(/terms\.game/);
  });

  it("hard-coded Back to Competitions / Back to Challenges are gone", () => {
    expect(readCode(LOBBY)).not.toMatch(/["']Back to Competitions["']/);
    expect(readCode(CHALLENGE_LOBBY)).not.toMatch(/["']Back to Challenges["']/);
  });

  it("ArenaIdentity no longer hard-codes the Competition badge noun", () => {
    const code = readCode(ARENA_IDENTITY);
    expect(code).toMatch(/terms\.contest/);
    expect(code).not.toMatch(/["']Competition["']/);
  });
});
