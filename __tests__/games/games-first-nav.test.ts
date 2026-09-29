import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS, DASHBOARD_TABS } from "@/lib/constants";

/**
 * Overview Header destinations + sidebar games-first rule.
 *
 * Header carries Overview/Wallet/Performance/Competitions/Tutorials.
 * Games stays on the sidebar with HOT (recorded Header deviation).
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("dashboard Header NAV_ITEMS", () => {
  it("lists the five Overview mock destinations with ?tab= deep links", () => {
    expect(NAV_ITEMS.map((i) => i.tab)).toEqual([
      "overview",
      "wallet",
      "performance",
      "contests",
      "tutorials",
    ]);
    for (const item of NAV_ITEMS) {
      expect(item.href).toBe(`/dashboard?tab=${item.tab}`);
    }
    expect(DASHBOARD_TABS).toEqual(NAV_ITEMS.map((i) => i.tab));
  });

  it("does not put /games in the Header list", () => {
    expect(NAV_ITEMS.every((i) => !i.href.startsWith("/games"))).toBe(true);
  });
});

describe("games-first navigation (sidebar)", () => {
  it("sidebar puts HOT on Games and not on Competitions", () => {
    const code = readCode("components/UserSidebar.tsx");
    const gamesIdx = code.indexOf('href: "/games"');
    const compsIdx = code.indexOf('href: "/competitions"');
    const challengesIdx = code.indexOf('href: "/challenges"');
    expect(gamesIdx).toBeGreaterThan(-1);
    expect(compsIdx).toBeGreaterThan(gamesIdx);
    expect(challengesIdx).toBeGreaterThan(compsIdx);

    const gamesBlock = code.slice(gamesIdx, compsIdx);
    const compsBlock = code.slice(compsIdx, challengesIdx);
    expect(gamesBlock).toMatch(/badge:\s*"HOT"/);
    expect(compsBlock).not.toMatch(/badge:\s*"HOT"/);
  });

  it("mobile nav includes /games", () => {
    const code = readCode("components/MobileBottomNav.tsx");
    expect(code).toMatch(/href:\s*"\/games"/);
    expect(code).toMatch(/href:\s*"\/competitions"/);
    /*
      Reason: flipped 29 Sep 2026. The five-tab phone nav (Home/Games/Compete/Wallet/
      Profile) has no /challenges tab; the Compete tab lights on /challenges instead,
      and the route stays in the UserSidebar drawer and the Overview's Quick Access.
    */
    expect(code).not.toMatch(/href:\s*"\/challenges"/);
    expect(code).toMatch(/alsoActive:\s*\[[^\]]*"\/challenges"/);
    expect(readCode("components/UserSidebar.tsx")).toMatch(/href:\s*"\/challenges"/);
  });
});
