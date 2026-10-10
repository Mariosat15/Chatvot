/**
 * R96b — the orchestration half: per-game coverage, games-only XP parity, the
 * neutral level ladder, and the `run_full` pipeline that chains them.
 *
 * These guards exist because every failure in this area is silent. A wizard
 * that re-proposes badges the catalogue already has reports success; a ladder
 * replaced under an operator reports success; a games-only player locked out of
 * most badge XP reports success. Nothing throws, so a test is the only witness.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analyseBadgeCoverage,
  analyseMilestoneCoverage,
  analyseGamesOnlyParity,
  DEFAULT_COVERAGE_TARGET,
  type CoverageBadge,
  type CoverageGameRef,
} from "../../apps/admin/lib/services/games/gamification-coverage";
import {
  proposeNeutralLadder,
  auditLadder,
} from "../../apps/admin/lib/admin/neutral-level-ladder";
import {
  evaluateSystem,
  type BadgeData,
  type MilestoneData,
} from "../../apps/admin/lib/gamification-engine";
import {
  proposeBadgeXp,
  planBadgeQuota,
  DEFAULT_BADGE_XP,
  DEFAULT_TARGET_BADGE_TOTAL,
} from "../../apps/admin/lib/services/games/gamification-economy";
import { buildJourneyBlueprint } from "../../apps/admin/lib/services/games/journey-blueprint";

const SPRINT = "provider:chartvolt:circuit-sprint";
const PERFECT = "provider:chartvolt:circuit-perfect";

const GAMES: CoverageGameRef[] = [
  { gameKey: SPRINT, displayName: "Circuit Sprint" },
  { gameKey: PERFECT, displayName: "Circuit Perfect" },
];

function badge(
  id: string,
  rarity: string,
  gameTypes: string[] | null,
  conditionType = "game_contests_completed",
): CoverageBadge {
  return { id, rarity, gameTypes, condition: { type: conditionType } };
}

/** One full set for a single game, so a row can be driven to zero missing. */
function fullSetFor(gameKey: string, prefix: string): CoverageBadge[] {
  const out: CoverageBadge[] = [];
  for (const [rarity, count] of Object.entries(DEFAULT_COVERAGE_TARGET.perGame)) {
    for (let i = 0; i < count; i++) {
      out.push(badge(`${prefix}_${rarity}_${i}`, rarity, [gameKey]));
    }
  }
  return out;
}

describe("analyseBadgeCoverage (R96b)", () => {
  it("reports a game with no badges as uncovered", () => {
    const report = analyseBadgeCoverage(fullSetFor(SPRINT, "sprint"), GAMES);
    expect(report.uncoveredGameKeys).toEqual([PERFECT]);
    expect(report.games.find((g) => g.gameKey === SPRINT)!.missingTotal).toBe(0);
    expect(
      report.games.find((g) => g.gameKey === PERFECT)!.missingTotal,
    ).toBeGreaterThan(0);
  });

  it("does not credit a platform badge to any game", () => {
    // Reason: crediting platform badges would report a brand-new title as fully
    // covered on the day it is added, which is exactly the gap the wizard exists
    // to find — so the first run would generate nothing for it.
    const platformOnly: CoverageBadge[] = Array.from({ length: 12 }, (_, i) =>
      badge(`plat_${i}`, "common", [], "xp_threshold"),
    );
    const report = analyseBadgeCoverage(platformOnly, GAMES);
    expect(report.uncoveredGameKeys.sort()).toEqual([PERFECT, SPRINT].sort());
    expect(report.platform.have.common).toBe(12);
  });

  it("the gap shrinks once the badges exist, so a second run has less to do", () => {
    const first = analyseBadgeCoverage([], GAMES);
    const second = analyseBadgeCoverage(fullSetFor(SPRINT, "sprint"), GAMES);
    expect(second.missingTotal).toBeLessThan(first.missingTotal);
  });

  it("a badge scoped to a title no longer in the catalogue is not part of any gap", () => {
    const report = analyseBadgeCoverage(
      [badge("retired", "epic", ["provider:chartvolt:retired-title"])],
      GAMES,
    );
    expect(report.games.every((g) => g.total === 0)).toBe(true);
  });
});

