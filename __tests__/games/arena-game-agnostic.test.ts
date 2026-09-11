import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE ARENA MAY NOT ASSUME WHAT KIND OF GAME IT IS HOSTING.
 *
 * Owner requirement, 11 September 2026, in his own words: "make sure that this page is game
 * agnostic because for example a tetris game dont have board".
 *
 * WHY A TEST RATHER THAN A REVIEW. The arena was built while exactly one title existed, and
 * that title happens to be a grid puzzle. Every screen written in that state is one careless
 * sentence away from telling a Tetris player how their *board* is going - and the failure is
 * silent, because the page renders perfectly and only reads wrongly. The same shape as every
 * trading-shaped service in this codebase: it keeps working and keeps being wrong.
 *
 * WHERE THE LINE IS, because it is not "never write the word board":
 *
 *   - The *game's own* surface may say whatever it likes. The round header, the grid, the
 *     rails and Submit are drawn by `games-service`, which knows it is Circuit Sprint. This
 *     guard deliberately does not reach across that boundary, and could not: the two share no
 *     code by design (`npm run check:isolation`).
 *   - COMMENTS may say it, and they do, at length - the layout notes argue about where the
 *     board goes because that is what the reference shows. Prose explaining a decision is not
 *     a promise to a player, so comments are stripped before matching. (Same rule as every
 *     other structural test here: a guard that reads prose flags a correct file for discussing
 *     the mistake and passes a broken one whose only mention is in a comment.)
 *   - TAILWIND CLASSES may say it. `grid`, `grid-cols-3` and `tile` are layout, not vocabulary,
 *     and a guard that fires on `className="grid gap-5"` is the kind the first person it
 *     inconveniences deletes. So `className` values are stripped too.
 *
 * What is left after both strippings is, near enough, the words a player reads. That is the
 * surface this rule polices.
 *
 * THE STRIPPER NEEDS ITS OWN CANARY, and that is the first test below. A scan for a
 * combination is only as good as its ability to reach the second half: strip too much and
 * every assertion passes over an empty string, which is indistinguishable from a clean file.
 * `native-select-legibility.test.ts` shipped in exactly that state on 9 September 2026 and was
 * caught only because a known offender reported clean.
 */

const ROOT = process.cwd();

/** Every file that renders part of the arena around the game's own frame. */
const ARENA_FILES = [
  "components/games/arena/GameArenaLayout.tsx",
  "components/games/arena/ArenaIdentity.tsx",
  "components/games/arena/ArenaContestPanel.tsx",
  "components/games/arena/ArenaActivityFeed.tsx",
  "components/games/arena/ArenaHighlights.tsx",
  "components/games/arena/ArenaLiveStandings.tsx",
  "components/games/arena/arena-facts.ts",
  "components/games/ProviderLeaderboard.tsx",
  "components/games/ProviderGameFrame.tsx",
  "components/games/RoundPreflight.tsx",
  "components/games/RoundResultPanel.tsx",
  "components/games/GameRulesPanel.tsx",
  "lib/utils/round-activity.ts",
];

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** Comments out, then `className` values out. What remains is roughly what a player reads. */
function playerFacingText(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      // Backtick form first: a template literal's `${...}` contains a brace, so the braced
      // alternative below would end at the wrong place if it went first.
      .replace(/className=\{`[\s\S]*?`\}/g, " ")
      .replace(/className="[^"]*"/g, " ")
      .replace(/className=\{[^}]*\}/g, " ")
  );
}

/**
 * The nouns that name one kind of game.
 *
 * Deliberately short. Each one is a word a player would only read if the screen had decided
 * what they are playing - and each is a word that has actually appeared in a draft of one of
 * these files. "Score", "attempt" and "round" are NOT here: they are the platform's own
 * vocabulary, true of every title, and defined by the provider contract.
 */
const GAME_SPECIFIC_NOUNS = [
  "board",
  "puzzle",
  "grid",
  "tile",
  "square",
  "solve",
  "solved",
  "lap",
  "level",
  "piece",
];

describe("the stripper reaches the words a player reads", () => {
  /*
    THE CANARY. Two halves, and both matter: something a player reads must survive, and a
    Tailwind class must not. Without the first, over-stripping leaves every assertion below
    scanning an empty string and passing. Without the second, the rule fires on `grid-cols-3`
    and gets deleted by whoever it stops.
  */
  it("keeps the copy and drops the classes and the comments", () => {
    const layout = playerFacingText(read("components/games/arena/GameArenaLayout.tsx"));

    // A heading a player reads.
    expect(layout).toContain("Leaderboard");
    // A layout class, gone.
    expect(layout).not.toContain("grid-cols");
    // The layout file's comments argue about the board at length; none of it survives.
    expect(layout.toLowerCase()).not.toContain("board first everywhere");
  });

  it("would still catch a game-specific word written as copy", () => {
    // A fixture rather than a real file, so the assertion is about the matcher and not about
    // whichever screen happens to be clean today.
    const pretend = playerFacingText(
      '<div className="grid">{/* the board */}<h2>Your board</h2></div>',
    );
    expect(pretend).toMatch(/\bboard\b/i);
  });
});

describe("the arena names no kind of game", () => {
  it.each(ARENA_FILES)("%s says nothing a Tetris player would not recognise", (file) => {
    const text = playerFacingText(read(file));

    for (const noun of GAME_SPECIFIC_NOUNS) {
      /*
        Matched inside a quoted string only. An identifier may legitimately be called
        `boardsCompleted` - it is a metric name arriving from the provider and rendered by
        `humanizeMetric`, which is the whole mechanism that keeps this agnostic - and a
        variable name is not something a player reads.
      */
      // Reason: the rule guards against a pattern built from untrusted input, and `noun` comes
      // from the frozen list at the top of this file - so the risk it exists for is absent.
      // Scoped to the one rule rather than the file, so a genuinely dynamic pattern added
      // later is still reported.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const inCopy = new RegExp(`["'\`][^"'\`]*\\b${noun}\\b[^"'\`]*["'\`]`, "i");
      expect(
        text,
        `${file} writes "${noun}" into copy a player reads. The arena hosts whatever the ` +
          `provider sends; the game's own surface is the place that knows what it is.`,
      ).not.toMatch(inCopy);
    }
  });
});
