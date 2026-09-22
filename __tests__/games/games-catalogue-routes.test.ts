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
const CONTESTS = "components/games/catalogue/GameContestList.tsx";
const EMPTY = "components/game-page/GamePageContests.tsx";

describe("games catalogue routes", () => {
  it("ships /games and /games/[slug] pages", () => {
    expect(existsSync(join(ROOT, HUB))).toBe(true);
    expect(existsSync(join(ROOT, GAME_PAGE))).toBe(true);
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
    const hub = readCode(HUB);
    // Reason: a one-line tagline beside a two-line neighbour made uneven boxes
    // (owner). Stretch the grid + card, and reserve two lines for copy.
    expect(hub).toMatch(/items-stretch/);
    expect(card).toMatch(/h-full/);
    expect(card).toMatch(/flex-col/);
    expect(card).toMatch(/min-h-\[2\.5rem\]/);
    expect(card).toMatch(/line-clamp-2/);
  });

  it("empty game page is designed, not a blank return", () => {
    const page = readCode(GAME_PAGE);
    const empty = readCode(EMPTY);
    expect(page).toMatch(/GamePageView/);
    expect(empty).toMatch(/No Contests Open Yet/i);
    expect(empty).toMatch(/\/competitions/);
  });
});