describe("analyseMilestoneCoverage (R96b)", () => {
  it("infers per-game scope from a game_* completion condition", () => {
    const milestones = [
      { id: "m1", completeCondition: { type: "game_contests_completed" } },
      { id: "m2", completeCondition: { type: "total_trades" } },
    ];
    const report = analyseMilestoneCoverage(milestones, GAMES);
    // The game-scoped one credits every catalogue game; the trading one credits
    // none of them.
    expect(report.games.every((g) => g.have === 1)).toBe(true);
    expect(report.uncoveredGameKeys).toEqual([]);
    expect(report.missingTotal).toBe(
      GAMES.length * (DEFAULT_COVERAGE_TARGET.milestonesPerGame - 1),
    );
  });

  it("reports every game uncovered when only trading milestones exist", () => {
    const report = analyseMilestoneCoverage(
      [{ id: "m1", completeCondition: { type: "total_trades" } }],
      GAMES,
    );
    expect(report.uncoveredGameKeys.sort()).toEqual([PERFECT, SPRINT].sort());
  });
});

describe("analyseGamesOnlyParity (R96b)", () => {
  it("reports a games-only player locked out when every badge is trading-scoped", () => {
    const parity = analyseGamesOnlyParity(
      [
        badge("t1", "legendary", ["trading"], "total_trades"),
        badge("t2", "epic", ["trading"], "win_rate"),
      ],
      GAMES,
    );
    expect(parity.gamesOnlyXp).toBe(0);
    expect(parity.ratio).toBe(0);
    expect(parity.verdict).toMatch(/locked out/i);
  });

  it("reports parity when the reachable XP matches", () => {
    const parity = analyseGamesOnlyParity(
      [
        badge("t1", "epic", ["trading"], "total_trades"),
        badge("g1", "epic", [SPRINT]),
        badge("p1", "rare", [], "xp_threshold"),
      ],
      GAMES,
    );
    expect(parity.gamesOnlyXp).toBe(parity.traderXp);
    expect(parity.ratio).toBe(1);
    expect(parity.verdict).toMatch(/comparable/i);
  });

  it("reports parity rather than a divide-by-zero when there are no badges", () => {
    // Reason: with nothing authored there is nothing to be unbalanced about, and
    // a NaN here would surface as a failing criterion on a fresh install.
    const parity = analyseGamesOnlyParity([], GAMES);
    expect(parity.ratio).toBe(1);
    expect(Number.isFinite(parity.score)).toBe(true);
  });
});

describe("evaluateSystem cross-game parity criterion (R96b)", () => {
  function evalBadge(
    id: string,
    gameTypes: string[] | undefined,
    conditionType: string,
  ): BadgeData {
    return {
      id,
      name: id,
      category: gameTypes?.some((t) => t.startsWith("provider:"))
        ? "Games"
        : "Trading",
      rarity: "epic",
      minLevel: 2,
      gameTypes,
      condition: { type: conditionType, value: 5, minTrades: 0 },
    };
  }

  const milestones: MilestoneData[] = [];

  it("is scored only when a catalogue is supplied", () => {
    // Reason: a trading-only deployment has no games-only player to be unfair
    // to, so scoring it there would read as a defect that cannot be fixed.
    const badges = [evalBadge("t1", ["trading"], "total_trades")];
    expect(
      evaluateSystem(badges, milestones, []).scores.crossGameParity,
    ).toBeUndefined();
    expect(
      evaluateSystem(badges, milestones, [], GAMES).scores.crossGameParity,
    ).toBeDefined();
  });

  it("raises a parity issue when every badge needs trading", () => {
    const result = evaluateSystem(
      [
        evalBadge("t1", ["trading"], "total_trades"),
        evalBadge("t2", ["trading"], "win_rate"),
      ],
      milestones,
      [],
      GAMES,
    );
    expect(result.scores.crossGameParity).toBe(0);
    expect(result.issues.some((i) => i.area === "crossGameParity")).toBe(true);
  });

  it("does not raise a parity issue when a games-only player can keep up", () => {
    const result = evaluateSystem(
      [
        evalBadge("t1", ["trading"], "total_trades"),
        evalBadge("g1", [SPRINT], "game_contests_completed"),
        evalBadge("g2", [PERFECT], "game_contests_completed"),
      ],
      milestones,
      [],
      GAMES,
    );
    expect(result.scores.crossGameParity).toBeGreaterThan(9);
    expect(result.issues.some((i) => i.area === "crossGameParity")).toBe(false);
  });
});

