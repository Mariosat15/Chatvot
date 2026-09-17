import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Badge } from "@/lib/constants/badges";
import {
  getBadgeRequirement,
  getBadgeXP,
  RARITY_ACTIVITY_FLOORS,
} from "@/lib/utils/badge-descriptions";
import { BADGE_CONDITION_DEFS } from "@/lib/services/games/badge-condition-registry";
import { DEFAULT_BADGE_XP } from "@/lib/services/games/gamification-economy";

/**
 * R96b display defect. A RARE badge in the Games category on `game_wins` rendered
 *
 *   • 25+ total trades (rare tier)
 *   • 1+ competitions completed (rare tier)
 *
 * which a games-only player can never satisfy — and which `checkBadgeCondition`
 * never applies to a game-scoped condition, because it zeroes the trade floor for
 * exactly that reason. Nothing threw; the only witness was a screenshot.
 *
 * The obvious over-correction is to drop the floors for everything, so the
 * trading-scoped assertions below are as load-bearing as the game-scoped ones.
 */

const EVALUATOR = join(
  __dirname,
  "..",
  "..",
  "lib",
  "services",
  "badge-evaluation.service.ts",
);

function badge(over: Partial<Badge> & { condition: Badge["condition"] }): Badge {
  return {
    id: "test_badge",
    name: "Test Badge",
    description: "Test",
    category: "Competition",
    icon: "trophy",
    rarity: "rare",
    ...over,
  } as Badge;
}

/** Every floor line the card would print, joined for substring assertions. */
function extrasOf(b: Badge): string {
  return getBadgeRequirement(b).extras.join(" | ");
}

describe("getBadgeRequirement — activity floors follow the condition's scope", () => {
  it("prints no trade or competition floor for the reported Games badge", () => {
    // The exact shape from the owner's screenshot: rare, Games, game_wins 10.
    const b = badge({
      id: "circuit_sprint_challenger",
      name: "Circuit Sprint Challenger",
      category: "Games",
      rarity: "rare",
      gameTypes: ["provider:chartvolt-games:circuit-sprint"],
      condition: { type: "game_wins", value: 10, comparison: "gte" },
    });

    const req = getBadgeRequirement(b);
    expect(req.extras).toEqual([]);
    expect(req.requirement).toBe("Win 10 contests in this game");
    expect(req.statLabel).toBe("Game Wins");
    // The whole card, not just the floors — no trading vocabulary anywhere.
    expect(JSON.stringify(req).toLowerCase()).not.toContain("trade");
  });

  it("still prints the rarity tier floors for a trading-scoped condition", () => {
    // Reason: a blanket removal is the obvious over-correction and would make
    // every trading badge understate what the evaluator enforces.
    const extras = extrasOf(
      badge({
        rarity: "rare",
        condition: { type: "win_streak", value: 5, comparison: "gte" },
      }),
    );

    expect(extras).toContain("25+ total trades required (rare tier)");
    expect(extras).toContain("1+ competitions completed (rare tier)");
  });

  it("prints no trade floor for an unknown condition type, failing closed", () => {
    // Reason: inventing a trade requirement is the defect. Omitting one is
    // merely less informative, so an unregistered type claims no tier floor.
    const extras = extrasOf(
      badge({
        rarity: "legendary",
        condition: { type: "not_a_registered_condition", value: 3 },
      }),
    );

    expect(extras).not.toContain("trades");
    expect(extras).not.toContain("competitions");
  });

  it("keeps an explicitly authored floor on an unknown condition type", () => {
    // Failing closed drops the TIER floor, not what the badge itself asks for.
    const extras = extrasOf(
      badge({
        rarity: "legendary",
        condition: {
          type: "not_a_registered_condition",
          value: 3,
          minTrades: 7,
          minCompletedCompetitions: 2,
        },
      }),
    );

    expect(extras).toContain("7+ total trades required");
    expect(extras).not.toContain("(legendary tier)");
    expect(extras).toContain("2+ competitions completed");
  });

  it("drops the trade floor but keeps the competition floor for a cross-game condition", () => {
    // Reason (R96a): a win in ANY game satisfies `first_place_finishes`, so the
    // evaluator ignores a stored minTrades entirely.
    const extras = extrasOf(
      badge({
        rarity: "epic",
        condition: {
          type: "first_place_finishes",
          value: 5,
          comparison: "gte",
          minTrades: 10,
        },
      }),
    );

    expect(extras).not.toContain("trades");
    expect(extras).toContain("3+ competitions completed (epic tier)");
  });

  it("prints only what a platform-scoped badge itself asks for", () => {
    // `platform_age` is account activity — no tier floor of any kind.
    expect(
      extrasOf(
        badge({
          rarity: "legendary",
          condition: { type: "platform_age", value: 30 },
        }),
      ),
    ).toBe("");

    expect(
      extrasOf(
        badge({
          rarity: "legendary",
          condition: { type: "platform_age", value: 30, minTrades: 4 },
        }),
      ),
    ).toBe("4+ total trades required");
  });

  it("suffixes the tier only when the tier is what raised the floor", () => {
    // Reason: the old code pushed the stored figure AND the tier figure, so a
    // badge storing 25 under an epic tier of 50 listed two trade requirements.
    const stored = extrasOf(
      badge({
        rarity: "epic",
        condition: {
          type: "win_streak",
          value: 5,
          minTrades: 80,
          minCompletedCompetitions: 9,
        },
      }),
    );

    expect(stored).toContain("80+ total trades required");
    expect(stored).toContain("9+ competitions completed");
    expect(stored).not.toContain("tier");
    // One line per floor, never both figures.
    expect(stored).not.toContain("50+");
    expect(stored).not.toContain("3+");
  });

  it("withholds the trade floor from a provider-only badge, but not a mixed one", () => {
    // Reason: `conditionAllowedOnBadge` refuses a trading condition on a
    // provider-only badge, so the first case is a bad-data guard. A MIXED list
    // is permitted, the evaluator does apply the floor, and hiding it there
    // would understate a real requirement — the mirror image of the defect.
    const providerOnly = extrasOf(
      badge({
        rarity: "rare",
        gameTypes: ["provider:chartvolt-games:circuit-sprint"],
        condition: { type: "win_streak", value: 5 },
      }),
    );
    const mixed = extrasOf(
      badge({
        rarity: "rare",
        gameTypes: ["trading", "provider:chartvolt-games:circuit-sprint"],
        condition: { type: "win_streak", value: 5 },
      }),
    );

    expect(providerOnly).not.toContain("trades");
    expect(mixed).toContain("25+ total trades required (rare tier)");
  });
});

