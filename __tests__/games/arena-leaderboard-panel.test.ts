import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE ARENA'S LEADERBOARD RAIL, REBUILT ON THE OWNER'S FIFTH REFERENCE (11 September 2026).
 *
 * The rejection was structural rather than cosmetic: "the target is not a small player status
 * card. It is a full competitive leaderboard sidebar with tabs, filters, many rows, and a
 * bottom CTA." Most of the furniture existed already - the trophy heading, the count, a scope
 * strip, a four-column table with avatars and a gold leader row, and the full-width footer
 * button - so the honest list of what was missing is short, and it is what this file pins:
 *
 *   1. THE HEIGHT. The chrome was composed in `GameArenaLayout` while a separate consumer
 *      supplied the rows, so nothing owned the panel's height. A heading at its text height, a
 *      rows box capped at 460px and a footer at its content height, inside a grid cell as tall
 *      as the game board, is a short card with the arena backdrop showing beneath it. That gap
 *      is the "oversized empty dark area" - the layout's doing, not the board's.
 *   2. TWO HEADING TABS rather than a title and a pill.
 *   3. THREE SCOPES rather than one.
 *   4. COMPACT ROWS, which is what the four removals buy: every one of them added height.
 *
 * Comments stripped before matching, always. Every file here explains its own trap in prose, so
 * a bare match reads the explanation as the code - passing a broken file whose only mention of
 * the right thing is a comment, and failing a correct one for discussing the mistake.
 */
