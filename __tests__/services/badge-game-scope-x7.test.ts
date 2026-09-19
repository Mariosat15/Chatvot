/**
 * X7 step 4 — badge visibility / evaluation scoped by played games, XP stamped
 * with gameKey. Does not author badges (R96b).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  badgeAppliesToPlayer,
  gameKeyForBadgeXp,
  normalizeBadgeGameTypes,
} from "@/lib/services/games/badge-game-scope";
import { sumXpByGameKey } from "@/lib/services/xp-level-shared";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("X7 step 4 - badge game scope", () => {
  it("badge-game-scope is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/services/games/badge-game-scope.ts")).toBe(
      read("lib/services/games/badge-game-scope.ts"),
    );
  });

  it("played-games service is byte-identical in both apps", () => {
    expect(read("apps/admin/lib/services/games/played-games.service.ts")).toBe(
      read("lib/services/games/played-games.service.ts"),
    );
  });

  it("empty gameTypes means platform and applies to everyone", () => {
    expect(normalizeBadgeGameTypes([])).toEqual([]);
    expect(normalizeBadgeGameTypes(null)).toEqual([]);
    expect(
      badgeAppliesToPlayer({
        gameTypes: [],
        conditionType: "total_trades",
        playedGameKeys: new Set(),
        hasTradingActivity: false,
      }),
    ).toBe(true);
  });

  it("trading-only badge is hidden from a games-only player unless the condition is platform", () => {
    expect(
      badgeAppliesToPlayer({
        gameTypes: ["trading"],
        conditionType: "total_trades",
        playedGameKeys: new Set(["provider:chartvolt:circuit-sprint"]),
        hasTradingActivity: false,
      }),
    ).toBe(false);

    expect(
      badgeAppliesToPlayer({
        gameTypes: ["trading"],
        conditionType: "competitions_entered",
        playedGameKeys: new Set(["provider:chartvolt:circuit-sprint"]),
        hasTradingActivity: false,
      }),
    ).toBe(true);
  });

  it("provider-scoped badge requires that gameKey in the played set", () => {
    const key = "provider:chartvolt:circuit-sprint";
    expect(
      badgeAppliesToPlayer({
        gameTypes: [key],
        conditionType: "competitions_entered",
        playedGameKeys: new Set(),
        hasTradingActivity: false,
      }),
    ).toBe(false);
    expect(
      badgeAppliesToPlayer({
        gameTypes: [key],
        conditionType: "competitions_entered",
        playedGameKeys: new Set([key]),
        hasTradingActivity: false,
      }),
    ).toBe(true);
  });

  it("gameKeyForBadgeXp stamps trading or a single provider key, never invents", () => {
    expect(gameKeyForBadgeXp(["trading"])).toBe("trading");
    expect(gameKeyForBadgeXp(["provider:a:b"])).toBe("provider:a:b");
    expect(gameKeyForBadgeXp([])).toBeUndefined();
    expect(gameKeyForBadgeXp(["trading", "provider:a:b"])).toBe("provider:a:b");
  });

  it("sumXpByGameKey buckets missing keys as _unscoped, never trading", () => {
    expect(
      sumXpByGameKey([
        { amount: 10, gameKey: "trading" },
        { amount: 5 },
        { amount: 3, gameKey: "provider:chartvolt:circuit-sprint" },
        { amount: 0, gameKey: "trading" },
      ]),
    ).toEqual({
      trading: 10,
      _unscoped: 5,
      "provider:chartvolt:circuit-sprint": 3,
    });
  });

  it("xp-level-shared is byte-identical and outside use-server", () => {
    // Reason: const/sync exports cannot live in xp-level.service.ts ("use server").
    expect(read("apps/admin/lib/services/xp-level-shared.ts")).toBe(
      read("lib/services/xp-level-shared.ts"),
    );
    const shared = stripComments(read("lib/services/xp-level-shared.ts"));
    expect(shared).not.toMatch(/"use server"/);
    expect(shared).toMatch(/export const TRADE_ACTIVITY_SOURCE_PREFIX/);
    expect(shared).toMatch(/export function sumXpByGameKey/);
    const service = stripComments(read("lib/services/xp-level.service.ts"));
    expect(service).not.toMatch(/export const TRADE_ACTIVITY_SOURCE_PREFIX/);
    expect(service).not.toMatch(/export function sumXpByGameKey/);
  });

  it("evaluate and getUserBadges both call badgeAppliesToPlayer", () => {
    // Reason: award and list must agree. Pin the CALL with arguments, not the import.
    const code = stripComments(read("lib/services/badge-evaluation.service.ts"));
    const evaluateIdx = code.indexOf("export async function evaluateUserBadges");
    const getIdx = code.indexOf("export async function getUserBadges");
    expect(evaluateIdx).toBeGreaterThan(-1);
    expect(getIdx).toBeGreaterThan(-1);
    const evaluateSlice = code.slice(evaluateIdx, getIdx);
    const getSlice = code.slice(getIdx, getIdx + 1200);
    expect(evaluateSlice).toMatch(
      /badgeAppliesToPlayer\(\s*\{\s*gameTypes:/,
    );
    expect(getSlice).toMatch(/badgeAppliesToPlayer\(\s*\{\s*gameTypes:/);
  });

  it("getBadgesFromDB returns gameTypes so scope is not invented as platform", () => {
    const code = stripComments(read("lib/services/badge-config-seed.service.ts"));
    const start = code.indexOf("export async function getBadgesFromDB");
    expect(start).toBeGreaterThan(-1);
    // Reason: seed insert/create also mention gameTypes; pin the RETURN path only.
    const body = code.slice(start, start + 1800);
    expect(body).toMatch(
      /return badges\.map\([\s\S]*?gameTypes:\s*Array\.isArray\(badge\.gameTypes\)\s*\?\s*badge\.gameTypes\s*:\s*\[["']trading["']\]/,
    );
  });

  it("awardXPForBadge stamps gameKey via gameKeyForBadgeXp", () => {
    const main = stripComments(read("lib/services/xp-level.service.ts"));
    const admin = stripComments(
      read("apps/admin/lib/services/xp-level.service.ts"),
    );
    for (const code of [main, admin]) {
      expect(code).toMatch(/gameKeyForBadgeXp\(/);
      expect(code).toMatch(
        /\.\.\.\(badgeGameKey\s*\?\s*\{\s*gameKey:\s*badgeGameKey\s*\}\s*:\s*\{\}\)/,
      );
    }
  });

  it("getUserLevel exposes xpByGameKey from the ledger, not a recomputed sum", () => {
    const code = stripComments(read("lib/services/xp-level.service.ts"));
    expect(code).toMatch(/xpByGameKey:\s*sumXpByGameKey\(userLevel\.xpHistory\)/);
    expect(code).toMatch(/xpByGameKey:\s*\{\s*\}/);
  });

  it("played-games snapshot never calls getEnabledGameTypes", () => {
    // Reason: R29 — disable must not erase history; totals never recompute from enabled set.
    const code = stripComments(
      read("lib/services/games/played-games.service.ts"),
    );
    expect(code).not.toMatch(/getEnabledGameTypes/);
  });
});
