import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveCompetitionLeverage,
  storedLeverageCeiling,
} from "@/lib/services/trading/competition-leverage";
import {
  GM_EQUITY_DRAWDOWN_DEFAULT_PERCENT,
  GM_EQUITY_DRAWDOWN_MAX_PERCENT,
  gmEquityCheckExplanation,
  resolveGmEquityDrawdownPercent,
} from "@/lib/services/gamemaster/gm-equity-check";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/*
  Reason: an operator setting 1:20 in the wizard saw 1:100 on the lobby (owner, 12 Oct 2026).
  The admin create action stored the platform maximum, the edit path dropped the field, and the
  Game Master route stored a bare number the readers could not see. These pin the one producer
  and the one reader every path now goes through.
*/
describe("competition leverage", () => {
  const platform = { minLeverage: 1, maxLeverage: 100, defaultLeverage: 50 };

  it("stores the leverage the operator chose, not the platform ceiling", () => {
    expect(resolveCompetitionLeverage(20, platform)).toEqual({
      enabled: true,
      min: 1,
      max: 20,
      default: 20,
    });
  });

  it("clamps a request above the platform ceiling", () => {
    expect(resolveCompetitionLeverage(500, platform).max).toBe(100);
  });

  it("falls back to the platform ceiling when nothing was chosen", () => {
    expect(resolveCompetitionLeverage(undefined, platform).max).toBe(100);
  });

  it("reads both stored shapes - object and legacy bare number", () => {
    expect(storedLeverageCeiling({ max: 20 })).toBe(20);
    expect(storedLeverageCeiling(30)).toBe(30);
    expect(storedLeverageCeiling(undefined)).toBeUndefined();
  });

  it("the shared helper is byte-identical in both apps", () => {
    expect(
      read("apps/admin/lib/services/trading/competition-leverage.ts"),
    ).toBe(read("lib/services/trading/competition-leverage.ts"));
  });
});

describe("Game Master equity check", () => {
  it("is capped at 50% and defaults when the value is missing", () => {
    expect(resolveGmEquityDrawdownPercent(80)).toBe(
      GM_EQUITY_DRAWDOWN_MAX_PERCENT,
    );
    expect(GM_EQUITY_DRAWDOWN_MAX_PERCENT).toBe(50);
    expect(resolveGmEquityDrawdownPercent(undefined)).toBe(
      GM_EQUITY_DRAWDOWN_DEFAULT_PERCENT,
    );
    expect(resolveGmEquityDrawdownPercent(Number.NaN)).toBe(
      GM_EQUITY_DRAWDOWN_DEFAULT_PERCENT,
    );
    expect(resolveGmEquityDrawdownPercent(15)).toBe(15);
  });

  it("the explanation quotes the chosen percent", () => {
    expect(gmEquityCheckExplanation(25)).toContain("25%");
  });

  it("the route always stores it switched on, in both branches", () => {
    const route = read("app/api/gamemaster/competitions/route.ts");
    expect(
      route.match(/equityCheckEnabled: true/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(route).not.toMatch(/equityCheckEnabled: false/);
  });

  it("the wizard checkbox cannot be unticked", () => {
    const panel = read("components/gamemaster/GmEquityCheckPanel.tsx");
    expect(panel).toMatch(/checked\s+disabled/);
  });
});
