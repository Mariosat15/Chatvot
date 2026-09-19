/**
 * R64 player twin — dashboard Performance tab surfaces ranked game rounds.
 *
 * The aggregation logic is pinned by `__tests__/admin/player-game-performance.test.ts`.
 * This suite pins the player delivery: the service lives in the main app, the
 * dashboard action fetches it, and the Performance tab mounts the panel ABOVE
 * trading chrome (so a games-only player is not buried under empty trade rings).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("R64 player dashboard twin", () => {
  it("keeps the main service behaviourally aligned with the admin copy", () => {
    // Reason: not check:mirrors — both are services. A drifted best-score sort
    // would show opposite "best" on admin vs player for a time trial.
    const main = read("lib/services/games/player-game-performance.service.ts");
    const admin = read(
      "apps/admin/lib/services/games/player-game-performance.service.ts",
    );
    expect(main).toContain("SCORE_PRODUCING_ROUND_STATUSES");
    expect(admin).toContain("SCORE_PRODUCING_ROUND_STATUSES");
    expect(main).toContain('direction === "lower_is_better" ? 1 : -1');
    expect(admin).toContain('direction === "lower_is_better" ? 1 : -1');
    expect(main).toContain('mode: "ranked"');
    expect(admin).toContain('mode: "ranked"');
  });

  it("fetches game performance inside getComprehensiveDashboardData", () => {
    const code = stripComments(
      read("lib/actions/comprehensive-dashboard.actions.ts"),
    );
    expect(code).toMatch(
      /import\s*\{[^}]*getPlayerGamePerformance[^}]*\}\s*from\s*"@\/lib\/services\/games\/player-game-performance\.service"/,
    );
    expect(code).toContain("getPlayerGamePerformance(userId)");
    expect(code).toContain("gamePerformance:");
  });

  it("mounts the games panel above trading performance on the Performance tab", () => {
    const code = stripComments(
      read("components/dashboard/DashboardLayout.tsx"),
    );
    const panel = code.indexOf("<PlayerGamePerformancePanel");
    const tradingHeading = code.indexOf("Trading performance");
    const rings = code.indexOf("<PerformanceRings");
    expect(panel).toBeGreaterThan(-1);
    expect(tradingHeading).toBeGreaterThan(-1);
    expect(rings).toBeGreaterThan(-1);
    expect(panel).toBeLessThan(tradingHeading);
    expect(tradingHeading).toBeLessThan(rings);
    // Reason: games must not be gated on totalTrades — that is the admin defect.
    const performanceTab = code.slice(
      code.indexOf('value="performance"'),
      code.indexOf('value="contests"'),
    );
    expect(performanceTab).not.toMatch(/totalTrades\s*===\s*0/);
  });

  it("keeps the client panel free of service / model imports (R58)", () => {
    const code = stripComments(
      read("components/dashboard/PlayerGamePerformancePanel.tsx"),
    );
    expect(code).not.toMatch(/from\s+"@\/lib\/services\//);
    expect(code).not.toMatch(/from\s+"@\/database\//);
    expect(code).not.toMatch(/\bmongoose\b/);
  });

  it("forbids game codes in the player panel (no-developer-needed)", () => {
    const code = stripComments(
      read("components/dashboard/PlayerGamePerformancePanel.tsx"),
    );
    expect(code).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);
  });
});
