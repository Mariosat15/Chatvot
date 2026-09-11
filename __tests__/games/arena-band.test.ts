import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ARENA_HIGHLIGHT_LIMIT,
  ARENA_STEP_LIMIT,
} from "../../apps/admin/lib/admin/game-content-fields";

/**
 * The arena's bottom band is a thin information strip, not three dashboard cards.
 *
 * WHERE THIS CAME FROM. The owner's instruction of 11 September 2026, against the reference
 * screenshot measured at 986 x 103 and a screenshot of what had been built: "the complete
 * section should only be approximately 90-105px tall on desktop. Your current implementation
 * stretches the section to approximately 600px+ high. THIS IS WRONG." It is the fourth
 * rejection of this screen, which is itself the thing worth noticing - each pass corrected
 * something real and none of them was the thing being looked at.
 *
 * THE HEIGHT IS THE SPECIFICATION, so it is asserted as a measurement rather than as an
 * intention. Three separate mechanisms hold it and each fails silently on its own:
 *
 *  1. The band's own height is FIXED. Without it the row is as tall as its tallest card, and
 *     every card is as tall as its own text - which is how a 96px strip becomes a 600px
 *     section with no rule broken anywhere.
 *  2. Each card draws a CAPPED number of items. A fixed height with uncapped content is
 *     `overflow: hidden` doing the work, which means content vanishing with nothing on screen
 *     to say so - the failure mode this programme keeps finding.
 *  3. Each item is clamped to ONE LINE. Four tips of two lines each is eight rows in a panel
 *     with room for four, which is exactly what the rejected build did.
 *
 * The assertions are structural because there is no wrong number here to assert on. Every one
 * of these defects renders perfectly, throws nothing and logs nothing; the only witness is a
 * screenshot, which is why the owner is the one who found it three times.
 */

const ROOT = process.cwd();

const LAYOUT = join(ROOT, "components", "games", "arena", "GameArenaLayout.tsx");
const RULES = join(ROOT, "components", "games", "GameRulesPanel.tsx");
const HIGHLIGHTS = join(
  ROOT,
  "components",
  "games",
  "arena",
  "ArenaHighlights.tsx",
);
const FEED = join(ROOT, "components", "games", "arena", "ArenaActivityFeed.tsx");
const CARDS = join(ROOT, "components", "neon", "Cards.tsx");
const AVATAR = join(ROOT, "components", "neon", "LeaderboardRow.tsx");
const PLAY_PAGE = join(
  ROOT,
  "app",
  "(root)",
  "competitions",
  "[id]",
  "play",
  "page.tsx",
);
const CONTENT_DIALOG = join(
  ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "games",
  "GameContentDialog.tsx",
);

/**
 * Comments stripped before matching, always.
 *
 * Every file here argues about the defect in prose - the band's comment quotes the owner's
 * "600px+", the panels name the caps and explain what they drop. A bare match reads the
 * explanation as the code: it passes a broken file whose only mention of the right thing is a
 * comment, and fails a correct one for discussing the mistake. Both directions have cost this
 * project a false result.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The band's markup alone.
 *
 * SLICED FORWARD FROM THE `{rules}` SLOT, and asserted to have found something. A slice taken
 * backwards finds whatever construct is closest, which has produced a false result here three
 * times; and a slice that found nothing passes everything asked of it.
 */
function bandMarkup(): string {
  const code = readCode(LAYOUT);
  const from = code.indexOf("{rules}");
  expect(from).toBeGreaterThan(-1);

  // Back up to the wrapper that opens the band, then run to the sentence that closes it.
  const opens = code.lastIndexOf("<div", code.lastIndexOf("<div", from - 1) - 1);
  const closes = code.indexOf("Scores are reported by the game", from);
  expect(opens).toBeGreaterThan(-1);
  expect(closes).toBeGreaterThan(from);

  const band = code.slice(opens, closes);
  expect(band.length).toBeGreaterThan(200);
  expect(band).toContain("{highlights}");
  expect(band).toContain("{activity}");
  return band;
}

