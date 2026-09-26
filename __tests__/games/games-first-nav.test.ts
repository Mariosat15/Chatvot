import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS } from "@/lib/constants";

/**
 * X11 Slice 1 — games-first navigation.
 *
 * HOT lives on Games, not Competitions. `/competitions` and `/challenges` stay.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("games-first navigation", () => {
  it("NAV_ITEMS lists /games above /competitions", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain("/games");
    expect(hrefs.indexOf("/games")).toBeLessThan(hrefs.indexOf("/competitions"));
  });

  it("sidebar puts HOT on Games and not on Competitions", () => {
    const code = readCode("components/UserSidebar.tsx");
    // Slice from Games entry to Challenges so Competitions' former HOT cannot satisfy.
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
    expect(code).toMatch(/href:\s*"\/challenges"/);
  });
});
