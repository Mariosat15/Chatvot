import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guards for the phone Competition Arena (`External game plans/competitionmobile`).
 *
 * Reason: the phone tree must be its own layout below `md`, never the desktop
 * card squeezed onto a phone, and it must page by scrolling rather than by the
 * desktop pagination. Comments are stripped first because these files explain
 * the anti-patterns in prose.
 */
const ROOT = path.resolve(__dirname, "../..");
const MOBILE_DIR = path.join(ROOT, "components/competitions/arena/mobile");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function readCode(relative: string): string {
  return stripComments(readFileSync(path.join(ROOT, relative), "utf8"));
}

const mobileFiles = readdirSync(MOBILE_DIR).filter((f) => /\.tsx?$/.test(f));
const mobileCode = (name: string) =>
  readCode(path.join("components/competitions/arena/mobile", name));

describe("competition arena on a phone", () => {
  it("reads a non-empty mobile directory", () => {
    expect(mobileFiles.length).toBeGreaterThanOrEqual(6);
  });

  it("splits the page into a phone tree and a desktop tree", () => {
    const page = readCode("app/(root)/competitions/page-content.tsx");
    const phone = page.indexOf('className="md:hidden"');
    const desktop = page.indexOf('className="hidden md:block"');
    expect(phone).toBeGreaterThan(-1);
    expect(desktop).toBeGreaterThan(phone);
    expect(page.slice(phone, desktop)).toContain("<MobileCompetitionsArena");
    expect(page.slice(desktop)).toContain("<CompetitionsArena");
    expect(page.slice(phone, desktop)).toContain("mobilePages.items");
  });

  it.each(mobileFiles)("%s does not reuse the desktop card or list row", (file) => {
    const code = mobileCode(file);
    expect(code).not.toMatch(/ArenaCompetitionCard\b/);
    expect(code).not.toMatch(/ArenaCompetitionListRow\b/);
    expect(code).not.toMatch(/ArenaPagination\b/);
    expect(code).not.toMatch(/\bviewMode\b/);
  });

  it("draws the cover in a 3:4 box beside the details", () => {
    const card = mobileCode("MobileCompetitionCard.tsx");
    const hero = card.indexOf("<CardHero");
    expect(hero).toBeGreaterThan(-1);
    const tag = card.slice(hero, card.indexOf("/>", hero));
    expect(tag).toContain("aspect-[3/4]");
  });

  it("loads the next page when a sentinel scrolls into view", () => {
    const list = mobileCode("MobileArenaInfiniteList.tsx");
    expect(list).toContain("new IntersectionObserver(");
    expect(list).toMatch(/observer\.observe\(/);
    expect(list).toContain("Loading more competitions...");
    expect(list).toContain("COMPETITIONS_PAGE_SIZE");
  });

  it("keeps desktop on numbered pages", () => {
    const desktop = readCode("components/competitions/arena/CompetitionsArena.tsx");
    expect(desktop).toContain("<ArenaPagination");
  });

  it("builds both trees' cards from one presentation helper", () => {
    const desktop = readCode("components/competitions/arena/CompetitionsArena.tsx");
    const phone = mobileCode("MobileCompetitionsArena.tsx");
    for (const code of [desktop, phone]) {
      expect(code).toMatch(/arena-shared"/);
      expect(code).toContain("buildArenaPresentations(");
    }
  });

  it("keeps the phone's extra pages out of the shared desktop list", () => {
    const hook = mobileCode("useMobileArenaPages.ts");
    expect(hook).toContain("[...baseItems, ...extraItems]");
    expect(hook).toMatch(/\}, \[resetKey\]\);/);
  });

  it("draws native filter selects on an opaque background (R60)", () => {
    const filters = mobileCode("MobileArenaFilters.tsx");
    const select = filters.indexOf("<select");
    expect(select).toBeGreaterThan(-1);
    const tag = filters.slice(select, filters.indexOf(">\n", select));
    expect(tag).toContain("bg-[#06122e]");
    expect(tag).not.toMatch(/bg-[a-z]+-\d+\/\d+/);
  });
});
