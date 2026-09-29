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

  it("desktop Header is one shared neon frame with tabs inside; phone keeps Lucide pills", () => {
    /*
      Reason: flipped 29 Sep 2026 — five floating plates were the wrong reading of
      the individual button assets. Owner image 2 is ONE outer frame with the five
      destinations inside (orange active chip, cyan inactive, vertical dividers).
      The neon frame stays md+ only; Lucide pills stay for MobileTabStrip.
    */
    const nav = readCode("components/NavItems.tsx");
    expect(nav).toMatch(/OVERVIEW_NAV_TAB_ART\.frame/);
    expect(nav).toMatch(/nav-frame|OVERVIEW_NAV_TAB_ART\.frame/);
    expect(nav).toMatch(/md:block/);
    expect(nav).toMatch(/md:hidden/);
    expect(nav).toMatch(/clip-path:polygon/);
    expect(nav).toMatch(/LayoutDashboard/);
    // Reason: floating per-tab plates must not come back — that was the disaster screenshot.
    // Do not ban the substring TAB_ART: OVERVIEW_NAV_TAB_ART.frame is the shared shell.
    expect(nav).not.toMatch(/tab-overview\.png/);
    expect(nav).not.toMatch(/\["overview",\s*OVERVIEW_NAV_TAB_ART\.overview\]/);
    expect(nav).not.toMatch(/new Map<\s*DashboardNavTab,\s*string\s*>/);
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

  it("phones reach /games, /competitions and /challenges without a bottom nav", () => {
    /*
      Reason: flipped twice, not deleted. The five-tab phone bar (29 Sep 2026) was
      removed outright the same day on the owner's instruction - the logo bar's menu
      opens the UserSidebar drawer, which is now the phone's only nav, so the three
      routes must be in it. The Overview's Quick Access still links challenges too.
    */
    const sidebar = readCode("components/UserSidebar.tsx");
    expect(sidebar).toMatch(/href:\s*"\/games"/);
    expect(sidebar).toMatch(/href:\s*"\/competitions"/);
    expect(sidebar).toMatch(/href:\s*"\/challenges"/);
    expect(readCode("app/(root)/layout.tsx")).not.toMatch(/MobileBottomNav/);
  });
});
