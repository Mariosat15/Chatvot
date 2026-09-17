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
      expect(levels[i]!.minXP).toBeGreaterThan(levels[i - 1]!.minXP);
      expect(levels[i]!.minXP).toBe(levels[i - 1]!.maxXP + 1);
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

  it("chains all four stages in one action", () => {
    const block = route.slice(route.indexOf('action === "run_full"'));
    expect(block.length).toBeGreaterThan(500);
    const badges = block.indexOf("runBadgeAgent(");
    const milestones = block.indexOf("runMilestoneAgent(");
    const autoFix = block.indexOf("applyAutoFixes(");
    const evaluate = block.indexOf("runEvaluation(");
    for (const position of [badges, milestones, autoFix, evaluate]) {
      expect(position).toBeGreaterThan(-1);
    }
    // Deterministic fixes must land before the run is scored, or the score
    // describes a system that no longer exists.
    expect(autoFix).toBeLessThan(evaluate);
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
    expect(block).toMatch(/mode:\s*"add-only"/);
    expect(block).not.toMatch(/mode:\s*"replace"/);
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
    for (const collection of ["UserBadge", "UserLevel", "UserJourneyProgress"]) {
      expect(service).toMatch(
        new RegExp(`orphanedPlayerProgress\\.\\w+\\s*=\\s*await ${collection}\\.countDocuments`),
      );
    }
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
