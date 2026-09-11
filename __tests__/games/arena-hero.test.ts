import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  heroFeatures,
  roundLengthLabel,
  splitGameTitle,
} from "../../components/games/arena/arena-facts";

/**
 * The arena's hero is one thin horizontal banner, not a page-height header.
 *
 * WHERE THIS CAME FROM. The owner's instruction of 11 September 2026, against a screenshot of
 * what had been built and a reference for what it should be: "the current banner is far too
 * tall and has unnecessary content/cards underneath... TARGET: a single compact horizontal
 * banner, approximately 110-125px high on desktop... the banner must stay visually SHORT."
 * It is the second rebuild of this component in a day and the fault was the same both times.
 *
 * THE HEIGHT IS THE SPECIFICATION, so it is asserted as a measurement. Two mechanisms hold it
 * and each is silent on its own:
 *
 *  1. The banner's height is FIXED, never a minimum. A floor is a number content is free to
 *     exceed, which is how a 220px `min-height` became a 400px header one reasonable addition
 *     at a time - a subtitle, a longer description, the contest's name, three bordered cards.
 *  2. Every line of copy is CLAMPED. A fixed height with unclamped content is `overflow:
 *     hidden` doing the work, which means an operator's words vanishing with nothing on screen
 *     to say so - the failure mode this programme keeps finding.
 *
 * THE BANNED SPELLINGS ARE ASSERTED ABSENT, not merely the right one asserted present. A
 * `min-h-` left beside the fixed height reads as belt and braces and re-inflates the banner,
 * with the fixed height still in the file looking as though it governs. Same rule as the
 * bottom band's 104px.
 *
 * The assertions are structural because there is no wrong number here to assert on. A 400px
 * banner renders perfectly, throws nothing and logs nothing; the only witness is a screenshot,
 * which is why the owner is the one who found it twice.
 */

const ROOT = process.cwd();

const LAYOUT = join(ROOT, "components", "games", "arena", "GameArenaLayout.tsx");
const IDENTITY = join(ROOT, "components", "games", "arena", "ArenaIdentity.tsx");

/**
 * Comments stripped before matching, always.
 *
 * Both files argue about this defect in prose - the layout's comment quotes the owner's "far
 * too tall" and names the 110-125 range, and the identity's header explains what a `min-height`
 * did to it. A bare match reads the explanation as the code: it passes a broken file whose only
 * mention of the right thing is a comment, and fails a correct one for discussing the mistake.
 * Both directions have cost this project a false result.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The banner's own markup, sliced forward from the panel that opens it.
 *
 * SLICED FORWARD AND ASSERTED TO HAVE FOUND SOMETHING. A slice taken backwards finds whatever
 * construct is closest, which has produced a false result on this screen three times; and a
 * slice that found nothing passes everything asked of it.
 */
function bannerMarkup(): string {
  const code = readCode(LAYOUT);

  // The INTERPOLATION, never the bare name - the bare name's first occurrence is the import at
  // the top of the file, which opens the slice 200 lines early and swallows the whole
  // component. A slice that starts in the wrong place still satisfies a length assertion.
  const from = code.indexOf("${NEON_PANEL_LIT}");
  expect(from).toBeGreaterThan(-1);

  const to = code.indexOf("</ArenaIdentity", from);
  const close = to > from ? to : code.indexOf("<ArenaIdentity", from);
  expect(close).toBeGreaterThan(from);

  const banner = code.slice(from, close);
  expect(banner.length).toBeGreaterThan(200);
  return banner;
}

