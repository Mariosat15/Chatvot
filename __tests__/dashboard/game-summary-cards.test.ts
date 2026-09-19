/**
 * Dashboard per-game summary cards (13 s5.1f) — structural guards.
 *
 * Pins: action loads getPlayerGameProfile; layout mounts GameSummaryCards;
 * component does not recompute aggregates or call getEnabledGameTypes (R29);
 * best finish absents as dash; rating withheld on trading; R58 no mongoose
 * value import in the client card.
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

  it("layout mounts GameSummaryCards with gameStanding on Overview", () => {
    const source = stripComments(read(layoutPath));
    expect(source).toMatch(/import GameSummaryCards from ["']\.\/GameSummaryCards["']/);
    expect(source).toMatch(/gameStanding/);
    // Reason: count the mount — one Overview placement, not a second hand-rolled grid.
    const mounts = source.match(/<GameSummaryCards\b/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(source).toMatch(
      /<GameSummaryCards\s+standing=\{gameStanding\}\s*\/>/,
    );
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
