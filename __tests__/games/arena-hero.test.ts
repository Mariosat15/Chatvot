import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  heroFeatures,
  resolveHeroFeatures,
  roundLengthLabel,
  splitGameTitle,
} from "../../components/games/arena/arena-facts";
import {
  HERO_FEATURE_ICONS,
  HERO_FEATURE_LABEL_MAX_LENGTH,
  HERO_FEATURE_LIMIT,
} from "../../lib/services/games/hero-features";
import {
  AI_NEVER_WRITABLE_CONTENT_FIELDS,
  AI_WRITABLE_CONTENT_FIELDS,
  validateGameContent,
} from "../../apps/admin/lib/admin/game-content-fields";

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
const PRESENTATION = join(ROOT, "lib", "services", "games", "game-presentation.service.ts");
const VOCABULARY = join(ROOT, "lib", "services", "games", "hero-features.ts");
const ADMIN_VOCABULARY = join(
  ROOT,
  "apps",
  "admin",
  "lib",
  "services",
  "games",
  "hero-features.ts",
);
const DIALOG = join(
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

    /*
      THE NUMBER MOVED AND THE MECHANISM DID NOT, which is the only reason a second
      measurement is worth anything. 118 was the middle of the owner's first range; on seeing
      it he asked for bigger icons, a bigger logo and the description to actually show, and
      said the banner could grow to carry them. 150 is what those sizes need - the badge, a
      25px heading, the subtitle, the tagline and two clamped description lines, plus the
      padding - rather than a number picked because it looked better. What must never change
      is that it is a ceiling; see the absences below.
    */
    expect(banner).toMatch(/sm:h-\[150px\]/);

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

  it("clamps the copy to the lines the height affords", () => {
    /*
      FOUR OF THE FIVE LINES ARE OPERATOR FIELDS with no practical length limit - the game's
      name, its two halves, the tagline and the description. At this height a single unplanned
      wrap pushes the line below it out of the banner, where `overflow-hidden` hides it
      silently.

      THE DESCRIPTION IS TWO LINES SINCE THE OWNER'S SECOND MESSAGE, and that is why this test
      was renamed rather than deleted: the claim is unchanged - every line is clamped to a
      number the height was measured for - and only the number moved. One line cut the live
      title's copy mid-sentence, which reads as a rendering fault rather than as a summary. A
      third line is forbidden, because the budget does not carry it and nothing on screen
      would say so.

      COUNTED, NOT MERELY FOUND, for the single-line fields. A test asserting the file contains
      `truncate` somewhere is satisfied by the heading alone while the tagline below it wraps,
      which is the shape of every "one identifier defeated a structural test" finding here.
    */
    const code = readCode(IDENTITY);

    expect(code.match(/truncate/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(code).toMatch(/line-clamp-2/);
    expect(code).not.toMatch(/line-clamp-[3-9]/);
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

    /*
      10px, up from the 8 of a few hours earlier: "the icons and info needs to be bigger". The
      claim this pins is unchanged - a size chosen for this column rather than the kit's
      `NEON_LABEL` - and the reason is still the kit token's wide tracking, which needs three
      lines for "Global leaderboard" at any size the budget allows. The icon is asserted too,
      because "bigger" was about the glyph first and a label alone satisfies the wrong half.
    */
    expect(item).toMatch(/text-\[10px\]/);
    expect(item).toMatch(/h-6 w-6/);
  });

  it("gives the logo a track the artwork actually fills", () => {
    /*
      "the game logo bigger". Two numbers, and asserting only one of them is the trap: the
      picture's box is inside a grid track, so growing the box alone leaves it clipped by a
      132px column and growing the track alone leaves a small logo in a wide gap. Both are
      read out of the file and compared, so they cannot drift apart.

      The monogram is checked too. It is the fallback for a title with no artwork - every
      title until an operator uploads one - so leaving it at the old size is a shrunken
      placeholder in a box sized for something else, on the common case rather than the rare one.
    */
    const code = readCode(IDENTITY);

    const track = /sm:grid-cols-\[(\d+)px_/.exec(code);
    expect(track).not.toBeNull();

    const box = /sm:h-\[120px\] sm:w-\[(\d+)px\]/.exec(code);
    expect(box).not.toBeNull();

    expect(Number(box![1])).toBe(Number(track![1]));
    expect(Number(track![1])).toBeGreaterThan(132);
    expect(code).toMatch(/sm:h-\[112px\] sm:w-\[112px\]/);
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

/**
 * The strip an operator writes, and the four the banner works out when they have not.
 *
 * WHERE THIS CAME FROM. The same reply of 11 September 2026: "the info and icons of the banner
 * must be able to change them from the games edit content in admin like the others". Until
 * then the four were entirely derived, which is correct and was also the one thing an operator
 * could not adjust on the strip a player reads immediately before paying to enter.
 *
 * THE EMPTY CASE IS THE ONE THE GUARDS ARE FOR. No title in the catalogue carries authored
 * features, so reading an unset field as "show none" would have stripped four facts off every
 * hero the day this shipped, with nothing failing and nothing logged. Absent means DERIVED.
 */
describe("the banner's strip is the operator's when they have written one", () => {
  it("replaces all four when even one is written", () => {
    /*
      ALL FOUR, NOT A MERGE, and the alternative is worse in a way that only shows on screen:
      an operator writing two lines and finding two of ours beside them cannot tell which is
      which, and cannot remove ours. The dialog says so beside the field, because a rule an
      operator cannot see is one they cannot use.
    */
    const features = resolveHeroFeatures(
      [{ icon: "reward", label: "Big rewards" }],
      120,
      "independent",
      2,
      100,
    );

    expect(features).toEqual([{ icon: "reward", label: "Big rewards" }]);
  });

  it("works the four out when nothing is written", () => {
    // All three shapes of absent, because a document can carry any of them.
    for (const authored of [undefined, [], null as unknown as undefined]) {
      const features = resolveHeroFeatures(authored, 120, "independent", 2, 100);
      expect(features.map((f) => f.label)).toEqual(
        heroFeatures(120, "independent", 2, 100).map((f) => f.label),
      );
    }
  });

  it("keeps the words when it does not know the glyph", () => {
    /*
      An unrecognised slug loses its picture and KEEPS ITS ROW. The label is the operator's
      statement and the icon is decoration beside it, so dropping the row to save the picture
      is the wrong way round - the same rule as an unrecognised genre being shown verbatim
      rather than remapped to the nearest known one.
    */
    const features = resolveHeroFeatures(
      [{ icon: "something-a-later-build-offers", label: "Daily finals" }],
      120,
      "independent",
      2,
      100,
    );

    expect(features).toEqual([{ icon: undefined, label: "Daily finals" }]);
  });

  it("drops a row that has no words at all", () => {
    /*
      A glyph with nothing under it is a floating picture in a column beside three that have
      labels. The validator refuses one at the door, so this only catches a document written
      before that existed - and if every row is blank the derived four come back, because an
      unusable list is not an instruction.
    */
    expect(
      resolveHeroFeatures([{ icon: "speed", label: "   " }], 120, "independent", 2, 100),
    ).toHaveLength(4);
  });

  it("offers no glyph the banner cannot draw", () => {
    /*
      EXHAUSTIVE OVER THE VOCABULARY, not a spot check. A slug the picker offers and the map
      does not carry renders a neutral mark on a live banner while the admin screen shows the
      operator the icon they chose - a control that appears to work and does something else,
      which is the shape behind enabling a provider with no adapter.
    */
    const code = readCode(IDENTITY);

    // Reason: the slug comes from the frozen vocabulary a line above, not from input. The
    // rule is right about the shape and there is nothing here a caller could reach.
    /* eslint-disable security/detect-non-literal-regexp */
    for (const option of HERO_FEATURE_ICONS) {
      expect(code, `no glyph for "${option.slug}"`).toMatch(
        new RegExp(`\\["${option.slug}",\\s*\\w+\\]`),
      );
    }
    /* eslint-enable security/detect-non-literal-regexp */
  });

  it("names no game anywhere in the vocabulary", () => {
    /*
      These slugs are quoted strings inside the arena, so a glyph named after one game's
      furniture - a board, a lap, a level - would turn the agnostic guard red, correctly. It is
      asserted here as well because the vocabulary is the place somebody would add one.
    */
    for (const option of HERO_FEATURE_ICONS) {
      expect(option.slug).toMatch(/^[a-z]+$/);
      expect(["board", "puzzle", "grid", "tile", "square", "lap", "level", "piece"]).not.toContain(
        option.slug,
      );
    }
  });
});

describe("the admin door onto the banner's strip", () => {
  it("refuses an icon the picker does not offer", () => {
    /*
      REFUSED, WHERE AN UNKNOWN GENRE IS NORMALISED, and the question that decides it is
      whether any legitimate writer can produce the value. A genre arrives as free text from a
      provider sync and from titles predating the vocabulary, so refusing it would block an
      unrelated edit on the same screen. Nothing but this dialog has ever written an icon slug.
    */
    const result = validateGameContent({
      heroFeatures: [{ icon: "explosion", label: "Fast rounds" }],
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a row with no label, and one too long for the column", () => {
    expect(validateGameContent({ heroFeatures: [{ icon: "speed", label: "  " }] }).ok).toBe(false);
    expect(
      validateGameContent({
        heroFeatures: [{ icon: "speed", label: "x".repeat(HERO_FEATURE_LABEL_MAX_LENGTH + 1) }],
      }).ok,
    ).toBe(false);
  });

  it("refuses more features than the banner has columns", () => {
    /*
      The limit is IMPORTED rather than typed here, because the banner draws exactly what is
      stored: a fifth row is not "stored and not shown", there is nowhere for it to go, and two
      numbers would let the form offer one the banner has no column for.
    */
    const rows = Array.from({ length: HERO_FEATURE_LIMIT + 1 }, () => ({
      icon: "speed",
      label: "Fast rounds",
    }));

    expect(validateGameContent({ heroFeatures: rows }).ok).toBe(false);
  });

  it("accepts a full strip and trims what it stores", () => {
    const result = validateGameContent({
      heroFeatures: [{ icon: "reward", label: "  Big rewards  " }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content.heroFeatures).toEqual([{ icon: "reward", label: "Big rewards" }]);
    }
  });

  it("keeps the assistant out of the strip", () => {
    /*
      BARRED WITH A REASON RATHER THAN MERELY ABSENT from the writable list, because a field
      missing from an allow-list is admitted the moment somebody widens it for an unrelated
      reason. These are short marketing lines and so look like the assistant's territory; each
      one occupies the slot the platform otherwise fills from the round ceiling, the declared
      family and the contest's player range, so a model writes "3 minute rounds" on a title
      whose ceiling is ten - right about the genre, wrong about the number.
    */
    expect(AI_WRITABLE_CONTENT_FIELDS).not.toContain("heroFeatures");
    expect(AI_NEVER_WRITABLE_CONTENT_FIELDS.has("heroFeatures")).toBe(true);
  });

  it("reads the strip back out of the catalogue", () => {
    /*
      ASSERTED ON THE PROJECTION, which is the one of the four mentions that decides whether a
      value arrives at all. This is the s4.1k defect exactly: the rules text was stored,
      operator-editable and selected by nothing, so a contest could tell a paying player the
      pot, the fee and the clock and never say what a winning score was.
    */
    const code = readCode(PRESENTATION);

    const select = /\.select\(\s*"([^"]+)"/.exec(code);
    expect(select).not.toBeNull();
    expect(select![1]).toContain("heroFeatures");

    // Reason: an array, so the `|| undefined` normalisation the string fields use would turn
    // an empty list into `undefined` at one caller and `[]` at another. `Array.isArray` is the
    // single answer, and every consumer reads "empty means derive" from it.
    expect(code).toMatch(/heroFeatures: Array\.isArray\(title\.heroFeatures\)/);
  });

  it("mirrors the vocabulary byte for byte", () => {
    /*
      `check:mirrors` compares MODELS, so it has no opinion about this file. The two copies
      disagreeing means a glyph the admin offers is one the player's banner cannot draw, which
      renders as a blank space beside a label on the screen a player is paying on.
    */
    expect(readFileSync(VOCABULARY, "utf8")).toBe(readFileSync(ADMIN_VOCABULARY, "utf8"));
  });

  it("tells the operator what an empty strip does", () => {
    /*
      THE SENTENCE IS THE FEATURE. Leaving the list empty is not "show nothing" and adding one
      row replaces all four; neither is guessable from a list of inputs, and both are decisions
      an operator has to make. So the dialog says both, and a probe deleting either goes red.
    */
    const code = readCode(DIALOG);

    expect(code).toMatch(/works them out/);
    expect(code).toMatch(/replace all of them/);
    expect(code).toMatch(/HERO_FEATURE_ICONS\.map/);
  });
});
