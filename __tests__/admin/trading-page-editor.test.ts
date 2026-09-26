import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TRADING_PAGE_DEFAULTS,
  TRADING_PAGE_GAME_KEY,
} from "@/lib/services/games/trading-page-defaults";
import { ADMIN_SECTIONS } from "../../apps/admin/database/models/admin-employee.model";
import { TRADING_SECTION_TABS } from "../../apps/admin/lib/admin/game-sections";

const ROOT = path.resolve(__dirname, "../..");

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("trading page editor", () => {
  it("defaults and game key are byte-identical in both apps", () => {
    const main = readFileSync(
      path.join(ROOT, "lib/services/games/trading-page-defaults.ts"),
      "utf8",
    );
    const admin = readFileSync(
      path.join(ROOT, "apps/admin/lib/services/games/trading-page-defaults.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("GamePageContent model is byte-identical in both apps", () => {
    const main = readFileSync(
      path.join(ROOT, "database/models/games/game-page-content.model.ts"),
      "utf8",
    );
    const admin = readFileSync(
      path.join(ROOT, "apps/admin/database/models/games/game-page-content.model.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("ships trading-forge as the default theme and trading as the key", () => {
    expect(TRADING_PAGE_GAME_KEY).toBe("trading");
    expect(TRADING_PAGE_DEFAULTS.pageThemeId).toBe("trading-forge");
    expect(TRADING_PAGE_DEFAULTS.displayName).toBe("Trading");
  });

  // Reason: R58 — TradingPageSection is "use client" and imports this module. The
  // `@/lib/games` barrel connects mongoose → mongodb driver → next build dies with
  // 17 Module-not-found errors. types is model-free; the barrel is not.
  it("defaults import TRADING_GAME_TYPE from types, never the games barrel", () => {
    const source = stripComments(
      readFileSync(
        path.join(ROOT, "apps/admin/lib/services/games/trading-page-defaults.ts"),
        "utf8",
      ),
    );
    expect(source).toMatch(
      /from\s+["']@\/lib\/games\/types["']/,
    );
    expect(source).not.toMatch(/from\s+["']@\/lib\/games["']/);
  });

  it("trading-page is a real section grant and a Trading tab", () => {
    expect(ADMIN_SECTIONS as readonly string[]).toContain("trading-page");
    expect(TRADING_SECTION_TABS.map((t) => t.id)).toContain("trading-page");
  });

  it("admin routes guard trading-page and never game-providers", () => {
    const contentRoute = stripComments(
      readFileSync(
        path.join(
          ROOT,
          "apps/admin/app/api/games/trading/page-content/route.ts",
        ),
        "utf8",
      ),
    );
    const artworkRoute = stripComments(
      readFileSync(
        path.join(ROOT, "apps/admin/app/api/games/trading/artwork/route.ts"),
        "utf8",
      ),
    );

    expect(contentRoute).toMatch(/guardSection\(\s*"trading-page"\s*\)/);
    expect(artworkRoute).toMatch(/guardSection\(\s*"trading-page"\s*\)/);
    expect(contentRoute).not.toMatch(/guardSection\(\s*"game-providers"\s*\)/);
    expect(artworkRoute).not.toMatch(/guardSection\(\s*"game-providers"\s*\)/);
  });

  it("TradingPageSection reuses the games editors with trading endpoints", () => {
    const source = stripComments(
      readFileSync(
        path.join(
          ROOT,
          "apps/admin/components/admin/trading/TradingPageSection.tsx",
        ),
        "utf8",
      ),
    );
    expect(source).toContain('"/api/games/trading/page-content"');
    expect(source).toContain('"/api/games/trading/artwork"');
    expect(source).toContain("GameContentDialog");
    expect(source).toContain("GamePageThemeEditor");
    // Reason: no Settings tab — trading settings live on the other Trading sections.
    expect(source).not.toMatch(/sections\s*=\s*"settings"/);
    expect(source).not.toContain("GameScoringDialog");
  });

  it("counts exported handlers against guards on both trading page routes", () => {
    for (const rel of [
      "apps/admin/app/api/games/trading/page-content/route.ts",
      "apps/admin/app/api/games/trading/artwork/route.ts",
    ]) {
      const source = stripComments(
        readFileSync(path.join(ROOT, rel), "utf8"),
      );
      const handlers = [
        ...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/g),
      ];
      const guards = [...source.matchAll(/guardSection\(/g)];
      expect(
        guards.length,
        `${rel}: every exported handler must call guardSection`,
      ).toBe(handlers.length);
      expect(handlers.length).toBeGreaterThan(0);
    }
  });
});
