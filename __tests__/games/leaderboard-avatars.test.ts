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
const ARENA_PANEL = "components/games/arena/ArenaLeaderboardPanel.tsx";
const KIT_CARDS = "components/neon/Cards.tsx";

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
    /*
      Scoped to the span that actually colours the figure: the tie marker is legitimately amber,
      so a file-wide ban would fail on correct code.

      RE-POINTED ON 11 SEPTEMBER 2026, AND THE CLAIM IS UNCHANGED. This used to slice backwards
      from `row.score.toLocaleString()` to the nearest `<span`, which was the score's own span
      until the tie marker moved into that cell and became the nearest one - so the assertion
      began reading a construct that is meant to be amber and failed on a correct file. A slice
      taken backwards finds whatever construct happens to be closest, which is the third time
      that has cost a false result here; anchoring on the token instead cannot drift.
    */
    const goldAt = board.indexOf("${NEON_SCORE_GOLD}");
    expect(goldAt).toBeGreaterThan(0);
    const goldSpan = board.slice(board.lastIndexOf("<span", goldAt), goldAt);
    expect(goldSpan.length).toBeGreaterThan(0);
    expect(goldSpan).not.toMatch(/text-amber-300|text-gray-100/);
  });
});

/*
  RE-POINTED FROM THE LAYOUT TO THE PANEL ON 11 SEPTEMBER 2026, AND EVERY CLAIM BELOW IS
  UNCHANGED EXCEPT THE LAST. The rail's chrome used to be composed inside `GameArenaLayout`
  while a separate consumer supplied the rows, and the owner's fifth reference rejected the
  result as "a small player status card" - the structural half of which is that split, because
  nothing owned the panel's height. One component owns it now, so these assertions read that
  file. Only the location moved.
*/
describe("the standings panel's chrome", () => {
  it("is headed Leaderboard and leaves through the kit outline button", () => {
    const panel = readCode(ARENA_PANEL);
    /*
      SLICED PAST THE IMPORTS, because the hook this panel reads lives in a file called
      `ArenaLiveStandings.tsx` - so a whole-file ban on "Standings" fails on a correct file, and
      a guard that fires on correct code is the one the next reader deletes. The claim is about
      the heading a player sees, so it is asserted where headings are written.
    */
    const rendered = panel.slice(panel.indexOf("export default function"));
    expect(rendered.length).toBeGreaterThan(500);
    expect(rendered).toMatch(/Leaderboard/);
    expect(rendered).not.toMatch(/Standings/);
    expect(panel).toMatch(
      /<NeonButton[\s\S]{0,300}tone="outline"[\s\S]{0,200}label="View Full Leaderboard"/,
    );
    // The hand-rolled link it replaces is gone - the button is the same one the results screen
    // draws, so the two cannot drift.
    expect(panel).not.toMatch(/Full leaderboard and prizes/);
    expect(panel).not.toMatch(/bg-\[#0B1120\]/);
    // And the layout no longer draws any of it, which is the half that makes the height rule
    // possible. A copy left behind renders a second heading above the panel's own.
    const layout = readCode(ARENA_LAYOUT);
    expect(layout).not.toMatch(/View Full Leaderboard/);
    expect(layout).not.toMatch(/NeonScopeStrip/);
  });

  it("counts players in the reference's form, and never traders", () => {
    const panel = readCode(ARENA_PANEL);
    expect(panel).toMatch(/Players \(\{rows\.length\}\)/);
    expect(panel).not.toMatch(/traders/i);
  });

  it("draws all three of the reference scopes, with the two we cannot answer disabled", () => {
    /*
      FLIPPED ON THE OWNER'S SECOND INSTRUCTION, 11 SEPTEMBER 2026, AND THE OLD REASON IS KEPT
      RATHER THAN DELETED because it is the reason the two are drawn the way they are. This test
      used to assert `Friends` and `Country` appeared NOWHERE, on the grounds that neither has a
      data source and a tab that does nothing teaches a player the screen is broken. The owner
      asked for all three twice.

      So they are drawn, and the objection is answered by HOW: `NEON_TAB_DEAD` rather than
      `NEON_TAB_IDLE`, `aria-disabled`, a title saying what the board is showing instead, and no
      handler. The assertion that matters is therefore not that they exist - it is that they are
      not selectable, because a `<button onClick>` here is precisely the control that appears to
      work and does nothing.
    */
    const panel = readCode(ARENA_PANEL);
    expect(panel).toMatch(/unavailable=\{\["Friends", "Country"\]\}/);

    const cards = readCode(KIT_CARDS);
    const stripAt = cards.indexOf("export function NeonScopeStrip");
    expect(stripAt).toBeGreaterThan(0);
    const strip = cards.slice(stripAt);
    const endAt = strip.indexOf("\nexport function");
    expect(endAt).toBeGreaterThan(0);
    const body = strip.slice(0, endAt);

    // The dead scopes get the dead token, are announced as disabled, and carry no handler.
    expect(body).toMatch(/NEON_TAB_DEAD/);
    expect(body).toMatch(/aria-disabled="true"/);
    expect(body).not.toMatch(/onClick/);
    expect(body).not.toMatch(/<button/);
  });
});
