import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDurationMs, formatGameScore } from "@/lib/utils/format-game-score";

/**
 * The owner saw a race time printed as "172,666.998" on the arena leaderboard (28 Sep 2026).
 * The number was right; its writing was not. A `duration_ms` title's score is milliseconds
 * plus a sub-millisecond tie-break the provider folds in, so it must read as a clock.
 */
describe("formatGameScore", () => {
  it("writes a race time as a clock, rounded to the millisecond", () => {
    expect(formatGameScore(172_666.998, "duration_ms")).toBe("2:52.667");
    expect(formatGameScore(59_999.9996, "duration_ms")).toBe("1:00.000");
    expect(formatGameScore(3_723_004, "duration_ms")).toBe("1:02:03.004");
    expect(formatDurationMs(0)).toBe("0:00.000");
  });

  it("writes an integer score with no decimals and a decimal one with at most two", () => {
    expect(formatGameScore(1234.6, "integer")).toBe((1235).toLocaleString());
    expect(formatGameScore(12.34567, "decimal")).toBe((12.35).toLocaleString());
    expect(formatGameScore(12.34567)).toBe((12.35).toLocaleString());
  });

  it("renders an absent score as a dash, never a nought (R50)", () => {
    for (const absent of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatGameScore(absent as number | undefined, "duration_ms")).toBe("-");
    }
    expect(formatGameScore(undefined, "integer", "—")).toBe("—");
    // A real zero is a score, not an absence.
    expect(formatGameScore(0, "integer")).toBe("0");
  });

  it("never branches on which game this is", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/utils/format-game-score.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(source).not.toMatch(/gameCode|gameKey|providerKey|velocity|circuit/i);
  });

  it("is used by every provider score surface instead of a bare toLocaleString", () => {
    const files = [
      "components/games/ProviderLeaderboard.tsx",
      "components/games/arena/ArenaActivityFeed.tsx",
      "components/games/arena/ChallengeStandingsPanel.tsx",
      "components/games/arena/arena-facts.ts",
      "components/games/LobbyLiveParts.tsx",
      "components/games/ProviderResultsScreen.tsx",
      "components/games/ProviderChallengeLobby.tsx",
      "components/games/RoundResultPanel.tsx",
      "components/games/ChallengeRoundResultPanel.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).toMatch(/formatGameScore\(/);
      expect(source, file).not.toMatch(/score\.toLocaleString\(\)|participantScore\.toLocaleString\(\)/);
    }
  });
});
