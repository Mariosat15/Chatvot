import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildStandings,
  parseRoundIds,
  MAX_STANDINGS_ROUNDS,
} from "@/lib/services/games/round-standings.service";

/**
 * The standings a game server asks for to order a race grid (skill-only Volt Velocity,
 * 13 October 2026).
 *
 * Two claims matter. The answer is READ-ONLY and drawn from settled points, so a race cannot
 * move anybody up its own grid. And it is NARROW: one contest, seated players only, all or
 * nothing - so valid provider credentials cannot be used to read an arbitrary player's points.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SERVICE = "lib/services/games/round-standings.service.ts";
const ROUTE = "app/api/games/providers/[providerKey]/standings/route.ts";

describe("what the standings answer says", () => {
  const rounds = [
    { roundId: "a", userId: "u1" },
    { roundId: "b", userId: "u2" },
    { roundId: "c", userId: "u3" },
    { roundId: "d", userId: "u4" },
  ];

  it("ranks by settled points, ties share a place, and nobody unscored is ranked", () => {
    const lines = buildStandings(
      rounds,
      new Map([
        ["u1", 40],
        ["u2", 120],
        ["u3", 40],
        ["u4", 0],
      ]),
      new Map([["u4", new Date("2026-10-13T09:00:00Z")]]),
    );

    expect(lines).toEqual([
      { roundId: "a", points: 40, rank: 2 },
      { roundId: "b", points: 120, rank: 1 },
      { roundId: "c", points: 40, rank: 2 },
      { roundId: "d", points: 0, joinedAt: "2026-10-13T09:00:00.000Z" },
    ]);
  });

  it("a non-finite or negative total reads as no points, never as a place", () => {
    const lines = buildStandings(
      rounds.slice(0, 2),
      new Map([
        ["u1", Number.NaN],
        ["u2", -5],
      ]),
      new Map(),
    );
    expect(lines).toEqual([
      { roundId: "a", points: 0 },
      { roundId: "b", points: 0 },
    ]);
  });

  it("asks about a short list of distinct ids or nothing at all", () => {
    expect(parseRoundIds({ roundIds: ["a", " b "] })).toEqual(["a", "b"]);
    expect(parseRoundIds({ roundIds: [] })).toBeNull();
    expect(parseRoundIds({ roundIds: ["a", "a"] })).toBeNull();
    expect(parseRoundIds({ roundIds: ["a", 7] })).toBeNull();
    expect(parseRoundIds({})).toBeNull();
    expect(
      parseRoundIds({ roundIds: Array.from({ length: MAX_STANDINGS_ROUNDS + 1 }, (_, i) => `r${i}`) }),
    ).toBeNull();
  });
});

describe("the standings endpoint is read-only and narrow", () => {
  it("writes nothing", () => {
    const code = readCode(SERVICE);
    for (const write of ["updateOne", "updateMany", "findOneAndUpdate", "$set", "$inc", ".save(", "create("]) {
      expect(code).not.toContain(write);
    }
  });

  it("verifies credentials before reading a single round", () => {
    const code = readCode(SERVICE);
    const signatureAt = code.indexOf("verifyCallbackSignature(rawBody");
    const tokenAt = code.indexOf("safeEqual(offered");
    const readAt = code.indexOf("GameRound.find(");
    expect(tokenAt).toBeGreaterThan(-1);
    expect(signatureAt).toBeGreaterThan(tokenAt);
    expect(readAt).toBeGreaterThan(signatureAt);
  });

  it("scopes rounds to this provider and refuses a request spanning contests or games", () => {
    const code = readCode(SERVICE);
    expect(code).toMatch(/GameRound\.find\(\{\s*roundId:\s*\{\s*\$in:\s*roundIds\s*\},\s*providerKey\s*\}\)/);
    expect(code).toMatch(/rounds\.length !== roundIds\.length/);
    expect(code).toMatch(/r\.gameKey !== first\.gameKey/);
    expect(code).toMatch(/String\(r\.contestId \?\? ""\) !== contestId/);
  });

  it("checks every player holds a seat in that contest, for competitions and challenges", () => {
    const code = readCode(SERVICE);
    expect(code).toMatch(/CompetitionParticipant\.find\(\{\s*competitionId:\s*contestId/);
    expect(code).toMatch(/ChallengeParticipant\.find\(\{\s*challengeId:\s*contestId/);
    expect(code.split("no seat in this contest").length - 1).toBe(2);
  });

  it("reads points from this game's stats row, never the cross-game rollup", () => {
    const code = readCode(SERVICE);
    expect(code).toMatch(/UserGameStats\.find\(\{\s*gameKey:\s*first\.gameKey/);
    expect(code).not.toContain("OVERALL_GAME_KEY");
    expect(code).not.toContain("_overall");
  });

  it("the route decides nothing itself", () => {
    const code = readCode(ROUTE);
    expect(code).toMatch(/answerRoundStandings\(/);
    expect(code).not.toMatch(/verifyCallbackSignature|loadProviderSecrets|UserGameStats/);
  });

  it("both launch paths offer the address beside the progress callback", () => {
    for (const file of [
      "lib/services/games/round-launch.service.ts",
      "lib/services/games/challenge-round-launch.service.ts",
    ]) {
      expect(readCode(file)).toMatch(
        /standingsUrl:\s*`\$\{baseUrl\}\/api\/games\/providers\/\$\{config\.providerKey\}\/standings`/,
      );
    }
    expect(readCode("lib/services/games/practice-round.service.ts")).not.toContain("standingsUrl");
  });
});
