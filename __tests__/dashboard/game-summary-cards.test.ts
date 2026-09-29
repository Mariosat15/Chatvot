/**
 * Dashboard per-game summary cards (13 s5.1f) — structural guards.
 *
 * Pins: action loads getPlayerGameProfile; GameSummaryCards component rules.
 * Overview mount moved to Play-by-Game top-4 on 29 Sep 2026 (13 s5.1g) —
 * layout assertion flipped rather than deleted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Dashboard per-game summary cards (13 s5.1f)", () => {
  const actionPath = "lib/actions/comprehensive-dashboard.actions.ts";
  const typesPath = "lib/actions/dashboard/types.ts";
  const layoutPath = "components/dashboard/DashboardLayout.tsx";
  const cardsPath = "components/dashboard/GameSummaryCards.tsx";
  const playPath = "components/dashboard/overview/OverviewPlayByGame.tsx";

  it("mega-action loads getPlayerGameProfile into gameStanding", () => {
    const source = stripComments(read(actionPath));
    expect(source).toMatch(
      /from\s+["']@\/lib\/services\/games\/player-game-stats\.service["']/,
    );
    expect(source).toMatch(/getPlayerGameProfile\s*\(/);
    // Reason: position — must appear in the returned payload, not only as a catch.
    const returnIdx = source.lastIndexOf("return {");
    expect(returnIdx).toBeGreaterThan(-1);
    const payload = source.slice(returnIdx);
    expect(payload).toMatch(/gameStanding\s*,/);
  });

  it("dashboard types declare gameStanding from PlayerGameProfile", () => {
    const source = stripComments(read(typesPath));
    expect(source).toMatch(
      /import\s+type\s+\{\s*PlayerGameProfile\s*\}/,
    );
    expect(source).toMatch(/gameStanding:\s*PlayerGameProfile/);
  });

  it("Overview mounts Play-by-Game (not GameSummaryCards) since s5.1g", () => {
    const source = stripComments(read(layoutPath));
    // Reason: flipped — GameSummaryCards was the Overview strip until 29 Sep 2026.
    expect(source).not.toMatch(/GameSummaryCards/);
    expect(source).toMatch(/OverviewPlayByGame/);
    const mounts = source.match(/<OverviewPlayByGame\b/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(source).toMatch(
      /<OverviewPlayByGame\s+cards=\{overviewStanding\.playCards\}\s*\/>/,
    );
  });

  it("Play-by-Game does not enumerate getEnabledGameTypes (R29)", () => {
    const source = stripComments(read(playPath));
    expect(source).not.toMatch(/getEnabledGameTypes/);
  });

  it("cards do not recompute totals or call getEnabledGameTypes (R29)", () => {
    const source = stripComments(read(cardsPath));
    expect(source).not.toMatch(/getEnabledGameTypes/);
    expect(source).not.toMatch(/UserGameStats/);
    expect(source).not.toMatch(/contestsEntered\s*\+/);
    expect(source).not.toMatch(/reduce\s*\(/);
    // Reason: R58 — no value import of a model-reaching module.
    expect(source).not.toMatch(
      /from\s+["']@\/lib\/services\/games\/player-game-stats/,
    );
    expect(source).not.toMatch(/from\s+["']mongoose["']/);
  });

  it("best finish absents as dash and trading rating is withheld", () => {
    const source = stripComments(read(cardsPath));
    expect(source).toMatch(/rank\s*<=\s*0/);
    expect(source).toMatch(/return\s+["']—["']/);
    // Reason: trading branch must dash rating, not invent a number.
    expect(source).toMatch(/game\.isTrading\s*\?\s*["']—["']/);
  });

  it("empty perGame list renders null (no empty card grid)", () => {
    const source = stripComments(read(cardsPath));
    expect(source).toMatch(
      /if\s*\(\s*standing\.perGame\.length\s*===\s*0\s*\)\s*return\s+null/,
    );
  });
});
