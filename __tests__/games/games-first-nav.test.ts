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

  it("Header uses Lucide gold-pill tabs; neon HUD art stays off the live strip", () => {
    /*
      Reason: flipped twice 29 Sep 2026 — first away from five floating plates,
      then away from the shared neon frame. Owner asked to restore the pre-neon
      Lucide strip (gold active pill, white inactive) with a light polish.
    */
    const nav = readCode("components/NavItems.tsx");
    expect(nav).toMatch(/LayoutDashboard/);
    expect(nav).toMatch(/rounded-full/);
    expect(nav).toMatch(/ring-amber/);
    expect(nav).toMatch(/text-white/);
    expect(nav).not.toMatch(/OVERVIEW_NAV_TAB_ART/);
    expect(nav).not.toMatch(/nav-frame/);
    expect(nav).not.toMatch(/tab-overview\.png/);
    expect(nav).not.toMatch(/clip-path:polygon/);
    expect(nav).not.toMatch(/from ["']next\/image["']/);
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
