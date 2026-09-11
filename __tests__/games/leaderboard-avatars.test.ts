import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The standings rebuilt to the owner's leaderboard reference, 11 September 2026 - the third
 * rejection of the arena: "the names in the standings are not shown correctly, are too
 * squeezed ... users' avatars must show on standings".
 *
 * WHAT IS PINNED, AND WHY EACH HALF MATTERS.
 *
 * - THE PICTURE IS ATTACHED BY ONE PRODUCER AND THE ROW GAINS EXACTLY ONE FIELD. `getUsersByIds`
 *   returns a user's whole card - email, address, city - because it serves the messaging
 *   screens. A spread of that card onto a public leaderboard row is a data leak that reviews as
 *   "attach the avatar", so the behavioural test asserts the WHOLE object, not the one key it
 *   cares about: a field you did not ask about is the only way to notice one you did not expect.
 *
 * - BOTH GAME SCREENS AND THE POLL GO THROUGH THAT PRODUCER. The arena renders once on the
 *   server and refreshes from `/api/competitions/[id]/standings`; if the page attached pictures
 *   and the route did not, every avatar would vanish fifteen seconds after load. The route and
 *   the page both call `getArenaStandings`, so the producer lives there - pinned by asserting
 *   the service calls it, and that the lobby page calls it inside the provider branch.
 *
 * - THE LEADER'S GOLD IS FLUSH-ONLY. `neonRowClasses` is shared with the trading board, which
 *   renders the card form. A gold #1 arriving there through the shared helper would be an
 *   unasked-for change to a trading screen made invisibly, so the card form is asserted
 *   UNCHANGED as carefully as the flush form is asserted changed.
 *
 * - THE RANK MARKER IS AN OPTION, NOT A REPLACEMENT. The medals mark the three paying positions;
 *   the reference's plates mark only the top. The trading board must still get medals without
 *   asking, so its file is asserted to pass no `style=`.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PRODUCER = "lib/services/games/leaderboard-avatars.ts";
const ARENA_SERVICE = "lib/services/games/arena-standings.service.ts";
const LOBBY_PAGE = "app/(root)/competitions/[id]/page.tsx";
const BOARD = "components/games/ProviderLeaderboard.tsx";
const TRADING_BOARD = "components/trading/CompetitionLeaderboard.tsx";
const KIT_ROW = "components/neon/LeaderboardRow.tsx";
const ARENA_LAYOUT = "components/games/arena/GameArenaLayout.tsx";
const ARENA_LIVE = "components/games/arena/ArenaLiveStandings.tsx";

const lookup = vi.fn();
vi.mock("@/lib/utils/user-lookup", () => ({
  getUsersByIds: (ids: string[]) => lookup(ids),
}));

