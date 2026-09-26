import { describe, expect, it } from "vitest";
import { attemptFromRound } from "@/lib/services/games/live-display-score.service";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Live arena ranking scores (26 Sep 2026).
 *
 * THE CLAIM: mid-round progress can move the board WITHOUT becoming a second settlement door.
 * Ranking uses the provider's optional `provisionalScore` - the same number their scoring
 * function will later send as the result `score` - never a key mined out of `scoreBreakdown`
 * (that would be per-game code and break the next title).
 */

function readCode(relativePath: string): string {
  const raw = readFileSync(join(process.cwd(), relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("attemptFromRound", () => {
  it("prefers a finished scored round over a provisional", () => {
    const attempt = attemptFromRound({
      status: "completed",
      rawScore: 900,
      provisionalScore: 100,
      durationMs: 12_000,
      provisionalDurationMs: 5_000,
      completedAt: new Date("2026-09-26T12:00:00Z"),
    });
    expect(attempt).toEqual({
      rawScore: 900,
      durationMs: 12_000,
      completedAt: new Date("2026-09-26T12:00:00Z"),
    });
  });

  it("uses provisionalScore on a live round", () => {
    const progressAt = new Date("2026-09-26T12:01:00Z");
    const attempt = attemptFromRound({
      status: "launched",
      provisionalScore: 420,
      provisionalDurationMs: 8_000,
      progressAt,
    });
    expect(attempt).toEqual({
      rawScore: 420,
      durationMs: 8_000,
      completedAt: progressAt,
    });
  });

  it("ignores a live round with breakdown but no provisional (pre-1.20)", () => {
    expect(
      attemptFromRound({
        status: "launched",
        // No provisionalScore — activity-only progress must not invent a rank number.
      }),
    ).toBeNull();
  });

  it("ignores voided rounds even if they carry a provisional leftover", () => {
    expect(
      attemptFromRound({
        status: "voided",
        rawScore: 0,
        provisionalScore: 999,
      }),
    ).toBeNull();
  });

  it("refuses a non-finite provisional rather than coercing it", () => {
    expect(
      attemptFromRound({
        status: "launched",
        provisionalScore: Number.NaN,
      }),
    ).toBeNull();
  });
});

describe("live display score stays game-agnostic", () => {
  it("never opens scoreBreakdown or names a game metric", () => {
    const code = readCode("lib/services/games/live-display-score.service.ts");
    for (const forbidden of [
      "scoreBreakdown",
      "boardsCompleted",
      "gameCode",
      "circuit",
      "CompetitionParticipant",
      "syncParticipantScore",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("the arena standings service ranks through live display scores, not seats alone", () => {
    const code = readCode("lib/services/games/arena-standings.service.ts");
    expect(code).toMatch(/resolveLiveDisplayScores\(/);
    // Must not invent a per-game key when folding live scores into ranking.
    expect(code).not.toMatch(/boardsCompleted/);
  });
});
