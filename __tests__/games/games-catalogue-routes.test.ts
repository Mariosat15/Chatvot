import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * X11 Slice 1 — games catalogue routes.
 *
 * Structural: pages exist; game page never launches a round on GET; contest links go to
 * lobbies not `/play`; empty state is designed.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const HUB = "app/(root)/games/page.tsx";
const GAME_PAGE = "app/(root)/games/[slug]/page.tsx";
const CARD = "components/games/catalogue/GameCatalogueCard.tsx";
const GRID = "components/games/catalogue/GamesGrid.tsx";
const CONTESTS = "components/games/catalogue/GameContestList.tsx";
const EMPTY = "components/game-page/GamePageContests.tsx";
const ACCENT = "components/games/catalogue/game-card-accent.ts";

describe("games catalogue routes", () => {
  it("ships /games and /games/[slug] pages", () => {
    expect(existsSync(join(ROOT, HUB))).toBe(true);
    expect(existsSync(join(ROOT, GAME_PAGE))).toBe(true);
  });

  it("hub uses a wide content shell over a fixed viewport arena, not a narrow dark column", () => {
    const hub = readCode(HUB);
    // Reason (8 Oct 2026): Image 1 scale — min(1420px) content, arena plate, no Featured hero.
    // Polish same day: fixed inset-0 plate + navy floor so filter/short/long lists never
    // expose a hard edge under the artwork.
    expect(hub).toMatch(/min\(1420px/);
    expect(hub).toMatch(/games-catalogue-arena-r1\.webp/);
    expect(hub).toMatch(/fixed inset-0/);
    expect(hub).toMatch(/bg-\[#020B1A\]/);
    expect(hub).toMatch(/loadCatalogueCardStats/);
    expect(hub).not.toMatch(/Featured Game/);
    expect(hub).not.toMatch(/max-w-\[1000px\]|max-w-\[1100px\]/);
  });

  it("hero matches Wallet Analytics: Games Catalog + owner gamepad plate", () => {
    const hero = readCode("components/games/catalogue/GamesHero.tsx");
    // Reason: flipped from the 3D GAMES wordmark — owner asked for the same two-tone
    // theme as Wallet Analytics, titled Games Catalog, with the supplied gamepad icon.
    expect(hero).toMatch(/AnalyticsPageHeadline/);
    expect(hero).toMatch(/lead=["']Games["']/);
    expect(hero).toMatch(/accentWord=["']Catalog["']/);
    expect(hero).toMatch(/games-catalogue-header-r1\.png/);
    expect(hero).not.toMatch(/games-catalogue-title-r1\.png/);
  });

  it("stats strip uses the owner players plate and larger inline labels", () => {
    const stats = readCode("components/games/catalogue/GameStatistics.tsx");
    expect(stats).toMatch(/catalogue-stat-players-r1\.png/);
    expect(stats).not.toMatch(/NEON_ICON\("users"\)/);
    expect(stats).toMatch(/text-\[18px\]|text-\[20px\]/);
  });

  it("assigns per-game accents by code, never by nth-child", () => {
    const accent = readCode(ACCENT);
    const card = readCode(CARD);
    expect(accent).toMatch(/volt-velocity|velocity/);
    expect(accent).toMatch(/volt-stack|stack/);
    expect(accent).toMatch(/circuit-sprint|sprint/);
    expect(accent).toMatch(/trading/);
    expect(card).not.toMatch(/nth-child/);
    expect(accent).not.toMatch(/nth-child/);
  });

  it("game page does not launch or create a round on GET", () => {
    const code = readCode(GAME_PAGE);
    // Reason: creating a round spends an attempt; a server-component GET is also what
    // Next.js issues when prefetching a <Link>, so launch-on-load burns paid attempts on hover.
    expect(code).not.toMatch(/createRound|launchContestRound|launchRound/);
    expect(code).not.toMatch(/\/play["'`]/);
    // Reason: content comes from the aggregated game-page service; a GET only reads.
    expect(code).toMatch(/getGamePageData/);
    expect(code).toMatch(/GamePageView/);
  });

  it("catalogue cards and contest rows link to lobbies / game pages, never /play", () => {
    const card = readCode(CARD);
    const contests = readCode(CONTESTS);
    expect(card).toMatch(/\/games\/\$\{game\.slug\}/);
    // Reason: bare `/play` matches inside JSDoc before strip quirks; assert the href shapes.
    expect(card).not.toMatch(/href=\{?["'`]\/play/);
    expect(contests).toMatch(/\/competitions\/\$\{c\.id\}/);
    expect(contests).not.toMatch(/href=\{?["'`]\/play/);
    expect(contests).not.toMatch(/\/competitions\/\$\{c\.id\}\/play/);
  });

  it("catalogue cards stay equal height regardless of tagline length", () => {
    const card = readCode(CARD);
    const grid = readCode(GRID);
    // Reason: a one-line tagline beside a two-line neighbour made uneven boxes
    // (owner). Stretch the grid + card, and reserve two lines for copy. The grid
    // moved out of the hub into GamesGrid on 28 Sep 2026; the claim is unchanged.
    expect(grid).toMatch(/items-stretch/);
    // Reason: fixed tracks, never auto-fit - a lone last card keeps the width of
    // the cards above it instead of stretching across the row (owner, 28 Sep).
    expect(grid).toMatch(/repeat\(3,minmax\(0,1fr\)\)/);
    expect(grid).not.toMatch(/auto-fit|auto-fill|col-span/);
    expect(card).toMatch(/h-full/);
    expect(card).toMatch(/flex-col/);
    expect(card).toMatch(/min-h-\[2\.5rem\]/);
    expect(card).toMatch(/line-clamp-2/);
  });

  it("catalogue card artwork fits whole inside a fixed equal-height frame", () => {
    const card = readCode(CARD);
    // Reason (history): contain → cover 16/8.5 → cover 16/11 → 190px cover → 16/9 cover.
    // Flipped 8 Oct polish pass 2: owner rejected cropping — restore contain in 16/11
    // so every banner shows in full while cards stay equal height.
    expect(card).toMatch(/aspect-\[16\/11\]/);
    expect(card).not.toMatch(/aspect-\[16\/9\]/);
    expect(card).not.toMatch(/h-\[190px\]/);
    expect(card).not.toMatch(/aspect-\[16\/8\.5\]/);
    const images = card.match(/<Image[\s\S]*?\/>/g) ?? [];
    expect(images).toHaveLength(1);
    const [art] = images;
    expect(art).toMatch(/object-contain/);
    expect(art).not.toMatch(/object-cover|blur-/);
    expect(art).toMatch(/alt=\{banner\.alt\}/);
    expect(card).toMatch(/resolveGameCardAccent/);
    expect(card).toMatch(/GameStatistics/);
    expect(card).toMatch(/h-12 w-12|h-14 w-14/);
  });

  it("empty game page is designed, not a blank return", () => {
    const page = readCode(GAME_PAGE);
    const empty = readCode(EMPTY);
    expect(page).toMatch(/GamePageView/);
    expect(empty).toMatch(/No Contests Open Yet/i);
    expect(empty).toMatch(/\/competitions/);
  });
});
