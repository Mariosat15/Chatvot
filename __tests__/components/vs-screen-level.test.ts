/**
 * VsScreen level badge must use the real ladder for every rung.
 *
 * The platform ships a 20-rung XP ladder (`TITLE_LEVELS`). Looking up only a
 * decorative 1–8 map crashed Challenge from the Global Leaderboard for anyone
 * at level 9+. The badge now names every rung the same way the profile does.
 */
import { describe, expect, it } from "vitest";
import { resolveVsLevelInfo } from "@/components/challenges/vs-level";
import { TITLE_LEVELS } from "@/lib/constants/levels";
import { resolveLevelName } from "@/lib/utils/level-title";

describe("resolveVsLevelInfo", () => {
  it("names every TITLE_LEVELS rung with the real ladder title", () => {
    for (const rung of TITLE_LEVELS) {
      const info = resolveVsLevelInfo(rung.level);
      expect(info.label).toBe(resolveLevelName(rung.level));
      expect(info.color).toBe(rung.color);
      expect(info.bgColor).toBeTruthy();
    }
  });

  it("uses Expert Trader for level 9 rather than crashing or saying Level 9", () => {
    const info = resolveVsLevelInfo(9);
    expect(info.label).toBe("Expert Trader");
    expect(info.label).not.toMatch(/^Level \d+$/);
  });

  it("treats missing, zero and non-finite levels as level 1", () => {
    expect(resolveVsLevelInfo(undefined).label).toBe(resolveLevelName(1));
    expect(resolveVsLevelInfo(null).label).toBe(resolveLevelName(1));
    expect(resolveVsLevelInfo(0).label).toBe(resolveLevelName(1));
    expect(resolveVsLevelInfo(NaN).label).toBe(resolveLevelName(1));
  });
});
