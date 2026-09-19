import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The operator's rules for a game title reach a player.
 *
 * WHAT THIS PINS. `provider_game.rulesSummary` and `howToPlay` are contractual - `01` section
 * 3.1 requires both of every provider and calls the rules summary the text support quotes back
 * in a prize dispute. R63 fixed the parse bug that had been discarding them on every sync on
 * 10 September 2026, and they were then read by NOTHING: `getGamePresentation` did not select
 * either field, so a paying player saw the pot, the entry fee, the clock and the leaderboard
 * and was never told what a winning score was. The owner reported it the next day.
 *
 * The assertions are structural because there is no wrong number here to assert on - the
 * defect was an absent read and an absent screen, which is a shape rather than a value.
 */

const ROOT = process.cwd();

const PANEL = join(ROOT, "components", "games", "GameRulesPanel.tsx");
const LOBBY = join(ROOT, "components", "games", "ProviderContestLobby.tsx");
const ARENA = join(ROOT, "components", "games", "arena", "GameArenaLayout.tsx");
const PLAY_PAGE = join(
  ROOT,
  "app",
  "(root)",
  "competitions",
  "[id]",
  "play",
  "page.tsx",
);
const PRESENTATION = join(
  ROOT,
  "lib",
  "services",
  "games",
  "game-presentation.service.ts",
);

/**
 * Comments stripped before matching, always.
 *
 * Every file involved here explains the defect in prose, so a bare `toContain` reads the
 * explanation as if it were the code: it passes a broken file whose only mention of the right
 * thing is a comment, and fails a correct one for discussing the mistake. Both directions have
 * bitten this suite before.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the catalogue's rules text reaches the player", () => {
  it("is selected by the shared projection", () => {
    const code = readCode(PRESENTATION);

    /*
      The field must be in THREE places or it arrives undefined: the Mongoose projection, the
      hand-written lean generic, and the returned object. An explicitly-typed `.lean<{...}>()`
      is where a field that is not selected still type-checks perfectly (R32/R33), so naming
      it in the interface alone proves nothing.
    */
    expect(code).toMatch(/\.select\(\s*"[^"]*\brulesSummary\b[^"]*"/);
    expect(code).toMatch(/\.select\(\s*"[^"]*\bhowToPlay\b[^"]*"/);
    expect(code).toMatch(/rulesSummary\?: string;/);
    expect(code).toMatch(/howToPlay\?: string;/);
    expect(code).toMatch(/rulesSummary: title\.rulesSummary \|\| undefined/);
    expect(code).toMatch(/howToPlay: title\.howToPlay \|\| undefined/);
  });

  it("normalises a stored empty string to absent", () => {
    const code = readCode(PRESENTATION);

    /*
      `|| undefined`, not a pass-through. A document written before `game-content.service.ts`
      learned to `$unset` a cleared field can hold "", and every consumer of this shape treats
      a present string as content - so the panel would render a heading over nothing, which is
      the one thing `GamePresentation`'s own header forbids.
    */
    const rules = code.slice(code.indexOf("rulesSummary: title."));
    expect(rules.length).toBeGreaterThan(50);
    expect(rules).toMatch(/^rulesSummary: title\.rulesSummary \|\| undefined/);
  });
});

