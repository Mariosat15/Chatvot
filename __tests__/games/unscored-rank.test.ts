import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { levelUnscoredRanks } from "@/lib/services/games/unscored-rank";

/**
 * Owner, 15 Oct 2026: players waiting in the lobby were ranked 1, 2, 3... by join order before
 * anybody had played. Until a player has a result they share one place; live ranking starts
 * with the first finished round.
 */
describe("levelUnscoredRanks", () => {
  it("puts everybody at #1 before anybody has a score", () => {
    const rows = [
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
      { id: "c", rank: 3 },
    ];
    expect(levelUnscoredRanks(rows).map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("keeps scored ranks and puts every unscored player in the next shared place", () => {
    const rows = [
      { id: "a", rank: 1, score: 900 },
      { id: "b", rank: 2, score: 500 },
      { id: "c", rank: 3, isTied: true, tiedWith: ["d"] },
      { id: "d", rank: 4 },
    ];
    const out = levelUnscoredRanks(rows);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 3]);
    expect(out[2]).toMatchObject({ isTied: false, tiedWith: [] });
  });

  it("treats a non-finite score as no score", () => {
    const out = levelUnscoredRanks([
      { id: "a", rank: 1, score: Number.NaN },
      { id: "b", rank: 2, score: 10 },
    ]);
    expect(out.map((r) => r.rank)).toEqual([2, 2]);
  });

  it("is applied only while a provider contest is running, never at settlement", () => {
    const code = readFileSync(
      join(process.cwd(), "lib/services/games/arena-standings.service.ts"),
      "utf8",
    );
    expect(code).toMatch(
      /competition\.gameType === "provider" && competition\.status !== "completed"\s*\?\s*levelUnscoredRanks\(engineRanked\)/,
    );
  });
});
