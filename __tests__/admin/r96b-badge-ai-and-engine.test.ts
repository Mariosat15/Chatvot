/**
 * R96b — AI badge prompt helpers and balance-engine trade-floor scoping.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBadgeSystemPrompt,
  knownGameKeys,
  planBadgesByScope,
  sanitizeBadgeForWrite,
} from "../../apps/admin/lib/admin/ai-badge-prompt";
import {
  categoryIdsForPrompt,
  conditionTypesForPrompt,
} from "../../apps/admin/lib/services/games/badge-condition-registry";
import {
  generateFixes,
  evaluateSystem,
  type BadgeData,
  type MilestoneData,
} from "../../apps/admin/lib/gamification-engine";

const KNOWN = knownGameKeys([
  {
    gameKey: "provider:chartvolt:circuit-sprint",
    displayName: "Circuit Sprint",
  },
]);

describe("ai-badge-prompt (R96b)", () => {
  it("buildBadgeSystemPrompt includes registry categories and condition scopes", () => {
    const prompt = buildBadgeSystemPrompt([
      {
        gameKey: "provider:chartvolt:circuit-sprint",
        displayName: "Circuit Sprint",
        category: "Puzzle",
      },
    ]);
    expect(prompt).toContain(categoryIdsForPrompt());
    expect(prompt).toContain("Games");
    expect(prompt).toContain("provider:chartvolt:circuit-sprint");
    expect(prompt).toMatch(/platform \| both \| game/i);
    // Prompt must list registry types, not a hand-rolled forex-only subset.
    expect(prompt).toContain(conditionTypesForPrompt().split("\n")[0]!);
    expect(prompt).toContain("game_contests_completed");
  });

  it("sanitizeBadgeForWrite refuses invented gameKeys", () => {
    const result = sanitizeBadgeForWrite(
      {
        id: "x",
        gameTypes: ["provider:fake:invented"],
        condition: { type: "game_contests_completed", value: 1 },
      },
      KNOWN,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown gameTypes/);
  });

  it("sanitizeBadgeForWrite refuses trading condition on provider-only gameTypes", () => {
    const result = sanitizeBadgeForWrite(
      {
        id: "x",
        gameTypes: ["provider:chartvolt:circuit-sprint"],
        condition: { type: "total_trades", value: 10, minTrades: 5 },
      },
      KNOWN,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/);
  });

  it("sanitizeBadgeForWrite clears minTrades on game-scoped conditions", () => {
    const result = sanitizeBadgeForWrite(
      {
        id: "sprint_finisher",
        name: "Sprint Finisher",
        gameTypes: ["provider:chartvolt:circuit-sprint"],
        condition: {
          type: "game_contests_completed",
          value: 3,
          minTrades: 50,
        },
      },
      KNOWN,
    );
    expect(result.ok).toBe(true);
    expect(
      (result.badge?.condition as { minTrades?: number })?.minTrades,
    ).toBe(0);
  });

  it("planBadgesByScope reports creates by scope and skips existing ids", () => {
    const plan = planBadgesByScope(
      [
        { id: "existing", gameTypes: ["trading"], name: "Old" },
        { id: "new_game", gameTypes: ["provider:chartvolt:circuit-sprint"], name: "New" },
        { id: "platform_one", gameTypes: [], name: "Plat" },
      ],
      new Set(["existing"]),
    );
    expect(plan.wouldSkipExisting).toEqual(["existing"]);
    expect(plan.wouldCreate.map((c) => c.id).sort()).toEqual([
      "new_game",
      "platform_one",
    ]);
    expect(plan.byScope.platform).toBe(1);
    expect(plan.byScope["provider:chartvolt:circuit-sprint"]).toBe(1);
  });
});

describe("gamification-engine trade floors (R96b)", () => {
  const milestones: MilestoneData[] = [];

  function badge(partial: Partial<BadgeData> & Pick<BadgeData, "id" | "condition">): BadgeData {
    return {
      name: partial.name || partial.id,
      category: partial.category || "Trading",
      rarity: partial.rarity || "rare",
      minLevel: partial.minLevel ?? 2,
      gameTypes: partial.gameTypes,
      ...partial,
      condition: partial.condition,
    };
  }

  it("does not distribute minTrades onto Games-category badges", () => {
    const badges = [
      badge({
        id: "game_badge",
        category: "Games",
        rarity: "rare",
        condition: { type: "game_contests_completed", value: 5, minTrades: 0 },
        gameTypes: ["provider:chartvolt:circuit-sprint"],
      }),
      badge({
        id: "trade_badge",
        category: "Trading",
        rarity: "rare",
        condition: { type: "total_trades", value: 20, minTrades: 0 },
        gameTypes: ["trading"],
      }),
    ];
    const fixes = generateFixes(badges, milestones);
    const gameFloor = fixes.badgeFixes.find(
      (f) => f.id === "game_badge" && f.field === "condition.minTrades",
    );
    const tradeFloor = fixes.badgeFixes.find(
      (f) => f.id === "trade_badge" && f.field === "condition.minTrades",
    );
    expect(gameFloor).toBeUndefined();
    expect(tradeFloor).toBeDefined();
    expect(tradeFloor!.newValue).toBeGreaterThan(0);
  });

  it("zero-baseline score does not flag game/platform badges for missing minTrades", () => {
    const badges = [
      badge({
        id: "platform_xp",
        category: "Competition",
        rarity: "rare",
        condition: { type: "xp_threshold", value: 100, minTrades: 0 },
        gameTypes: [],
      }),
      badge({
        id: "game_wins",
        category: "Games",
        rarity: "epic",
        condition: { type: "game_contests_completed", value: 10, minTrades: 0 },
        gameTypes: ["provider:chartvolt:circuit-sprint"],
      }),
    ];
    const result = evaluateSystem(badges, milestones, []);
    const zeroIssues = result.issues.filter((i) => i.area === "zero-baseline");
    const tradeFloorIssue = zeroIssues.find((i) =>
      i.description.includes("minTrades"),
    );
    expect(tradeFloorIssue).toBeUndefined();
  });
});

describe("AI routes import the registry (structural)", () => {
  it("generate-badges and gamification-wizard import badge-condition-registry helpers", () => {
    const root = join(process.cwd());
    const gen = readFileSync(
      join(root, "apps/admin/app/api/ai/generate-badges/route.ts"),
      "utf8",
    );
    const wiz = readFileSync(
      join(root, "apps/admin/app/api/ai/gamification-wizard/route.ts"),
      "utf8",
    );
    // Comments stripped lightly — assert call sites, not import alone.
    expect(gen).toMatch(/buildBadgeSystemPrompt\s*\(/);
    expect(gen).toMatch(/sanitizeBadgeForWrite\s*\(/);
    expect(wiz).toMatch(/buildBadgeSystemPrompt\s*\(/);
    expect(wiz).toMatch(/mode\s*===\s*"replace"/);
    expect(wiz).toMatch(/plan_badges/);
    expect(wiz).toMatch(/add-only/);
  });
});