describe("the band is a fixed-height strip", () => {
  it("pins its own height instead of growing with its content", () => {
    /*
      104px IS ARRIVED AT RATHER THAN CHOSEN, and the number is asserted rather than "some
      fixed height" because the pictures depend on it. A card is the band less its 30px
      heading, so 74px of body; `NeonIllustration` takes its height from its WIDTH through an
      aspect ratio, so the owner's 65-75px picture needs 66 of those 74. At the first
      attempt's 96 the body was 66 and the picture would have been cropped by the
      `overflow-hidden` backstop - silently, on two of the acceptance points. 104 is also
      inside his stated 95-115 maximum.

      `sm:` so a phone, where the cards stack, is free to be as tall as three cards.

      THE HEIGHT MUST NOT SCALE WITH THE VIEWPORT, which is the half a reviewer would drop:
      the reference measures 986 wide, so a proportional height reads correctly there and
      turns the strip back into a section at 1440. There is deliberately no `lg:h-` or
      `xl:h-` here, and that absence is asserted.
    */
    const band = bandMarkup();

    expect(band).toMatch(/\bsm:h-\[104px\]/);
    expect(band).not.toMatch(/\b(md|lg|xl|2xl):h-[\d[]/);
  });

  it("carries none of the vertical-fill spellings the owner ruled out", () => {
    /*
      The instruction named these by name: no `min-height: 400/500/600px`, no vertical
      `flex: 1`, no `height: 100%` on the section, no `grid-auto-rows: 1fr`. In Tailwind that
      is `min-h-[...]`, a bare `flex-1` on a column, `h-full` on the band itself, and
      `auto-rows-fr`.

      `flex-1` is the interesting one and it is why this is asserted on the band's slice
      rather than on the file: the three wrappers legitimately need a horizontal basis, which
      they now get as `flex-[1.15_1_0]`. A bare `flex-1` would also work horizontally, so the
      ban is not "never use flex-1" - it is that this band's items state their basis
      explicitly, so a `flex-1` appearing here means somebody reached for the growth
      shorthand without deciding the proportions.

      AND `h-full` IS BANNED ON THE BAND WHILE `[&>*]:h-full` IS REQUIRED ON EACH WRAPPER,
      which is the whole reason this is a count rather than a word. Written as
      `not.toMatch(/h-full/)` the rule fires on the child selector - it did, on correct code,
      the first time this suite ran - and a guard that fails on a correct file is the kind the
      first person it inconveniences deletes. Every occurrence here must be the child form.
    */
    const band = bandMarkup();

    expect(band).not.toMatch(/min-h-\[/);
    expect(band).not.toMatch(/auto-rows/);
    expect(band).not.toMatch(/\bflex-1\b/);

    const anyFull = band.match(/h-full/g) ?? [];
    const childFull = band.match(/\[&>\*\]:h-full/g) ?? [];
    expect(anyFull).toHaveLength(childFull.length);
  });

  // Reason: the names in this file avoid apostrophes, slashes and brackets, because the probe
  // harness selects a test with vitest's `-t`, which is a REGULAR EXPRESSION. A fragment that
  // matches nothing produces a passing run over zero tests, which reads exactly like a guard
  // that does not work - it has cost a false result here twice.
  it("divides the row 34 34 32, the reference proportions", () => {
    /*
      A DELIBERATE DEVIATION FROM THE OWNER'S CSS, which asked for
      `grid-template-columns: 1.15fr 1.15fr 1fr`. The proportions are identical - these three
      bases divide the row exactly as those tracks do - and the empty case is not.

      All three slots render NOTHING when their content is absent, and that is the common
      case: a title with no rules text, no feature cards written, a contest nobody has played.
      A hidden GRID item leaves its track behind, so `grid-cols-3` here puts one panel adrift
      in an empty row - which is precisely why this band was built, reverted and rebuilt. A
      hidden FLEX item leaves the line. `:empty` is how CSS sees what React cannot.
    */
    const band = bandMarkup();

    expect((band.match(/flex-\[1\.15_1_0\]/g) ?? []).length).toBe(2);
    expect((band.match(/flex-\[1_1_0\]/g) ?? []).length).toBe(1);
    expect(band).not.toMatch(/grid-cols/);
  });

  it("keeps all three cards on one row at every width the owner called desktop", () => {
    /*
      STATED AS A MEASUREMENT, NOT AS A BREAKPOINT. Three cards at 260 plus two 10px gaps
      needs 800px, so the row survives the 900px the instruction named and wraps below it -
      which is one number to check rather than a breakpoint that has to agree with one.

      The basis is what makes the sum meaningful: with `flex-[...]` bases of zero, `min-w` is
      the only thing keeping a card from collapsing, so a wider minimum would stack the band
      on a laptop and a narrower one would squeeze three cards into a phone.
    */
    const band = bandMarkup();
    const minimums = band.match(/min-w-\[(\d+)px\]/g) ?? [];

    expect(minimums).toHaveLength(3);
    for (const minimum of minimums) {
      const px = Number(/(\d+)/.exec(minimum)![1]);
      expect(px * 3 + 20).toBeLessThan(900);
      // And wide enough that a name, a phrase and a score are not competing for 120px.
      expect(px).toBeGreaterThanOrEqual(240);
    }
  });
});

describe("each card draws a capped number of one-line items", () => {
  /*
    THE CAP IS THE MECHANISM AND `overflow-hidden` IS THE BACKSTOP. A fixed height with
    uncapped content means the fourth step is simply not painted, with nothing on screen
    saying so - and the panel looks entirely correct in every screenshot where the operator
    happened to write three. So the limit is a named constant, it is asserted here, and it is
    asserted to be APPLIED rather than merely declared.
  */
  const capped: [string, string, string, number][] = [
    ["the rules card", RULES, "STRIP_STEP_LIMIT", 3],
    ["the tips card", HIGHLIGHTS, "STRIP_TIP_LIMIT", 4],
    ["the players card", FEED, "FEED_LIMIT", 3],
  ];

  it.each(capped)("%s names its limit and slices by it", (_label, file, name, value) => {
    const code = readCode(file);

    // Reason: `name` is a literal from the table above, not input.
    /* eslint-disable security/detect-non-literal-regexp */
    expect(code).toMatch(new RegExp(`const ${name} = ${value};`));
    expect(code).toMatch(new RegExp(`\\.slice\\(0, ${name}\\)`));
    /* eslint-enable security/detect-non-literal-regexp */
  });

  it("clamps every line and keeps the full text reachable", () => {
    /*
      TWO HALVES AND THE SECOND IS THE ONE THAT GETS DROPPED. `truncate` is what stops a long
      sentence wrapping and pushing the line below it out of a card that cannot grow. `title`
      is what stops the clamp being a deletion - a cut sentence with no way to read the rest
      is the same failure as an uncapped list, one step quieter.

      Asserted per file, because one card covering for another is indistinguishable from the
      guard working - the same reason the contest-control copy is asserted per list.
    */
    for (const file of [RULES, HIGHLIGHTS]) {
      const code = readCode(file);
      expect(code).toMatch(/className="truncate text-\[10px\]/);
      expect(code).toMatch(/title=\{/);
    }

    // The feed clamps too, but has no tooltip: its phrase is generated from the round's own
    // status by `describeRoundActivity`, so there is no longer text to reveal.
    expect(readCode(FEED)).toMatch(/truncate/);
  });

  it("puts the player name and what they did on ONE line", () => {
    /*
      THE OWNER'S "DO NOT MAKE EACH ROW 60px HIGH". The name sat ABOVE the activity phrase,
      which is 44px of stacked text per player before padding. Side by side they are 22.

      Asserted as the absence of the metrics rather than by measuring a height, because the
      metrics are what made the second line necessary: `describeRoundActivity` returns them
      for the results screen, where there is a column for them, and appending them to a
      one-line row is how the row grows back.
    */
    const code = readCode(FEED);

    expect(code).toMatch(/size="xs"/);
    expect(code).not.toMatch(/phrase\.metrics/);
    expect(code).toMatch(/text-\[10px\] font-semibold/);
  });

  it("draws the avatar at the size the compact row has room for", () => {
    /*
      THE `xs` ABOVE IS A REQUEST AND THIS IS WHAT IT GETS. The owner gave a number - an avatar
      of 18px to 22px - and the feed asking for `xs` proves nothing on its own: the size lives
      in the kit, so a well-meaning edit widening `xs` to the 28px `sm` chip leaves every
      assertion in this file green while the row grows back to the height the owner rejected.
      Both halves or neither, which is the same reason the picture sizes are asserted in the
      card rather than trusted to the illustration component.
    */
    expect(readCode(AVATAR)).toMatch(/size === "xs"\s*\?\s*"h-5 w-5/);
  });

  it("gives each row only the padding three of them fit into", () => {
    /*
      THE THIRD ROW IS WHAT THIS PROTECTS, and it is arithmetic rather than taste. A 20px
      avatar plus 2px above and below is 24, so three rows and their two hairlines are 74 -
      exactly the band's body once its 30px heading strip is taken off its 104. One step up to
      `py-1` makes them 28 and the third row goes under the card's `overflow-hidden`: the
      owner's "3 compact rows" silently becomes 2, with nothing thrown, nothing logged and
      `FEED_LIMIT` still reading 3 two lines away.

      Asserted on the ROW rather than by measuring, and together with the avatar above,
      because either number alone is half the height.
    */
    const code = readCode(FEED);

    const rowAt = code.indexOf("<NeonAvatar");
    expect(rowAt).toBeGreaterThan(-1);
    const row = code.slice(code.lastIndexOf('className="flex', rowAt), rowAt);
    expect(row.length).toBeGreaterThan(20);
    expect(row).toMatch(/py-0\.5/);
  });
});

describe("the pictures are small and beside the text", () => {
  const beside: [string, string, string][] = [
    ["the rules card", RULES, "w-\\[66px\\]"],
    ["the tips card", HIGHLIGHTS, "w-\\[88px\\]"],
  ];

  it.each(beside)("%s draws it at a fixed size", (_label, file, size) => {
    /*
      FIXED PIXELS, NEVER A PROPORTION, and that is the correction rather than a preference: a
      percentage of a flexible column is exactly how the rules diagram became a full-width
      hero and the tips emblem became a 96px badge above the lines. The owner's reference
      measures them at 65-75 square and 85-105 by 65-80.

      A WIDTH AND NO HEIGHT, because `NeonIllustration` derives one from the other through an
      aspect ratio: 66 square, and 88 at 4/3 is 66 tall. Writing a height beside it is two
      numbers that disagree the moment either moves - and it is what made the band 104px
      rather than 96, since a 66px picture does not fit a 66px body once it has padding.
    */
    const code = readCode(file);

    // Reason: `size` is a literal from the table above.
    // eslint-disable-next-line security/detect-non-literal-regexp
    expect(code).toMatch(new RegExp(size));
    expect(code).toMatch(/fit="contain"/);
  });

  it.each(beside)("%s draws it AFTER the text, not above it", (_label, file) => {
    /*
      POSITION, NOT PRESENCE. The rejected build had both pictures in the right components and
      in the wrong place - the diagram beneath the steps at full width, the emblem centred
      above the tips - so a test asserting the illustration exists is green on the defect.

      TWO ASSERTIONS, BECAUSE DOCUMENT ORDER IS ONLY HALF OF IT. The first version checked the
      order alone, and a probe adding `flex-col` to the container came back GREEN: the picture
      is still later in the markup and is now underneath the lines, which is the exact defect.
      That is the fourth known cause of a green probe - a mutation with no observable in the
      assertion - and the observable here is the flex DIRECTION, so the row is asserted too.
    */
    const code = readCode(file);

    const listAt = Math.max(code.indexOf("<ol"), code.indexOf("<ul"));
    const pictureAt = code.lastIndexOf("<NeonIllustration");
    expect(listAt).toBeGreaterThan(-1);
    expect(pictureAt).toBeGreaterThan(listAt);

    // The container that holds both. Sliced back to the flex box that opens before the list,
    // with a length assertion because a slice that found nothing passes everything.
    const containerAt = code.lastIndexOf('className="flex', listAt);
    expect(containerAt).toBeGreaterThan(-1);
    const container = code.slice(containerAt, listAt);
    expect(container.length).toBeGreaterThan(20);
    expect(container).not.toMatch(/flex-col/);
  });

  it("keeps the whole picture visible rather than cropping it", () => {
    /*
      `object-contain` for these two slots and `object-cover` still the default. They are
      graphics - a keyed-out emblem, a small diagram - so the edges carry the shape and a crop
      takes the corners off a badge. The default stays `cover` because the slots that already
      existed are a logo and a hero banner, where filling the frame is the job and a
      letterboxed banner reads as a broken image.
    */
    const code = readCode(CARDS);

    expect(code).toMatch(/fit === "contain" \? "object-contain" : "object-cover"/);
    expect(code).toMatch(/fit = "cover"/);
  });
});

describe("the heading strip is compact, and defined once", () => {
  it("is a prop on the kit panel rather than a second strip", () => {
    /*
      ONE DEFINITION. The alternative is a second copy of the gradient, the hairline, the
      glyph size and the heading token - and the band is exactly where a drifted shade shows,
      three compact panels across from the full-height ones above them.

      THE MEASUREMENT IS WHY IT EXISTS AT ALL: the default strip is about 34px of a 96px card,
      so a third of the panel goes on its own title before a line of content is drawn.
    */
    const code = readCode(CARDS);

    expect(code).toMatch(/dense \? "px-3 py-1\.5" : "px-4 py-2\.5"/);
    expect(code).toMatch(/dense \? "h-3 w-3" : "h-3\.5 w-3\.5"/);
    // A heading that wraps inside a fixed-height card pushes a line of content off the
    // bottom, which is content disappearing to make room for a title.
    expect(code).toMatch(/dense \? "truncate" : ""/);
  });

  it("is asked for by all three cards", () => {
    /*
      COUNTED ACROSS THE THREE, because one card keeping the tall strip is not a wrong
      heading - it is a card with one fewer line of content than its neighbours, which reads
      as the operator having written less.
    */
    for (const file of [RULES, HIGHLIGHTS, FEED]) {
      expect(readCode(file)).toMatch(/<NeonHeadedPanel[\s\S]{0,200}?\sdense\b/);
    }
  });

  it("does not put the heading strip own classes in a consumer", () => {
    // The negative half, as everywhere in this kit: importing the panel is trivially
    // satisfied by a screen that hand-rolls a heading strip beside it.
    for (const file of [RULES, HIGHLIGHTS, FEED, LAYOUT]) {
      expect(readCode(file)).not.toMatch(/px-3 py-1\.5/);
    }
  });
});

describe("the owner's wording, and the decision it reverses", () => {
  it("heads the middle card GAME TIPS", () => {
    /*
      THIS REVERSES A RECORDED DECISION rather than settling an open question, which is why it
      is asserted in both directions. The panel deliberately said `What to expect`: the lines
      are the operator's "why this game is fun" cards, and heading marketing copy as advice is
      a caption making a claim the content does not keep. The owner asked for `GAME TIPS`
      twice and overrode it - reasonably, because the field is free text the operator owns, so
      the heading is an instruction to whoever writes the next title's copy.
    */
    const code = readCode(HIGHLIGHTS);

    expect(code).toMatch(/title="Game tips"/);
    expect(code).not.toContain("What to expect");
  });

  it("heads the left card HOW IT WORKS, without the game name", () => {
    /*
      A heading longer than the card is wide costs a step, because a wrapped title pushes a
      line out of a card that cannot grow.

      THE LOBBY'S PANEL USED TO NAME THE GAME AND THIS TEST USED TO PIN THAT, asserting
      `How ${presentation.gameName} is scored` was still in the file. The owner's screenshot
      of the lobby on 11 September 2026 is what ended it: the live display name is
      `Circuit Sprint: Fast and Fun Spatial Puzzles`, so the template produced a heading
      running the width of the page. Interpolating an operator's free text of unbounded length
      into a sentence is the fault rather than the length of one name - so the assertion is
      inverted rather than deleted, and the template must now appear NOWHERE.
    */
    const code = readCode(RULES);

    expect(code).toMatch(/title="How it works"/);
    expect(code).not.toMatch(/gameName\} is scored/);
    // One heading for both screens, so there is exactly one of it.
    expect(code.match(/title="How it works"/g)).toHaveLength(2);
  });

  it("keeps the live marker on the players card and keeps it short", () => {
    const code = readCode(FEED);

    // The reference's small green dot and label, far right of the heading. `Live` rather than
    // `Live activity`, because the heading beside it is already `Recent players` and the two
    // together do not fit a compact strip.
    expect(code).toMatch(/bg-emerald-400/);
    expect(code).toMatch(/text-emerald-300/);
  });

  it("names no game anywhere in the three cards", () => {
    /*
      THE OWNER'S TARGET COPY IS GAME-SPECIFIC AND IS NOT WRITTEN HERE - "connect matching
      numbers with a path", "use corners to create longer paths". Those are the operator's
      sentences from the catalogue, and `arena-game-agnostic.test.ts` forbids a game-shaped
      noun in a quoted string in this folder, which exists because of this same screen's
      earlier instruction that "a tetris game doesn't have a board".

      So the cards render the shape the reference shows - numbered discs, ticks, compact rows
      - around whatever the operator wrote. That guard is the authority; this asserts the one
      thing it cannot, which is that the steps come from the presentation rather than from a
      literal beside them.
    */
    expect(readCode(RULES)).toMatch(/paragraphs\(text\)\.slice\(0, STRIP_STEP_LIMIT\)/);
    expect(readCode(HIGHLIGHTS)).toMatch(
      /highlights\.slice\(0, STRIP_TIP_LIMIT\)/,
    );
  });
});

describe("the dead full-width layout is gone rather than left as an invitation", () => {
  it("leaves ArenaHighlights with one shape", () => {
    /*
      The `row` layout had NO CALLER once the band was built - the lobby renders the rules
      panel and no highlights at all - so it was a branch nobody could reach, styling cards
      nobody would see. Deleted on the `shouldBlockEntry` and `requiresSyncPlay` precedent:
      a dead branch is an invitation, and restoring it is a one-line change that reads like
      using an existing API.
    */
    const code = readCode(HIGHLIGHTS);

    expect(code).not.toMatch(/IconTile/);
    expect(code).not.toMatch(/sm:grid-cols-2/);
    /*
      AND NO `layout` PROP AT ALL, not one narrowed to a single value. `layout?: "strip"`
      survived the deletion for an afternoon: accepted at the call site, destructured nowhere,
      read by nothing - the declared-written-dead shape this programme has now found on
      `requiresSyncPlay`, `isPaired`, `family` and four other fields. A prop with one legal
      value is a prop that does not exist yet.
    */
    expect(code).not.toMatch(/layout/);
  });

  it("has the play page ask the rules panel, and only it, for a layout", () => {
    const code = readCode(PLAY_PAGE);

    expect(code).toMatch(/<GameRulesPanel presentation=\{presentation\} layout="strip"/);

    const highlightsAt = code.indexOf("<ArenaHighlights");
    expect(highlightsAt).toBeGreaterThan(-1);
    const element = code.slice(highlightsAt, code.indexOf("/>", highlightsAt));
    expect(element.length).toBeGreaterThan(40);
    expect(element).not.toMatch(/layout/);
  });
});

describe("the operator is told which highlights get drawn", () => {
  const shared: [string, string, string, number][] = [
    ["tips", HIGHLIGHTS, "STRIP_TIP_LIMIT", ARENA_HIGHLIGHT_LIMIT],
    ["steps", RULES, "STRIP_STEP_LIMIT", ARENA_STEP_LIMIT],
  ];
  it.each(shared)("agrees with the player app about how many %s", (_l, file, name, admin) => {
    /*
      TWO COPIES OF ONE NUMBER, TWICE, and neither can be one: `apps/admin` cannot import from
      `components/games/`. The drift is worse than untidy - it makes the hint a lie, telling
      an operator that four are shown while the card draws three, so they write a fourth tip
      that is stored and never appears. A control that appears to work and does nothing.
    */
    /* eslint-disable-next-line security/detect-non-literal-regexp */
    const player = new RegExp(`const ${name} = (\\d+);`).exec(readCode(file));
    expect(player).not.toBeNull();
    expect(Number(player![1])).toBe(admin);
  });

  it("tells the operator that a line break is what makes a step", () => {
    /*
      THE ONE THING AN OPERATOR CANNOT DISCOVER. The strip numbers each LINE of `howToPlay`,
      so the reference's three numbered instructions appear the moment somebody writes three
      lines - and `circuit-sprint`'s seeded copy is one paragraph, so today it draws one. The
      field accepts both and saves both, which means the screen looks wrong for a reason that
      is nowhere on the screen. Asserted with the number, because a sentence promising three
      beside a card drawing four is the same lie one field along.
    */
    const code = readCode(CONTENT_DIALOG);

    expect(code).toMatch(/One line per step/);
    expect(code).toMatch(/\$\{ARENA_STEP_LIMIT\}/);
  });

  it("says so beside the field that offers more than that", () => {
    /*
      `CONTENT_LIMITS.highlights` is six and the card draws four, so the last two are stored
      and drawn nowhere - this is now the only screen that renders highlights at all. The
      admin dialog is the one place an operator can act on that, which is why the sentence is
      next to the button that offers them.
    */
    const code = readCode(CONTENT_DIALOG);

    expect(code).toMatch(/\{ARENA_HIGHLIGHT_LIMIT\}/);
    // And it says the title has to stand alone, beside a field labelled "detail" that an
      // operator would otherwise write the substance into.
    expect(code).toMatch(/on hover/);
  });
});