describe("attachProfileImages", () => {
  beforeEach(() => lookup.mockReset());

  it("adds the picture and NOTHING ELSE from the user card", async () => {
    const { attachProfileImages } = await import(
      "@/lib/services/games/leaderboard-avatars"
    );

    lookup.mockResolvedValue(
      new Map([
        [
          "u1",
          {
            id: "u1",
            name: "Alice",
            email: "alice@example.com",
            profileImage: "/uploads/alice.webp",
            address: "1 Some Street",
            city: "Nicosia",
          },
        ],
      ]),
    );

    const rows = [
      { userId: "u1", username: "Alice", currentRank: 1, score: 900 },
      { userId: "u2", username: "Bob", currentRank: 2, score: 500 },
    ];

    const out = await attachProfileImages(rows);

    // The WHOLE object, so the email and address that came back with the picture cannot arrive
    // on a public board unnoticed.
    expect(out[0]).toEqual({
      userId: "u1",
      username: "Alice",
      currentRank: 1,
      score: 900,
      profileImage: "/uploads/alice.webp",
    });
    // No picture means no key at all - not `profileImage: undefined` - so the polled JSON and
    // the server render agree byte for byte.
    expect(out[1]).toEqual({ userId: "u2", username: "Bob", currentRank: 2, score: 500 });
    expect(Object.hasOwn(out[1], "profileImage")).toBe(false);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith(["u1", "u2"]);
  });

  it("does not look anything up for an empty board", async () => {
    const { attachProfileImages } = await import(
      "@/lib/services/games/leaderboard-avatars"
    );
    expect(await attachProfileImages([])).toEqual([]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("is the one producer, called by the arena service and by the lobby's provider branch", () => {
    const service = readCode(ARENA_SERVICE);
    expect(service).toMatch(/await attachProfileImages\(/);
    // After the ranking read - the picture is attached to ranked rows, never read by ranking.
    expect(service.indexOf("attachProfileImages(")).toBeGreaterThan(
      service.indexOf("getCompetitionLeaderboard("),
    );

    const page = readCode(LOBBY_PAGE);
    const branchAt = page.indexOf("hasProviderGameLabel(competition)) {");
    const attachAt = page.indexOf("await attachProfileImages(leaderboard)");
    const difficultyAt = page.indexOf("getDifficultyData(");
    expect(branchAt).toBeGreaterThan(0);
    expect(attachAt).toBeGreaterThan(branchAt);
    expect(difficultyAt).toBeGreaterThan(attachAt);
    // And the lobby is handed the rows WITH pictures, not the ones it read.
    expect(page).toMatch(/<ProviderContestLobby[\s\S]*?leaderboard=\{gameLeaderboard\}/);
  });

  it("the board draws the picture off the row and never looks a player up itself", () => {
    const board = readCode(BOARD);
    expect(board).toMatch(/<NeonAvatar[\s\S]{0,200}src=\{row\.profileImage\}/);
    expect(board).not.toMatch(/getUsersByIds|user-lookup|attachProfileImages/);
    expect(readCode(PRODUCER)).not.toMatch(/"use client"/);
  });
});

describe("the kit's avatar chip", () => {
  it("renders the platform's ProfileImage when handed a picture, initials otherwise", () => {
    const kit = readCode(KIT_ROW);
    expect(kit).toMatch(/import ProfileImage from "@\/components\/ui\/ProfileImage"/);
    // Position within the construct: the `<ProfileImage` sits inside `if (src)`.
    const guardAt = kit.indexOf("if (src) {");
    const imageAt = kit.indexOf("<ProfileImage");
    expect(guardAt).toBeGreaterThan(0);
    expect(imageAt).toBeGreaterThan(guardAt);
    // And the kit itself stays a server-safe file: ProfileImage is the client boundary.
    expect(kit).not.toMatch(/^"use client"/);
  });
});

describe("the leader's gold row", () => {
  it("is drawn on the flush board whoever the leader is, and never on the card form", async () => {
    const { neonRowClasses } = await import("@/components/neon/LeaderboardRow");
    const tokens = await import("@/components/neon/tokens");

    // Flush: the leader is gold even when it is you - the reference draws "You" inside it.
    expect(neonRowClasses({ rank: 1, isCurrentUser: true, variant: "flush" })).toBe(
      tokens.NEON_ROW_FLUSH_LEADER,
    );
    expect(neonRowClasses({ rank: 1, isCurrentUser: false, variant: "flush" })).toBe(
      tokens.NEON_ROW_FLUSH_LEADER,
    );
    // Below the leader, "this is you" still wins over the podium.
    expect(neonRowClasses({ rank: 2, isCurrentUser: true, variant: "flush" })).toBe(
      tokens.NEON_ROW_FLUSH_YOU,
    );
    expect(neonRowClasses({ rank: 3, isCurrentUser: false, variant: "flush" })).toBe(
      tokens.NEON_ROW_FLUSH_PODIUM,
    );

    // Card form - the trading board - UNCHANGED: three states, you over podium, no gold.
    expect(neonRowClasses({ rank: 1, isCurrentUser: false })).toBe(tokens.NEON_ROW_PODIUM);
    expect(neonRowClasses({ rank: 1, isCurrentUser: true })).toBe(tokens.NEON_ROW_YOU);
    expect(neonRowClasses({ rank: 9, isCurrentUser: false })).toBe(tokens.NEON_ROW);
    expect(Object.hasOwn(tokens, "NEON_ROW_LEADER")).toBe(false);
  });

  it("frames the row on every side in the reference's gold", async () => {
    const { NEON_ROW_FLUSH_LEADER } = await import("@/components/neon/tokens");
    /*
      THE ALL-SIDES UTILITY STANDING ALONE, never `\bborder\b`, which is what this asserted
      until a probe came back green against it. A hyphen is a word boundary, so `border-l-2`
      satisfies `\bborder\b` perfectly - and a left bar is precisely the state this test
      exists to rule out, being the podium's shape in a different colour rather than the
      reference's frame. Between spaces, or at either end of the string, is the only spelling
      that means "on every side".
    */
    expect(NEON_ROW_FLUSH_LEADER).toMatch(/(^|\s)border(\s|$)/);
    // Rounded, because a square gold outline between two hairlines reads as a table cell that
    // happens to be yellow. See the token's own note.
    expect(NEON_ROW_FLUSH_LEADER).toMatch(/rounded-/);
    expect(NEON_ROW_FLUSH_LEADER).toMatch(/border-\[#FFC01B\]/);
    expect(NEON_ROW_FLUSH_LEADER).toMatch(/from-\[#FFB300\]/);
  });
});

describe("the rank marker and the score colour", () => {
  it("the game board asks for plates and the trading board still gets medals", () => {
    expect(readCode(BOARD)).toMatch(/<NeonRankBadge[^>]*style="plates"/);
    expect(readCode(TRADING_BOARD)).not.toMatch(/<NeonRankBadge[^>]*style=/);

    const kit = readCode(KIT_ROW);
    // The leader's crown lives inside the plates branch, and the default is still the medals.
    expect(kit).toMatch(/style = "medals"/);
    const platesAt = kit.indexOf('if (style === "plates") {');
    const crownAt = kit.indexOf("<Crown", platesAt);
    expect(platesAt).toBeGreaterThan(0);
    expect(crownAt).toBeGreaterThan(platesAt);
  });

  it("writes every score in one gold, from the kit, with no podium cut-off", () => {
    const board = readCode(BOARD);
    expect(board).toMatch(/\$\{NEON_SCORE_GOLD\}/);
    // The old rule - amber for the top three, grey below - is gone: a colour that changed at
    // fourth place read as "these three are paid" on a contest that may pay five.
    expect(board).not.toMatch(/currentRank <= 3/);
    // Scoped to the score cell: the tied badge beside the name is legitimately amber, so a
    // file-wide ban would fail on correct code.
    const scoreAt = board.indexOf("row.score.toLocaleString()");
    expect(scoreAt).toBeGreaterThan(0);
    const cell = board.slice(board.lastIndexOf("<span", scoreAt), scoreAt);
    expect(cell.length).toBeGreaterThan(0);
    expect(cell).not.toMatch(/text-amber-300|text-gray-100/);
  });
});

describe("the standings panel's chrome", () => {
  it("is headed Leaderboard, scoped Global, and leaves through the kit's outline button", () => {
    const layout = readCode(ARENA_LAYOUT);
    expect(layout).toMatch(/title="Leaderboard"/);
    expect(layout).not.toMatch(/title="Standings"/);
    expect(layout).toMatch(/<NeonScopeStrip scopes=\{\["Global"\]\}/);
    expect(layout).toMatch(
      /<NeonButton[\s\S]{0,300}tone="outline"[\s\S]{0,200}label="View Full Leaderboard"/,
    );
    // The hand-rolled link it replaces is gone - the button is the same one the results screen
    // draws, so the two cannot drift.
    expect(layout).not.toMatch(/Full leaderboard and prizes/);
    expect(layout).not.toMatch(/bg-\[#0B1120\]/);
  });

  it("counts players in the reference's form, and never traders", () => {
    const live = readCode(ARENA_LIVE);
    expect(live).toMatch(/Players \(\{rows\.length\}\)/);
    expect(live).not.toMatch(/traders/i);
  });

  it("draws no dead scope tabs", () => {
    // The reference shows FRIENDS and COUNTRY; neither has a data source. A tab that does
    // nothing teaches a player the screen is broken, so only the scope the board can answer
    // is drawn.
    const layout = readCode(ARENA_LAYOUT);
    expect(layout).not.toMatch(/Friends|Country/);
  });
});