describe("the rules panel says nothing rather than saying nothing usefully", () => {
  it("renders nothing at all when the catalogue holds neither field", () => {
    const code = readCode(PANEL);

    /*
      The common case, not an edge one: every title synced before R63 carries neither field,
      and so does every provider registered and not yet re-synced. A panel with a heading and
      an empty body tells a player the game has no rules.
    */
    expect(code).toMatch(/if \(!scoring && !playing\) return null;/);
  });

  it("trims before deciding, so whitespace is not content", () => {
    const code = readCode(PANEL);

    // A textarea returning "\n " is a stored value and is not text. Deciding on the raw
    // string renders an empty highlighted block, which is worse than no panel.
    expect(code).toMatch(/rulesSummary\?\.trim\(\)/);
    expect(code).toMatch(/howToPlay\?\.trim\(\)/);
  });

  it("gives the scoring rule the emphasis, and only the scoring rule", () => {
    const code = readCode(PANEL);

    /*
      THE ORDERING IS THE POINT. How to draw a path is discoverable by trying; that the LOWEST
      total wins is not, and a player who assumes the usual direction plays to lose while every
      screen looks correct. Emphasising both is how a page ends up with no emphasis at all, so
      the highlighted treatment is asserted to appear exactly once.
    */
    const highlights = code.match(/border-amber-400\/70/g) ?? [];
    expect(highlights).toHaveLength(1);

    const scoringAt = code.indexOf("border-amber-400/70");
    const howToAt = code.indexOf("How to play");
    expect(scoringAt).toBeGreaterThan(-1);
    expect(howToAt).toBeGreaterThan(-1);
    expect(scoringAt).toBeLessThan(howToAt);
  });

  it("splits operator paragraphs rather than preserving their line wrapping", () => {
    const code = readCode(PANEL);

    /*
      Both fields are 2,000-character operator textareas. `white-space: pre-wrap` was the
      alternative and preserves the incidental wrapping of whatever width the operator typed
      at; splitting on newlines serves a pasted multi-paragraph rules page and the provider's
      own single joined paragraph equally.
    */
    expect(code).toMatch(/split\(\/\\r\?\\n\+\/\)/);
    expect(code).not.toMatch(/whitespace-pre/);
  });

  it("is a server component, so it cannot reach a model into the browser", () => {
    const code = readFileSync(PANEL, "utf8");

    // It renders text and has no interactivity, so there is no reason for it to be a client
    // component - and R58 is what a "use client" file importing a service costs.
    expect(code).not.toMatch(/^"use client"/m);
  });

  it("lays the lobby panel out as one row rather than stacked cells", () => {
    /*
      THE OWNER'S SECOND MEASUREMENT, one page along from the arena band. The two-column grid
      put the scoring rule in one cell and the instructions plus a full-width picture in the
      other, so the panel was as tall as its tallest cell and the short one was a column of
      empty space beside a hero image. Side by side it is only as tall as its copy.

      The grid spelling is asserted ABSENT as well as the row being present, because both can
      be in one file at once: a `md:grid-cols-2` left behind on an inner wrapper reads as
      harmless and restores the taller of the two.
    */
    const code = readCode(PANEL);

    expect(code).toMatch(/flex flex-col gap-4 md:flex-row/);
    expect(code).not.toMatch(/md:grid-cols-2/);
  });

  it("caps the lobby's diagram and keeps it beside the instructions", () => {
    /*
      A WIDTH AND NEVER A HEIGHT, the same rule the arena band arrived at: `NeonIllustration`
      derives one from the other through an aspect ratio, so a hard height beside it is two
      numbers that disagree the moment either moves. 132px at 4/3 is 99px tall.

      POSITION AS WELL AS SIZE, because they are two different defects. Uncapped it became a
      300px hero; below the text it pushed the panel a screen taller whatever its width. The
      picture must therefore come AFTER the instructions inside a row, which is asserted as
      the flex container not being a column - document order alone is satisfied by a
      `flex-col` that puts it underneath, which is the fourth known cause of a green probe and
      cost one in the arena band's suite.
    */
    const code = readCode(PANEL);

    const wideAt = code.indexOf('className="hidden w-[132px] shrink-0 sm:block"');
    expect(wideAt).toBeGreaterThan(-1);

    const textAt = code.indexOf("<HowToPlay");
    expect(textAt).toBeGreaterThan(-1);
    expect(wideAt).toBeGreaterThan(textAt);

    const containerAt = code.lastIndexOf('className="flex min-w-0', textAt);
    expect(containerAt).toBeGreaterThan(-1);
    const container = code.slice(containerAt, textAt);
    expect(container.length).toBeGreaterThan(20);
    expect(container).not.toMatch(/flex-col/);

    // Both pictures, both `contain`: these two uploads are graphics rather than photographs,
    // so a crop takes the corners off a badge. `cover` stays the kit's default.
    expect(code.match(/fit="contain"/g)).toHaveLength(2);
  });

  it("offers only the two layouts a screen actually asks for", () => {
    /*
      `column` WAS THE DEFAULT AND NO CALLER EVER PASSED IT - a stacked layout nobody could
      see, which is the declared-written-dead shape this codebase keeps deleting, after
      `requiresSyncPlay`, `isPaused`, `family` and `ArenaHighlights`' own `list` variant the
      same day. Required rather than defaulted, because a default is how a third unreachable
      branch arrives without a caller.
    */
    const code = readCode(PANEL);

    expect(code).toMatch(/layout: "wide" \| "strip";/);
    expect(code).not.toMatch(/layout = "/);
  });
});

describe("the rules are on both screens, and defined on neither", () => {
  it("is rendered by the lobby and by the arena", () => {
    expect(readCode(LOBBY)).toMatch(/<GameRulesPanel\s+presentation=\{presentation\}/);
    expect(readCode(PLAY_PAGE)).toMatch(
      /rules=\{<GameRulesPanel\s+presentation=\{presentation\}/,
    );
  });

  it("has its headings in the panel and in NO consumer", () => {
    /*
      THE LOAD-BEARING HALF. Importing the panel is trivially satisfied by a screen that
      imports it and then hand-rolls a rules block of its own beside it, which is how one
      screen ends up describing the scoring differently from the other. Same guard shape as
      `components/neon/` and `PrizeTable.tsx`.
    */
    const panel = readCode(PANEL);
    expect(panel).toContain("How to play");
    expect(panel).toContain("How you win");
    /*
      `How ${presentation.gameName} is scored` WAS PINNED HERE AND IS NOW FORBIDDEN, flipped
      on 11 September 2026 rather than deleted. The live display name is `Circuit Sprint: Fast
      and Fun Spatial Puzzles`, so the template produced a page-wide heading that said almost
      nothing - and the fault is interpolating operator free text of unbounded length into a
      sentence, not the length of one name. Both screens read `How it works`.
    */
    expect(panel).not.toMatch(/gameName\} is scored/);
    expect(panel).toContain('title="How it works"');

    /*
      THE TWO BLOCK HEADINGS ONLY, and the third marker was removed rather than kept, because
      it failed on correct code. "is scored" is the panel's own title template - and it is also
      in the lobby's unresolved-round copy, "it is scored zero and the competition still settles
      on time", which is a different and entirely legitimate sentence. A guard that fires on a
      correct file is the kind the first person it inconveniences deletes, which costs the whole
      rule. `13` s4.1g narrowed the `GameIcon` ban for exactly this.
    */
    for (const consumer of [LOBBY, PLAY_PAGE, ARENA]) {
      const code = readCode(consumer);
      expect(code).not.toContain("How to play");
      expect(code).not.toContain("How you win");
    }
  });

  it("sits below the board and above the highlights in the arena", () => {
    const code = readCode(ARENA);

    /*
      Not the 320px sidebar: how a game scores is prose, and prose in a narrow column beside a
      board is where a player stops reading. Below the stage because the board is why they are
      here; above the highlights because a scoring rule outranks three marketing phrases.
      Position, never presence - a `rules` slot rendered anywhere satisfies a bare match.
    */
    const stageAt = code.indexOf("{stage}");
    const rulesAt = code.indexOf("{rules}");
    const highlightsAt = code.indexOf("{highlights}");
    expect(stageAt).toBeGreaterThan(-1);
    expect(rulesAt).toBeGreaterThan(-1);
    expect(highlightsAt).toBeGreaterThan(-1);
    expect(stageAt).toBeLessThan(rulesAt);
    expect(rulesAt).toBeLessThan(highlightsAt);
  });

  it("makes the slot required, so a second arena caller cannot omit it", () => {
    const code = readCode(ARENA);

    // `rules?: ReactNode` would let the next screen built on this layout drop the rules with
    // no failure anywhere - the shape behind every "declared, written, read by nothing" field
    // this programme has found.
    expect(code).toMatch(/^\s*rules: ReactNode;/m);
  });
});