describe("the arena hero stays one thin banner", () => {
  it("fixes the height rather than flooring it", () => {
    const banner = bannerMarkup();

    // 118 is the middle of the owner's 110-125.
    expect(banner).toMatch(/sm:h-\[118px\]/);

    /*
      THE ABSENCES ARE THE TEST. Each of these is a way to make the banner grow again while
      the fixed height stays in the file reading as though it decides: a floor content may
      exceed, an explicit auto, or the generous padding the previous version carried (`p-5
      sm:p-7`, against the owner's 8px/18px).
    */
    expect(banner).not.toMatch(/min-h-/);
    expect(banner).not.toMatch(/h-auto/);
    expect(banner).not.toMatch(/\bp-5\b/);
    expect(banner).not.toMatch(/\bp-7\b/);
  });

  it("crops rather than letting anything spill", () => {
    /*
      The ceiling is only a ceiling if what exceeds it is hidden.

      ASSERTED ON THE PANEL'S OWN CLASS RUN, never on the banner as a whole. `overflow-hidden`
      also sits on the artwork's window a few lines below, so a bare match stays green while
      the panel itself lets the copy paint over whatever is beneath it - proven by a probe that
      removed it and went green. Fifth time one identifier has defeated a structural test here.
    */
    const banner = bannerMarkup();
    const at = banner.indexOf("${NEON_PANEL_LIT}");
    const end = banner.indexOf("`", at);
    expect(end).toBeGreaterThan(at);

    const panelClass = banner.slice(at, end);
    expect(panelClass.length).toBeLessThan(120);
    expect(panelClass).toMatch(/overflow-hidden/);
  });

  it("clamps every line of operator copy to one", () => {
    /*
      FOUR OF THE FIVE LINES ARE OPERATOR FIELDS with no practical length limit - the game's
      name, its two halves, the tagline and the description. At this height a single wrap
      pushes the line below it out of the banner, where `overflow-hidden` hides it silently.

      COUNTED, NOT MERELY FOUND. A test asserting the file contains `truncate` somewhere is
      satisfied by the heading alone while the tagline below it wraps, which is exactly the
      shape of every "one identifier defeated a structural test" finding in this codebase.
    */
    const code = readCode(IDENTITY);

    expect(code.match(/truncate/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(code).toMatch(/line-clamp-1/);
    expect(code).not.toMatch(/line-clamp-[2-9]/);
  });

  it("draws the features as icon and label, never as cards", () => {
    /*
      "These are small icon + label items. No large boxes around them." The previous version
      drew three bordered, padded, tinted cards across the foot of the hero, which is what made
      them read as a second section rather than as part of the banner - and a box needs padding,
      which is height.

      ASSERTED ON THE FEATURE ITEM ITSELF, sliced from the map that produces it, because the
      file legitimately contains a border on the genre badge and on the logo's monogram. A
      file-wide ban on `border` would fail on correct code, which is the kind of guard the
      first person it inconveniences deletes.
    */
    const code = readCode(IDENTITY);
    const from = code.indexOf("features.map(");
    expect(from).toBeGreaterThan(-1);

    const item = code.slice(from, code.indexOf("</div>", from));
    expect(item.length).toBeGreaterThan(80);

    expect(item).not.toMatch(/border/);
    expect(item).not.toMatch(/rounded/);
    expect(item).not.toMatch(/\bbg-/);
    // 7-9px, the owner's range for these labels.
    expect(item).toMatch(/text-\[[789]px\]/);
  });

  it("reserves the right-hand track so the copy stops before the artwork", () => {
    /*
      The banner's picture bleeds to the right edge. Without a track held back for it the copy
      runs underneath, so a player reads a tagline over a trophy - and the alternative fix,
      shortening the copy, is a guess that is wrong at the next viewport width.
    */
    expect(readCode(IDENTITY)).toMatch(/xl:grid-cols-\[[^\]]*_330px\]/);
  });

  it("paints the full-width wash before the right-hand piece", () => {
    /*
      POSITION, NOT PRESENCE, and it is load-bearing. The two passes are absolutely positioned
      siblings with no z-index between them, so they paint in document order. Written the other
      way round the dim full-width wash covers the right-hand piece and the trophy disappears
      behind a 40%-opacity copy of itself - which looks like a dim banner rather than like two
      layers in the wrong order, so nothing about the symptom points at the cause.
    */
    const banner = bannerMarkup();

    const washAt = banner.indexOf("opacity-40");
    const pieceAt = banner.indexOf("h-[300px]");

    expect(washAt).toBeGreaterThan(-1);
    expect(pieceAt).toBeGreaterThan(-1);
    expect(washAt).toBeLessThan(pieceAt);
  });

  // Named without an apostrophe deliberately: vitest's `-t` filter is a REGULAR EXPRESSION,
  // and a probe naming a title it cannot match reports a passing run over zero tests, which
  // reads exactly like a missing guard. That has cost a false result here before.
  it("states the contest name once on the page, not twice", () => {
    /*
      The contest's name was a fifth line of copy inside the banner, directly below a "Back to
      {name}" link that already said it. Removing it is a line of height for nothing lost - and
      the assertion is in both directions, because deleting the link as well would take the
      contest's name off the screen altogether.
    */
    expect(readCode(LAYOUT)).toMatch(/Back to \{competitionName\}/);
    expect(readCode(IDENTITY)).not.toMatch(/contestName/);
  });
});

describe("the hero's copy comes from the catalogue, split where the catalogue cannot", () => {
  it("splits a name at its own colon", () => {
    /*
      The catalogue stores ONE name field and the reference shows a title with a subtitle under
      it. The live title is `Circuit Sprint: Fast and Fun Spatial Puzzles`, which at heading
      size runs the width of the page - the same fault that made the rules panel's heading
      unreadable, one field along.
    */
    expect(splitGameTitle("Circuit Sprint: Fast and Fun Spatial Puzzles")).toEqual(
      { title: "Circuit Sprint", subtitle: "Fast and Fun Spatial Puzzles" },
    );
  });

  it("leaves a name with no colon whole", () => {
    expect(splitGameTitle("Circuit Perfect")).toEqual({
      title: "Circuit Perfect",
      subtitle: null,
    });
  });

  it("keeps the whole name when a half would be empty", () => {
    /*
      A decorative colon - leading, trailing, or with nothing but space beside it - must not
      produce a blank heading with the real name demoted to a subtitle. Both directions,
      because each is a different half of the same guard.
    */
    expect(splitGameTitle(": Circuit Sprint").title).toBe(": Circuit Sprint");
    expect(splitGameTitle("Circuit Sprint:").title).toBe("Circuit Sprint:");
    expect(splitGameTitle("Circuit Sprint: ").subtitle).toBeNull();
  });

  it("says a round is fast only when the ceiling makes it so", () => {
    /*
      `maxDurationSeconds` IS A CEILING, NOT A LENGTH. Under five minutes every round is short
      whatever the contest configured, so the claim holds; above it the label says "up to",
      because stating the ceiling as the round length is a number no player's clock agrees with.
    */
    expect(roundLengthLabel(120)).toBe("Fast rounds");
    expect(roundLengthLabel(300)).toBe("Fast rounds");
    expect(roundLengthLabel(600)).toBe("Up to 10 min");
  });

  it("says nothing at all when no ceiling is declared", () => {
    // A guessed length is a deadline the platform never set.
    for (const value of [undefined, 0, -1, Number.NaN]) {
      expect(roundLengthLabel(value)).toBeNull();
    }
  });

  it("puts the contest's own player range in the players slot", () => {
    const features = heroFeatures(120, "independent", 2, 100);
    expect(features.map((f) => f.label)).toContain("2–100 players");
  });

  it("promises no reward it cannot check", () => {
    /*
      THE REFERENCE'S FOURTH LABEL IS "BIG REWARDS" AND IT IS DELIBERATELY NOT HERE. What a
      contest pays depends on its prize pool, so the phrase is a promise this banner cannot
      verify and a free contest would carry it too. The trophy position holds the platform's
      skill guarantee instead, which is the strongest claim that is always true.

      Asserted as an absence because that is the failure: a caption is a claim, and one that
      is wrong for a free contest renders exactly as well as one that is right.
    */
    const labels = heroFeatures(120, "independent", 2, 100).map((f) => f.label);

    expect(labels).not.toContain("Big rewards");
    expect(labels).toContain("Skill based");
    expect(labels).toContain("Global leaderboard");
    expect(labels).toHaveLength(4);
  });

  it("falls back to the declared shape rather than padding to four", () => {
    /*
      A title that declares no round ceiling loses that feature and gains the other thing a
      declared field can say about an attempt - who it is played against. A title declaring
      neither renders three, because inventing a fourth is how a screen starts making claims
      nothing backs.
    */
    expect(
      heroFeatures(undefined, "independent", 2, 100).map((f) => f.label),
    ).toContain("Solo run");

    expect(heroFeatures(undefined, undefined, 2, 100)).toHaveLength(3);
  });
});
