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

  it("catalogue card artwork fills the area AND is never cropped (blurred cover backdrop + contain)", () => {
    const card = readCode(CARD);
    // Reason (history): until 28 Sep 2026 this asserted object-contain alone, which
    // left empty letterbox bands; then cover alone, which sliced the banners' own
    // text (owner, 3 Oct 2026: images must always be centred and display correctly
    // whatever their shape). Flipped, not deleted: both failures stay pinned.
    // The shared aspect still keeps every card the same height.
    expect(card).toMatch(/aspect-\[16\/8\.5\]/);
    const images = card.match(/<Image[\s\S]*?\/>/g) ?? [];
    expect(images).toHaveLength(2);
    const [backdrop, art] = images;
    // Backdrop: decorative, fills the box, blurred so it reads as glow not content.
    expect(backdrop).toMatch(/object-cover/);
    expect(backdrop).toMatch(/blur-/);
    expect(backdrop).toMatch(/aria-hidden/);
    expect(backdrop).toMatch(/alt=""/);
    // Artwork: drawn last (on top), whole, centred.
    expect(art).toMatch(/object-contain object-center/);
    expect(art).not.toMatch(/object-cover/);
    expect(art).toMatch(/alt=\{banner\.alt\}/);
  });

  it("empty game page is designed, not a blank return", () => {
    const page = readCode(GAME_PAGE);
    const empty = readCode(EMPTY);
    expect(page).toMatch(/GamePageView/);
    expect(empty).toMatch(/No Contests Open Yet/i);
    expect(empty).toMatch(/\/competitions/);
  });
});