describe("neutral level ladder (R96b)", () => {
  it("proposes a monotonic ladder whose thresholds do not overlap", () => {
    const levels = proposeNeutralLadder();
    expect(levels.length).toBeGreaterThan(1);
    for (let i = 1; i < levels.length; i++) {
      const previous = levels.at(i - 1)!;
      const current = levels.at(i)!;
      expect(current.minXP).toBeGreaterThan(previous.minXP);
      expect(current.minXP).toBe(previous.maxXP + 1);
    }
    expect(levels[0]!.minXP).toBe(0);
    expect(levels[levels.length - 1]!.maxXP).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("names no game in any proposed title", () => {
    const audit = auditLadder(proposeNeutralLadder());
    expect(audit.tradingShapedTitles).toEqual([]);
    expect(audit.monotonic).toBe(true);
    expect(audit.verdict).toMatch(/neutral and monotonic/);
  });

  it("flags the shipped trading-shaped ladder rather than rewriting it", () => {
    const audit = auditLadder([
      { level: 1, title: "Novice Trader", minXP: 0, maxXP: 499 },
      { level: 2, title: "Trading Legend", minXP: 500, maxXP: 999 },
    ]);
    expect(audit.tradingShapedTitles).toHaveLength(2);
    expect(audit.verdict).toMatch(/name a specific game/);
  });

  it("flags a non-monotonic ladder", () => {
    const audit = auditLadder([
      { level: 1, title: "Rookie", minXP: 0, maxXP: 499 },
      { level: 2, title: "Challenger", minXP: 0, maxXP: 999 },
    ]);
    expect(audit.monotonic).toBe(false);
    expect(audit.verdict).toMatch(/not strictly increasing/);
  });
});

/**
 * Structural guards on the pipeline itself.
 *
 * Reason: the order and the add-only rule are the properties that matter, and
 * neither is observable from a unit test of any single helper.
 */
describe("run_full pipeline (structural)", () => {
  const root = process.cwd();

  /** Comments stripped — these files explain the anti-patterns in prose. */
  function readCode(relative: string): string {
    return readFileSync(join(root, relative), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  const route = readCode("apps/admin/app/api/ai/gamification-wizard/route.ts");
  const ui = readCode("apps/admin/components/admin/GamificationWizardSection.tsx");

  /**
   * Reason (R103): this test used to assert `runBadgeAgent(` and
   * `runMilestoneAgent(` appeared inside `run_full`, and it kept passing after
   * both were replaced by the deterministic blueprints — the slice runs to the
   * end of the file, so it was finding the `agent_badges` action's own call
   * sites further down. **Flipped rather than deleted**: the claim is now that
   * the pipeline does NOT reach for an AI agent, because a single model call
   * asked to cover the whole catalogue inside a token budget is what produced
   * five trading badges and reported success.
   */
  it("builds badges and journeys deterministically, not through an AI agent", () => {
    const block = route.slice(
      route.indexOf('action === "run_full"'),
      route.indexOf('action === "reset_gamification"'),
    );
    expect(block.length).toBeGreaterThan(500);

    const quota = block.indexOf("planBadgeQuota(");
    const badges = block.indexOf("buildBadgeBlueprint(");
    const journey = block.indexOf("buildJourneyBlueprint(");
    const autoFix = block.indexOf("applyAutoFixes(");
    const evaluate = block.indexOf("runEvaluation(");
    for (const position of [quota, badges, journey, autoFix, evaluate]) {
      expect(position).toBeGreaterThan(-1);
    }

    // The quota is the input to the blueprint, and the journey is built from
    // the same plan the badges are — that shared plan is what guarantees a
    // game cannot receive badges and no journey.
    expect(quota).toBeLessThan(badges);
    expect(badges).toBeLessThan(journey);
    // Deterministic fixes must land before the run is scored, or the score
    // describes a system that no longer exists.
    expect(autoFix).toBeLessThan(evaluate);

    expect(block).not.toMatch(/runBadgeAgent\(/);
    expect(block).not.toMatch(/runMilestoneAgent\(/);
  });

  /**
   * Reason (R103): the full setup shared `badgeGenCount` with the AI Badge
   * Agent card, whose input is capped at 20 and defaults to 5 — which is
   * literally why an operator who wiped the system was left with five badges.
   * The two numbers answer different questions and must not share state.
   */
  it("sizes the catalogue from its own control, not the AI agent's capped count", () => {
    const body = ui.slice(
      ui.indexOf("const runFullSetup"),
      ui.indexOf("const applyChanges"),
    );
    expect(body.length).toBeGreaterThan(200);
    expect(body).toMatch(/generateCount:\s*setupBadgeTarget/);
    expect(body).not.toMatch(/generateCount:\s*badgeGenCount/);

    // And the default is the economy engine's, never a second literal.
    expect(ui).toMatch(
      /useState\(\s*DEFAULT_TARGET_BADGE_TOTAL\s*,?\s*\)/,
    );
    // The field has to reach the screen, or the operator cannot change it.
    expect(ui).toMatch(/value=\{setupBadgeTarget\}/);
  });

  it("writes a ladder only when none exists", () => {
    const block = route.slice(route.indexOf('action === "run_full"'));
    const guard = block.indexOf("existingLevels.length === 0");
    const write = block.indexOf('writeXPConfig("level_progression"');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });

  it("drives badge generation in add-only mode", () => {
    const block = route.slice(
      route.indexOf('action === "run_full"'),
      route.indexOf('action === "agent_milestones"'),
    );
    // Badges stay add-only; milestones may replace on rebuild so Getting Started
    // leftovers do not sit beside the new maps.
    expect(block).toMatch(/writeBadgesBatch\([\s\S]*?mode:\s*"add-only"/);
  });

  it("always recalculates badge XP on run_full (never keeps the install defaults)", () => {
    // Reason: leaving `badge_xp` at 10/25/50/100 when the table already existed
    // made the XP Values screen look unchanged after a successful wizard run.
    const block = route.slice(
      route.indexOf('action === "run_full"'),
      route.indexOf('action === "reset_gamification"'),
    );
    expect(block).toMatch(/proposeBadgeXp\(/);
    expect(block).toMatch(/writeXPConfig\(\s*"badge_xp"/);
    // Levels may still be "kept" when reachable; badge XP must not.
    expect(block).toMatch(/action:\s*priorXp\?\.badgeXP\s*\?\s*"recalculated"/);
    expect(block).not.toMatch(/steps\.badgeXp\s*=\s*\{\s*action:\s*"kept"/);
  });

  it("exposes build_journeys for the Journey Map Full Sequence button", () => {
    expect(route).toMatch(/action === "build_journeys"/);
    const editor = readCode(
      "apps/admin/components/admin/JourneyMapEditorSection.tsx",
    );
    expect(editor).toMatch(/action:\s*"build_journeys"/);
    expect(editor).toMatch(/replaceExisting:\s*true/);
    // Reason: the trading AI path must not be the Full Sequence confirm target.
    const dialog = editor.slice(
      editor.indexOf("Generate journeys for every game"),
      editor.indexOf("Visual Milestone Placement"),
    );
    expect(dialog).not.toMatch(/generate_single_map/);
    expect(dialog).toMatch(/generateFullSequence/);
  });

  /**
   * Reason: every reported "no milestones, no zones" has been a REPORTING
   * defect rather than a write that failed. The blueprint planned 24, the
   * screen said 24, and nobody had asked the database. Two halves:
   *
   *  - the server reports what was STORED, and storing none is a refusal;
   *  - the screen reads those counts, and matches BOTH journey actions —
   *    `action === "blueprint"` alone fell through to the literal word
   *    "skipped" on every rebuild, because a rebuild reports
   *    `blueprint-replaced`.
   */
  it("build_journeys reports what was stored, and storing none refuses", () => {
    const block = route.slice(
      route.indexOf('action === "build_journeys"'),
      route.indexOf("Invalid action. Use:"),
    );
    expect(block.length).toBeGreaterThan(200);
    // The planned length must not be what `totalMilestones` reports.
    expect(block).not.toMatch(
      /totalMilestones:\s*journey\.milestones\.length/,
    );
    // Reason: this used to require the run's own created+updated counters, and
    // that assertion is now INVERTED rather than deleted. Those counters cannot
    // tell a rejected write from an add-only pass over a design that is already
    // complete — both are zero, and only one is broken. The figure is counted
    // out of the collections instead, which is the question being asked.
    expect(block).not.toMatch(
      /storedMilestones\s*=\s*milestoneWrite\.created\s*\+\s*milestoneWrite\.updated/,
    );
    expect(block).toMatch(/journeyState\(/);
    expect(block).toMatch(/storedMilestones\s*=\s*state\.milestones/);
    expect(block).toMatch(/totalMilestones:\s*storedMilestones/);
    // Zero stored is a refusal, not a success with a cheerful number.
    expect(block).toMatch(/storedMilestones === 0/);
    expect(block).toMatch(/success:\s*false/);
  });

  /**
   * Reason: `journeyState` is scoped to the maps the run planned, so an
   * unrelated legacy map cannot inflate the figure into a success. Scoped to
   * everything, a leftover `getting_started` row makes an empty rebuild read as
   * one stored map — which is the exact reassurance the refusal exists to deny.
   */
  it("the stored figures are counted from the collections, map-scoped", () => {
    const helper = route.slice(
      route.indexOf("async function journeyState("),
      route.indexOf("const dbTools = {"),
    );
    expect(helper.length).toBeGreaterThan(200);
    expect(helper).toMatch(/JourneyMilestone\.countDocuments\(\s*\{\s*mapId/);
    expect(helper).toMatch(/JourneyMapConfig\.find\(\s*\{\s*mapId:\s*\{\s*\$in/);
    expect(helper).not.toMatch(/countDocuments\(\s*\)/);
    // Zones are counted off the stored documents, never off the blueprint.
    expect(helper).toMatch(/zones\?\.length/);
    const full = route.slice(
      route.indexOf("steps.milestones = {"),
      route.indexOf('name: "Auto-Fix Engine"') > 0
        ? route.length
        : route.length,
    );
    expect(full).toMatch(/mapsStored:\s*state\.maps/);
    expect(full).toMatch(/zonesStored:\s*state\.zones/);
    // The old zone figure sliced the blueprint by a count, which attributes
    // zones to whichever maps happened to sort first.
    expect(full).not.toMatch(/mapsToWrite\s*\n?\s*\.slice\(0, mapWrite\.created\)/);
  });

  /**
   * Reason: the editor issued its first data fetch before the map list had been
   * answered, so it asked for the legacy `pirate_cove` id — which no generated
   * design contains — and rendered a placeholder with `zones: []` and no
   * milestones. Two fetches were then in flight and whether the real map
   * survived depended on which landed last, so a complete journey read as an
   * empty one intermittently, with nothing in any log. Both halves are needed:
   * the gate stops the wrong request, the ref stops a stale answer applying.
   */
  it("the editor waits for the map list and discards a stale answer", () => {
    const editor = readCode(
      "apps/admin/components/admin/JourneyMapEditorSection.tsx",
    );

    // The mount effect must not fetch unconditionally.
    const effect = editor.slice(
      editor.indexOf("if (!mapsLoaded) return;") - 400,
      editor.indexOf("if (!mapsLoaded) return;") + 120,
    );
    expect(effect).toContain("if (!mapsLoaded) return;");
    expect(effect).toMatch(/fetchData\(\)/);

    // The flag is raised however the list request ended, or a failed list
    // leaves the screen blank for good instead of using the legacy fallback.
    const loader = editor.slice(
      editor.indexOf("const loadAvailableMaps = useCallback"),
      editor.indexOf("const requestedMapRef"),
    );
    expect(loader.length).toBeGreaterThan(100);
    expect(loader).toMatch(/finally\s*\{[\s\S]*setMapsLoaded\(true\)/);

    // The stale-response guard must sit between the parse and the first
    // setState, or the placeholder still overwrites the real map.
    const fetcher = editor.slice(
      editor.indexOf("const fetchData = useCallback"),
      editor.indexOf("const loadSequenceMap"),
    );
    expect(fetcher.length).toBeGreaterThan(200);
    expect(fetcher).toMatch(/requestedMapRef\.current = targetMapId/);
    const bail = fetcher.indexOf("requestedMapRef.current !== targetMapId");
    expect(bail).toBeGreaterThan(-1);
    expect(bail).toBeLessThan(fetcher.indexOf("setMapConfig("));
    expect(bail).toBeLessThan(fetcher.indexOf("setMilestones("));
  });

  it("the journey row survives a rebuild and reads the stored counts", () => {
    const row = ui.slice(
      ui.indexOf('name: "Journeys & milestones"'),
      ui.indexOf('name: "Auto-Fix Engine"'),
    );
    expect(row.length).toBeGreaterThan(100);
    // A rebuild reports `blueprint-replaced`, so an equality test against the
    // add-only action alone renders the word "skipped" over a successful run.
    expect(row).not.toMatch(/s\.milestones\?\.action === "blueprint"\s*$/m);
    expect(row).toMatch(/milestonesStored/);
    expect(row).toMatch(/zonesStored/);
    // The row must be able to fail; `success: true` cannot report a bad write.
    expect(row).not.toMatch(/success:\s*true/);
  });

  it("a batch writer carries the first error out, not just a counter", () => {
    // A rejected write and a deliberate skip both incremented a number nobody
    // surfaced, so the cause stayed in the server log.
    expect(route).toMatch(/firstError:\s*null as string \| null/);
    const journeyStep = route.slice(
      route.indexOf("steps.milestones = {"),
      route.indexOf("steps.milestones = \"skipped\""),
    );
    expect(journeyStep).toMatch(
      /error:\s*mapWrite\.firstError\s*\?\?\s*milestoneWrite\.firstError/,
    );
  });

  it("reports the post-run gap so a second pass is measurable", () => {
    const block = route.slice(route.indexOf('action === "run_full"'));
    const evaluate = block.indexOf("runEvaluation(");
    const coverage = block.indexOf("computeCoverage(");
    expect(coverage).toBeGreaterThan(evaluate);
  });

  it("the wizard screen delegates the sequence to the server", () => {
    // The browser must not own the order or the add-only rule — a second owner
    // of either is how the two disagree.
    const body = ui.slice(
      ui.indexOf("const runFullSetup"),
      ui.indexOf("const applyChanges"),
    );
    expect(body.length).toBeGreaterThan(200);
    expect(body).toMatch(/action:\s*"run_full"/);
    expect(body).not.toMatch(/action:\s*"agent_badges"/);
    expect(body).not.toMatch(/action:\s*"agent_milestones"/);
    expect(body).not.toMatch(/action:\s*"auto_fix"/);
  });
});

/**
 * The wizard's second mode: delete everything and build again.
 *
 * Every guard here is about a destructive action that reports success. A wipe
 * whose defaults reseed seconds later, a rebuild that deletes and then does not
 * build, a confirmation phrase the screen and the server spell differently —
 * none of them throws, and the operator is told it worked in all three cases.
 */
describe("rebuild-from-scratch (R96b)", () => {
  const root = process.cwd();

  function readCode(relative: string): string {
    return readFileSync(join(root, relative), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  const service = readCode("apps/admin/lib/services/gamification-reset.service.ts");
  const route = readCode("apps/admin/app/api/ai/gamification-wizard/route.ts");
  const ui = readCode("apps/admin/components/admin/GamificationWizardSection.tsx");

  it("refuses without the exact confirmation phrase, before touching a database", async () => {
    // Reason: the two refusals run ahead of connectToDatabase on purpose, which
    // is also what makes them assertable here rather than only by inspection.
    //
    // Assert the REFUSAL'S OWN WORDING, not merely `success: false`. There is no
    // MONGODB_URI in the test environment, so a request that falls through the
    // guard fails on the connection and the service's catch returns
    // `success: false` too — a probe that deletes the guard is then green while
    // the wipe is wide open on any machine that does have a database.
    const { resetGamification, GAMIFICATION_RESET_CONFIRMATION } = await import(
      "../../apps/admin/lib/services/gamification-reset.service"
    );

    for (const phrase of ["", "reset gamification", "RESET  GAMIFICATION", "yes"]) {
      const result = await resetGamification({
        scopes: ["badges"],
        confirmation: phrase,
      });
      expect(result.success).toBe(false);
      expect(result.deleted).toBeUndefined();
      expect(result.error).toMatch(/Nothing was deleted/);
      expect(result.error).toContain(GAMIFICATION_RESET_CONFIRMATION);
    }

    const empty = await resetGamification({
      scopes: [],
      confirmation: GAMIFICATION_RESET_CONFIRMATION,
    });
    expect(empty.success).toBe(false);
    expect(empty.deleted).toBeUndefined();
    expect(empty.error).toMatch(/Nothing was deleted/);
    expect(empty.error).toMatch(/badges/);
  });

  it("ignores a scope it does not recognise rather than looking it up on an object", async () => {
    const { resetGamification, GAMIFICATION_RESET_CONFIRMATION } = await import(
      "../../apps/admin/lib/services/gamification-reset.service"
    );
    // "constructor" is truthy through an object's prototype chain and would
    // survive a `!allowed` test. A Set has no prototype chain, so the filter is
    // total and the request is refused for having no valid scope at all.
    //
    // Same reason as above for asserting the wording: without it, a lookup that
    // admits "constructor" is indistinguishable from an absent database.
    const result = await resetGamification({
      scopes: ["constructor", "__proto__", "toString"],
      confirmation: GAMIFICATION_RESET_CONFIRMATION,
    });
    expect(result.success).toBe(false);
    expect(result.deleted).toBeUndefined();
    expect(result.error).toMatch(/choose at least one/);
  });

  it("suppresses the shipped defaults, or the wipe is undone on the next read", () => {
    // getBadgesFromDB / getXPConfigFromDB reseed an empty collection. Without
    // the flags the delete succeeds, reports success, and the catalogue is back
    // within seconds with nothing in any log to say so.
    expect(service).toMatch(/setDefaultsSuppression/);
    expect(service).toMatch(/badgeDefaultsSuppressed:\s*true/);
    expect(service).toMatch(/xpDefaultsSuppressed:\s*true/);
  });

  it("sets the suppression flags AFTER the deletes", () => {
    // Set first, a delete that throws leaves the defaults suppressed over a
    // catalogue that still exists: no reseed, no wipe, and nothing on screen.
    const firstDelete = service.indexOf("deleteMany({})");
    const suppress = service.indexOf("setDefaultsSuppression(");
    expect(firstDelete).toBeGreaterThan(-1);
    expect(suppress).toBeGreaterThan(firstDelete);
  });

  it("keeps player-earned rows unless asked, and reports how many it orphaned", () => {
    // Deleting the design does not make an earned badge untrue.
    expect(service).toMatch(/includePlayerProgress\s*=\s*false/);
    // Literal patterns, one per collection: a constructed RegExp here would let
    // a typo in the collection name compile into a pattern that matches nothing.
    expect(service).toMatch(
      /orphanedPlayerProgress\.\w+\s*=\s*await UserBadge\.countDocuments/,
    );
    expect(service).toMatch(
      /orphanedPlayerProgress\.\w+\s*=\s*await UserLevel\.countDocuments/,
    );
    expect(service).toMatch(
      /orphanedPlayerProgress\.\w+\s*=\s*await UserJourneyProgress\.countDocuments/,
    );
  });

  it("wipes and rebuilds in ONE run, with the wipe before anything is read", () => {
    // Two presses is the arrangement where a wipe is not followed by a build,
    // and the suppression flags mean nothing covers for it.
    //
    // The anchor is the first READ of the system being rebuilt, deliberately,
    // and it is stronger than "before the badge agent": every build step here is
    // add-only and decides what to write from what it finds, so a read taken
    // before the wipe sees the ladder and the badges that are about to be
    // deleted, concludes nothing is missing, and writes nothing. The rebuild
    // then reports success over an empty platform.
    const block = route.slice(route.indexOf('action === "run_full"'));
    expect(block.length).toBeGreaterThan(500);
    const wipe = block.indexOf("resetGamification(");
    const firstRead = block.indexOf("readXPConfig(");
    expect(wipe).toBeGreaterThan(-1);
    expect(firstRead).toBeGreaterThan(-1);
    expect(wipe).toBeLessThan(firstRead);
  });

  it("defaults to add, so the destructive mode is never arrived at by inaction", () => {
    expect(route).toMatch(/mode\s*=\s*"add"/);
    const block = route.slice(route.indexOf('action === "run_full"'));
    expect(block).toMatch(/mode\s*===\s*"rebuild"/);
    expect(ui).toMatch(/useState<"add"\s*\|\s*"rebuild">\("add"\)/);
  });

  it("refuses the WHOLE run when the wipe is refused", () => {
    // Falling through to the add-only build after a refused wipe is the one
    // outcome an operator who mistyped the phrase would not expect, and it
    // reads as success.
    const block = route.slice(route.indexOf('action === "run_full"'));
    const refusal = block.indexOf("if (!reset.success)");
    const badges = block.indexOf("runBadgeAgent(");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(badges);
    expect(block.slice(refusal, badges)).toMatch(/return NextResponse\.json/);
  });

  it("the phrase and the scope ids have ONE definition, shared by both sides", () => {
    // A phrase that drifts refuses every reset while the screen insists the
    // operator typed it correctly; a scope id that drifts fails with a 400 that
    // reads like a permissions problem.
    const copy = readCode("apps/admin/lib/admin/gamification-reset-copy.ts");
    expect(copy).toMatch(/GAMIFICATION_RESET_CONFIRMATION\s*=\s*"RESET GAMIFICATION"/);
    // Neither consumer may declare its own.
    expect(service).not.toMatch(/GAMIFICATION_RESET_CONFIRMATION\s*=\s*"/);
    expect(ui).not.toMatch(/GAMIFICATION_RESET_CONFIRMATION\s*=\s*"/);
    expect(ui).toMatch(/from "@\/lib\/admin\/gamification-reset-copy"/);
  });

  it("the copy module reaches no model, because the panel is a client component", () => {
    // R58: anything the panel imports is bundled for the browser.
    const copy = readFileSync(
      join(root, "apps/admin/lib/admin/gamification-reset-copy.ts"),
      "utf8",
    );
    expect(copy).not.toMatch(/from "@\/database\//);
    expect(copy).not.toMatch(/mongoose|mongodb/);
  });

  it("disarms the panel after a rebuild", () => {
    // Leaving it armed means the next press of the same button wipes the system
    // that was just built.
    const body = ui.slice(
      ui.indexOf("const runFullSetup"),
      ui.indexOf("const applyChanges"),
    );
    expect(body.length).toBeGreaterThan(200);
    expect(body).toMatch(/setSetupMode\("add"\)/);
    expect(body).toMatch(/setResetConfirmation\(""\)/);
  });
});

describe("the deterministic generators are mirrored (R103)", () => {
  const root = join(__dirname, "..", "..");

  // Reason: `check:mirrors` compares MODELS, so it has no opinion about these
  // three. A drifted copy would mean the wizard generates one set of badges,
  // quotas or milestones and the player app assumes another — and the admin
  // copy is the one that runs when an operator presses the button.
  for (const file of [
    "gamification-economy.ts",
    "badge-blueprint.ts",
    "journey-blueprint.ts",
  ]) {
    it(`${file} is byte-identical in both apps`, () => {
      const main = readFileSync(join(root, "lib/services/games", file), "utf8");
      const admin = readFileSync(
        join(root, "apps/admin/lib/services/games", file),
        "utf8",
      );
      expect(admin.length).toBeGreaterThan(500);
      expect(admin).toBe(main);
    });
  }
});

describe("proposeBadgeXp scales with catalogue size", () => {
  it("never shrinks below the install defaults", () => {
    expect(proposeBadgeXp(1)).toEqual(DEFAULT_BADGE_XP);
    expect(proposeBadgeXp(49)).toEqual(DEFAULT_BADGE_XP);
  });

  it("scales so a 220-badge catalogue visibly moves the XP Values screen", () => {
    const xp = proposeBadgeXp(DEFAULT_TARGET_BADGE_TOTAL);
    expect(xp.common).toBeGreaterThan(DEFAULT_BADGE_XP.common);
    expect(xp).toEqual({
      common: 40,
      rare: 100,
      epic: 200,
      legendary: 400,
    });
  });
});

describe("journey blueprint skips the blank Getting Started map", () => {
  it("does not emit platform_journey or Getting Started", () => {
    const plan = planBadgeQuota(
      [
        { gameKey: "trading", name: "Trading" },
        { gameKey: SPRINT, name: "Circuit Sprint" },
      ],
      80,
    );
    const journey = buildJourneyBlueprint(plan, { earnableBadgeXp: 5000 });
    expect(journey.maps.some((m) => m.mapId === "platform_journey")).toBe(
      false,
    );
    expect(
      journey.maps.some((m) => /getting started/i.test(m.name)),
    ).toBe(false);
    expect(journey.maps.length).toBeGreaterThan(0);
    expect(journey.milestones.length).toBeGreaterThan(0);
    // Reason: player canvas is 1200×800 pixels — percent coords (10–90) pile
    // every node into the top-left corner and look like a blank map.
    for (const m of journey.milestones) {
      expect(m.position.x).toBeGreaterThan(50);
      expect(m.position.y).toBeGreaterThan(50);
    }
  });
});

describe("player sequence API hides empty / Getting Started maps", () => {
  it("filters platform_journey and zero-milestone maps", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "app/api/journey/maps/sequence/route.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toMatch(/HIDDEN_MAP_IDS/);
    expect(src).toMatch(/platform_journey/);
    expect(src).toMatch(/getting_started/);
    expect(src).toMatch(/JourneyMilestone\.aggregate/);
    expect(src).toMatch(/countByMap/);
  });
});