describe("getBadgeRequirement — game-scoped wording", () => {
  it("reads game_best_rank as 'or better', because lower is better", () => {
    const req = getBadgeRequirement(
      badge({
        category: "Games",
        condition: { type: "game_best_rank", value: 3, comparison: "lte" },
      }),
    );

    expect(req.requirement).toBe("Finish rank #3 or better in this game");
    expect(req.targetValue).toBe("#3 or better");
    // "Reach 3" would read as the opposite of the requirement.
    expect(req.requirement).not.toMatch(/reach/i);
  });

  it("reads an eq-compared game_best_rank as an exact placing", () => {
    const req = getBadgeRequirement(
      badge({
        category: "Games",
        condition: { type: "game_best_rank", value: 1, comparison: "eq" },
      }),
    );

    expect(req.requirement).toBe("Finish exactly rank #1 in this game");
    expect(req.requirement).not.toContain("or better");
  });

  it("gives every game-scoped registry type its own arm, never the fallback", () => {
    // Reason: the `default:` arm titleizes the raw type ("Game Wins" as a
    // statLabel of "Progress"), which is what the Games group used to get. This
    // is the tripwire for the day a ninth game condition is registered.
    const gameTypes = BADGE_CONDITION_DEFS.filter((d) => d.scope === "game");
    expect(gameTypes.length).toBeGreaterThan(0);

    for (const def of gameTypes) {
      const req = getBadgeRequirement(
        badge({
          category: "Games",
          condition: { type: def.type, value: 5, comparison: "gte" },
        }),
      );

      expect(req.statLabel, `${def.type} has no arm`).not.toBe("Progress");
      expect(req.requirement, `${def.type} is not game-scoped wording`).toMatch(
        /in this game/,
      );
      expect(req.tip, `${def.type} does not explain the scope`).toContain(
        "no trading activity required",
      );
      expect(req.extras, `${def.type} advertises a floor`).toEqual([]);
    }
  });

  it("names no game and no provider, so a new title needs no code here", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "lib", "utils", "badge-descriptions.ts"),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/circuit[-_]/i);
    expect(code).not.toMatch(/provider:/);
    expect(code).not.toMatch(/gameCode/);
  });
});

describe("the display floor table agrees with the evaluator", () => {
  it("matches RARITY_MIN_REQUIREMENTS in badge-evaluation.service.ts", () => {
    // Reason: the table is duplicated because the evaluator is a server module
    // and this util is reachable from a client component (R58). A floor shown
    // here that the evaluator does not apply — and the reverse — is invisible,
    // so the two are compared by parsing the authoritative copy.
    const source = readFileSync(EVALUATOR, "utf8");
    const start = source.indexOf("const RARITY_MIN_REQUIREMENTS");
    expect(start, "the evaluator's table has moved or been renamed").toBeGreaterThan(-1);
    const end = source.indexOf("};", start);
    expect(end, "the evaluator's table is unterminated").toBeGreaterThan(start);

    const table = source.slice(start, end);
    const rows = [
      ...table.matchAll(
        /(\w+):\s*\{\s*trades:\s*(\d+),\s*competitions:\s*(\d+)\s*\}/g,
      ),
    ];
    // A slice that found nothing passes every assertion asked of it.
    expect(rows).toHaveLength(RARITY_ACTIVITY_FLOORS.size);

    for (const [, rarity, trades, competitions] of rows) {
      expect(RARITY_ACTIVITY_FLOORS.get(rarity), `${rarity} is missing`).toEqual(
        { trades: Number(trades), competitions: Number(competitions) },
      );
    }
  });
});

describe("getBadgeXP", () => {
  it("reads the platform default from gamification-economy, not a second table", () => {
    expect(getBadgeXP("common")).toBe(DEFAULT_BADGE_XP.common);
    expect(getBadgeXP("rare")).toBe(DEFAULT_BADGE_XP.rare);
    expect(getBadgeXP("epic")).toBe(DEFAULT_BADGE_XP.epic);
    expect(getBadgeXP("legendary")).toBe(DEFAULT_BADGE_XP.legendary);
  });

  it("falls back to the common award for an unrecognised rarity", () => {
    expect(getBadgeXP("mythic")).toBe(DEFAULT_BADGE_XP.common);
  });
});