function readCode(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const PANEL = "components/games/arena/ArenaLeaderboardPanel.tsx";
const LAYOUT = "components/games/arena/GameArenaLayout.tsx";
const BOARD = "components/games/ProviderLeaderboard.tsx";
const KIT_ROW = "components/neon/LeaderboardRow.tsx";
const KIT_TOKENS = "components/neon/tokens.ts";
const SERVICE = "lib/services/games/arena-standings.service.ts";

describe("the rail is as tall as the board beside it", () => {
  it("stretches the grid cell and reaches through it to the panel", () => {
    /*
      BOTH HALVES, AND THE SECOND ONE IS THE LOAD-BEARING HALF. A grid item already stretches to
      the row's height, so the wrapper was the right height all along - which is exactly why the
      short panel inside it looked like an arithmetic problem. `h-full` on the wrapper is a no-op
      that reviews as correct; only `[&>*]:h-full` reaches the panel. The same mistake was made
      once already on the bottom band (`13` s4.1t), which is why this is asserted rather than
      commented.

      `xl:` scoped, because below that breakpoint the rail is full width beneath the board and a
      stretch there means one grid row as tall as its tallest member for no reason.
    */
    const layout = readCode(LAYOUT);
    expect(layout).toMatch(/xl:order-1 xl:\[&>\*\]:h-full/);

    // And the panel takes the height it is offered.
    const panel = readCode(PANEL);
    expect(panel).toMatch(/\$\{NEON_PANEL_LIT\} flex h-full flex-col/);
  });

  it("caps nothing, and grows in exactly one place", () => {
    /*
      NO `max-h` ANYWHERE. A fixed cap is what made the old panel end early and it reads as a
      sensible precaution in a diff - the rows scroll, so a cap looks like it is protecting the
      page from a 200-player contest. It is not: the panel is one column of a grid row whose
      height the BOARD sets, so the overflow already has somewhere to stop.

      And exactly one `flex-1`, because two growing children divide the slack between them: the
      footer button then drifts up from the bottom edge by however much the rows area does not
      need, which is the same empty area wearing a different cause.
    */
    const panel = readCode(PANEL);
    expect(panel).not.toMatch(/max-h-/);

    /*
      Sliced to the panel's own column, because the roster rows legitimately use `flex-1` to give
      a name the width left over beside its avatar. A whole-file count cannot tell a column's
      slack from a row's, so it failed on a correct file - and a guard that does that is deleted
      by the first person it inconveniences.
    */
    const shellAt = panel.indexOf("export default function");
    const shellEnd = panel.indexOf("function BoardTab");
    expect(shellEnd).toBeGreaterThan(shellAt);
    expect(countOf(panel.slice(shellAt, shellEnd), "flex-1")).toBe(1);

    // The layout's old cap is gone with it.
    const layout = readCode(LAYOUT);
    expect(layout).not.toMatch(/max-h-\[460px\]/);
  });

  it("leaves room for about ten rows before it has to scroll", () => {
    /*
      `min-h` IS NOT A CAP AND IS NOT A ROW COUNT. How many players a contest has is not ours to
      decide, so what is guaranteed is the ROOM: ten rows at the reference's height, plus the
      table heading. A shorter contest leaves the space empty rather than shrinking the panel out
      of line with the board, and a longer one scrolls.

      The service's limit is asserted with it, because room for ten rows and a query that returns
      five is a panel that can never fill - and the two numbers are in different files.
    */
    const panel = readCode(PANEL);
    expect(panel).toMatch(/min-h-\[400px\] flex-1 overflow-y-auto/);

    const service = readCode(SERVICE);
    const limit = /options\?\.limit \?\? (\d+)/.exec(service);
    expect(limit).not.toBeNull();
    expect(Number(limit?.[1])).toBeGreaterThanOrEqual(10);
  });

  it("keeps the footer button out of the scroller", () => {
    /*
      POSITION, NOT PRESENCE. Inside the scrolling area the button is at the foot of the LIST
      rather than the foot of the panel, so on a busy contest it is off screen and the panel has
      no visible exit - which is the state the owner described as "a lot of empty space above
      it", seen from the other side. It has to be the last child of the flex column.
    */
    const panel = readCode(PANEL);
    const scrollerAt = panel.indexOf("overflow-y-auto");
    const buttonAt = panel.indexOf("<NeonButton");
    expect(scrollerAt).toBeGreaterThan(0);
    expect(buttonAt).toBeGreaterThan(scrollerAt);

    /*
      AND THE SCROLLER MUST HAVE CLOSED FIRST, which is the assertion that can actually fail. A
      probe moving the button INSIDE the scroller left every check above green - the button is
      still after the scroller's opening tag either way - which is the fourth cause of a green
      probe wearing a positional disguise. There is exactly one button, the scroller's closing
      tag comes before it, and it sits in a border-topped strip of its own.
    */
    expect(countOf(panel, "<NeonButton")).toBe(1);
    const between = panel.slice(scrollerAt, buttonAt);
    expect(between).toMatch(/<\/div>/);
    expect(between).toMatch(/border-t p-3/);
  });
});

describe("the rail's two heading tabs", () => {
  it("are two real controls, each announcing which is chosen", () => {
    /*
      BUTTONS WITH `aria-pressed`, never a heading and a pill. The pair the reference draws are
      the same shape and the same size, and either can be the chosen one - a title beside a count
      says one of them is furniture, which is what the previous version was.
    */
    const panel = readCode(PANEL);
    expect(countOf(panel, 'type="button"')).toBe(2);
    expect(countOf(panel, "aria-pressed")).toBe(2);
    expect(panel).toMatch(/setTab\("ranking"\)/);
    expect(panel).toMatch(/setTab\("players"\)/);
  });

  // Reason: no apostrophe and no brackets in this name. vitest's `-t` is a regular expression,
  // so a probe naming a test with punctuation in it matches nothing and reports a passing run
  // over zero tests, which is indistinguishable from a missing guard.
  it("wear the kit tokens rather than chrome of their own", () => {
    /*
      THE NEGATIVE IS THE LOAD-BEARING HALF. Importing the tokens is trivially satisfied by a
      file that imports them and then hand-rolls a second strip beside them, which is how one
      panel comes to have two visual languages. The colours themselves are already policed by
      `KIT_ONLY_LITERALS`; what is asserted here is that this screen does not write a border or
      a background of its own at all.
    */
    const panel = readCode(PANEL);
    expect(panel).toMatch(/NEON_TABS_STRIP/);
    expect(panel).toMatch(/NEON_TAB_ACTIVE/);
    expect(panel).toMatch(/NEON_TAB_IDLE/);
    expect(panel).toMatch(/NEON_TAB_SHAPE/);
    expect(panel).not.toMatch(/border-\[#/);
    expect(panel).not.toMatch(/bg-\[#/);

    // And the tokens are defined once, in the kit.
    const tokens = readCode(KIT_TOKENS);
    for (const token of [
      "NEON_TABS_STRIP",
      "NEON_TAB_ACTIVE",
      "NEON_TAB_IDLE",
      "NEON_TAB_DEAD",
      "NEON_TAB_SHAPE",
    ]) {
      expect(tokens).toContain(`export const ${token} `);
    }
  });

  it("puts what a player has been doing on the second tab, rather than deleting it", () => {
    /*
      NOTHING WAS THROWN AWAY, AND THAT IS WHY THERE ARE TWO TABS RATHER THAN ONE TIDIED ONE.
      The owner's removal list - "Not played yet", "Playing now" - is right about the RANKING: a
      second line under every name is the difference between ten compact rows and six tall ones,
      and a table of scores is not the place to read who is still mid-attempt. But it is the only
      thing on the screen that says whether a rival is still playing, so it moved to a roster tab
      where a list of people rather than a list of scores is being read.

      Asserted as a pair: the roster describes the activity, and the ranking does not receive it.
    */
    const panel = readCode(PANEL);
    expect(panel).toMatch(/describeRoundActivity/);

    /*
      Reason: measured from the LAST occurrence, because the first one is the import line - and an
      import is not a use. Measured from the first, this assertion is trivially false on a correct
      file, which is the mirror image of the trap that has cost several green probes here.
    */
    const rosterAt = panel.indexOf("function PlayersTab");
    expect(rosterAt).toBeGreaterThan(0);
    expect(panel.lastIndexOf("describeRoundActivity")).toBeGreaterThan(rosterAt);

    // Reason: the ranking table is handed rows and no activity map, so it cannot draw the phrase
    // even if a future edit forgets the variant.
    const boardAt = panel.indexOf("<ProviderLeaderboard");
    expect(boardAt).toBeGreaterThan(0);
    const call = panel.slice(boardAt, boardAt + 400);
    expect(call).toMatch(/variant="ranking"/);
    expect(call).not.toMatch(/activity=/);
  });
});

describe("the ranking variant is what makes ten rows fit", () => {
  it("drops all three pieces of furniture together", () => {
    /*
      ONE SWITCH, THREE GATES, AND THEY ONLY MAKE SENSE TOGETHER. Each of the three - the second
      activity line, the "you" word and the tie pill - adds height to a row, so a variant that
      keeps any one of them is taller than the reference's and the panel fits six players instead
      of ten. Three booleans would let a caller keep one by accident and never notice, because
      the failure is a row height rather than an error.
    */
    const board = readCode(BOARD);
    expect(board).toMatch(/variant\?: "detailed" \| "ranking"/);
    expect(board).toMatch(/const ranking = variant === "ranking"/);

    // The activity line.
    expect(board).toMatch(/activity && !ranking/);
    // The "you" word.
    expect(board).toMatch(/showYouMarker=\{!ranking\}/);
    // The tie pill.
    expect(board).toMatch(/row\.isTied && !ranking/);
  });

  it("loses no fact by dropping them", () => {
    /*
      EACH REMOVAL IS STILL STATED SOMEWHERE, WHICH IS WHY IT IS A REMOVAL AND NOT A REGRESSION.
      The tie is stated by two rows sharing a rank plate. The viewer is still marked, because
      `isCurrentUser` tints the NAME rather than adding a badge beside it - and a tint on the
      name is the one marker that survives on the leader's gold row, where a row background
      cannot. The activity is on the roster tab and in the recent-players feed.
    */
    const row = readCode(KIT_ROW);
    expect(row).toMatch(/showYouMarker = true/);

    // Reason: the tint is inside the name, so turning the word off leaves the mark behind. If
    // this ever becomes conditional on the marker, the ranking variant loses the viewer.
    const nameAt = row.indexOf("export function NeonPlayerName");
    expect(nameAt).toBeGreaterThan(0);
    const body = row.slice(nameAt, nameAt + 1200);
    expect(body).toMatch(/isCurrentUser[\s\S]{0,200}text-sky-200/);
  });
});
