import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Mobile Games Catalogue launcher (8 Oct 2026).
 *
 * Dedicated tree below md — not the desktop grid stacked. Desktop must stay on
 * DesktopGamesCatalogue / GameCatalogueCard.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const HUB = "app/(root)/games/page.tsx";
const MOBILE = "components/games/catalogue/mobile/MobileGamesCatalogue.tsx";
const MOBILE_CARD = "components/games/catalogue/mobile/MobileGameCard.tsx";
const MOBILE_HEADER = "components/games/catalogue/mobile/MobileGamesHeader.tsx";
const DESKTOP = "components/games/catalogue/DesktopGamesCatalogue.tsx";
const DESKTOP_CARD = "components/games/catalogue/GameCatalogueCard.tsx";

describe("games catalogue mobile launcher", () => {
  it("splits desktop and mobile trees at md without sharing the desktop card", () => {
    const hub = readCode(HUB);
    expect(hub).toMatch(/hidden md:block/);
    expect(hub).toMatch(/md:hidden/);
    expect(hub).toMatch(/DesktopGamesCatalogue/);
    expect(hub).toMatch(/MobileGamesCatalogue/);
    expect(existsSync(join(ROOT, DESKTOP))).toBe(true);
    expect(existsSync(join(ROOT, MOBILE))).toBe(true);
    // Reason: importing the desktop card into the mobile tree is exactly "stack desktop".
    expect(readCode(MOBILE)).not.toMatch(/GameCatalogueCard|from ["'].*GameCatalogueCard/);
    expect(readCode(MOBILE_CARD)).not.toMatch(/GameCatalogueCard/);
  });

  it("does not scale or transform the desktop layout onto the phone", () => {
    const mobile = readCode(MOBILE);
    const card = readCode(MOBILE_CARD);
    expect(mobile + card).not.toMatch(/scale\(|transform:\s*scale|zoom:/);
  });

  it("shows featured games first without a separate hero section", () => {
    const mobile = readCode(MOBILE);
    expect(mobile).toMatch(/isFeatured/);
    expect(mobile).toMatch(/sort\(/);
    expect(mobile).not.toMatch(/Featured Game/);
    expect(readCode(MOBILE_CARD)).toMatch(/FEATURED|Featured/);
  });

  it("mobile cards are full-width launcher tiles with cover art and View Game CTA", () => {
    const card = readCode(MOBILE_CARD);
    expect(card).toMatch(/aspect-\[16\/9\]/);
    expect(card).toMatch(/object-cover/);
    expect(card).toMatch(/View Game/);
    expect(card).toMatch(/\/games\/\$\{game\.slug\}/);
    expect(card).not.toMatch(/href=\{?["'`]\/play/);
    expect(card).toMatch(/h-\[50px\]|h-\[48px\]|h-\[52px\]|h-\[54px\]/);
    expect(card).toMatch(/resolveGameCardAccent/);
    expect(card).not.toMatch(/nth-child/);
  });

  it("mobile hero is CATALOGUE + GAMES wordmark with short copy", () => {
    const header = readCode(MOBILE_HEADER);
    expect(header).toMatch(/Catalogue/);
    expect(header).toMatch(/games-catalogue-title-r1\.png/);
    expect(header).toMatch(/jump into the action/i);
    expect(header).not.toMatch(/AnalyticsPageHeadline/);
  });

  it("desktop shell still mounts the Games Catalog headline and 3-column grid", () => {
    const desktop = readCode(DESKTOP);
    expect(desktop).toMatch(/GamesHero/);
    expect(desktop).toMatch(/GamesGrid/);
    expect(desktop).toMatch(/GameCatalogueFilters/);
    expect(readCode(DESKTOP_CARD)).toMatch(/object-contain/);
    expect(readCode("components/games/catalogue/GamesHero.tsx")).toMatch(
      /AnalyticsPageHeadline/,
    );
  });
});
