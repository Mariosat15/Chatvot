import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ARTWORK_SLOTS,
  isArtworkSlot,
} from "../../apps/admin/lib/admin/game-artwork-slots";
import {
  EDITABLE_CONTENT_FIELDS,
  AI_NEVER_WRITABLE_CONTENT_FIELDS,
  validateGameContent,
} from "../../apps/admin/lib/admin/game-content-fields";

/**
 * The arena's two illustrations, and the band that holds them level.
 *
 * WHERE THIS CAME FROM. The owner's instruction of 11 September 2026, against a screenshot of
 * the three-panel band with all three panels circled: "they don't align, one bigger than the
 * other they must be the same", and "have images next to letters icons... or better create a
 * place in the games add content in admin and when I put images there will show them".
 *
 * THREE SEPARATE CLAIMS ARE PINNED HERE and they fail in different ways, which is why they
 * are one suite rather than three assertions:
 *
 *  1. The panels are the same height. They already sat in stretched wrappers, so the wrappers
 *     were never the problem - each PANEL sized to its own text and left the rest of its
 *     wrapper empty. A fix applied to the wrapper's own height changes nothing at all and
 *     looks completely correct.
 *  2. The illustration is the operator's upload when there is one and a drawn emblem when
 *     there is not. The absent case is the normal one - no title in the catalogue carries
 *     either image - so a version that renders nothing when unset is green against every
 *     test that only ever supplies a URL.
 *  3. Nothing about the emblem names a game. The arena's agnostic guard covers the arena
 *     folder; `NeonIllustration` lives in the kit, which that guard does not read.
 *
 * The assertions are structural because there is no wrong number anywhere here: every one of
 * these defects renders perfectly and reports success.
 */

const ROOT = process.cwd();

const LAYOUT = join(ROOT, "components", "games", "arena", "GameArenaLayout.tsx");
const HIGHLIGHTS = join(
  ROOT,
  "components",
  "games",
  "arena",
  "ArenaHighlights.tsx",
);
const RULES = join(ROOT, "components", "games", "GameRulesPanel.tsx");
const CARDS = join(ROOT, "components", "neon", "Cards.tsx");
const PRESENTATION = join(
  ROOT,
  "lib",
  "services",
  "games",
  "game-presentation.service.ts",
);
const PLAY_PAGE = join(
  ROOT,
  "app",
  "(root)",
  "competitions",
  "[id]",
  "play",
  "page.tsx",
);
const BUTTON = join(ROOT, "components", "ui", "button.tsx");
const ADMIN_BUTTON = join(ROOT, "apps", "admin", "components", "ui", "button.tsx");
const NEON_BUTTONS = join(ROOT, "components", "neon", "Buttons.tsx");
const ARTWORK_ROUTE = join(
  ROOT,
  "apps",
  "admin",
  "app",
  "api",
  "games",
  "providers",
  "[providerKey]",
  "games",
  "artwork",
  "route.ts",
);
const ARTWORK_FIELD = join(
  ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "games",
  "GameArtworkField.tsx",
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
 * Every file here explains its own trap in prose - the band's comment names `empty:hidden`,
 * the button primitives name `cursor-pointer`, the kit names the fallback. A bare match reads
 * the explanation as the code: it passes a broken file whose only mention of the right thing
 * is a comment, and fails a correct one for discussing the mistake.
 */
function readCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the arena's bottom band holds its three panels level", () => {
  it("reaches through each wrapper to the panel inside it", () => {
    /*
      THE ASSERTION IS ON THE CHILD SELECTOR, NOT ON A HEIGHT, and that distinction is the
      whole finding. `h-full` on the wrapper is the obvious spelling and it is a no-op: a flex
      item already stretches, so the wrappers were the same height while the owner was looking
      at panels that were not. Only `[&>*]:h-full` reaches the thing that was actually short.
    */
    /*
      SCOPED TO THE BAND SINCE 11 SEPTEMBER 2026, AND THE CLAIM IS UNCHANGED. This counted the
      whole file and read 3, which was the band's three wrappers only because nothing else in
      the arena needed the selector. The leaderboard rail then needed exactly the same rule for
      exactly the same reason - see `xl:[&>*]:h-full` on its grid cell - and a file-wide count
      cannot tell the band's three from anybody else's, so it failed on a correct file. Slice
      the band, count the band.
    */
    const code = readCode(LAYOUT);
    const bandAt = code.indexOf("flex flex-wrap items-stretch");
    expect(bandAt).toBeGreaterThan(0);
    const band = code.slice(bandAt);
    const matches = band.match(/\[&>\*\]:h-full/g) ?? [];

    expect(matches).toHaveLength(3);
  });

  it("still lets a panel with nothing in it leave the row", () => {
    /*
      COUNTED, because this band was built, reverted and rebuilt. All three slots return
      `null` when their content is absent and that is the COMMON case - no title carries rules
      text until the catalogue is re-synced - so a wrapper that loses `empty:hidden` is an
      empty third of the page on every contest, not on an unlucky one.

      `flex-wrap` is asserted with it because the pair is the mechanism: a hidden GRID item
      leaves its track behind, so the same `empty:hidden` under `grid-cols-3` is a hole.
    */
    const code = readCode(LAYOUT);

    expect((code.match(/empty:hidden/g) ?? []).length).toBe(3);
    expect(code).toMatch(/flex flex-wrap/);
    expect(code).not.toMatch(/grid-cols-3/);
  });
});

describe("the illustration beside a panel", () => {
  it("draws the emblem when the operator has uploaded nothing", () => {
    /*
      THE FALLBACK IS THE POINT OF THE COMPONENT. Every title today has no image, so a version
      that renders the `src` and nothing else satisfies any test that supplies one - and ships
      a band where some panels are illustrated and the rest look broken.

      Asserted as an early return guarded by `src`, with a second branch after it, rather than
      by searching for the word "fallback": that names the intent instead of the behaviour.
    */
    const code = readCode(CARDS);
    const start = code.indexOf("export function NeonIllustration");
    expect(start).toBeGreaterThan(-1);

    const body = code.slice(start, code.indexOf("export function", start + 10));
    expect(body.length).toBeGreaterThan(200);

    const guard = body.indexOf("if (src)");
    expect(guard).toBeGreaterThan(-1);
    // The `<img>` is INSIDE the guard and the emblem is after it. Written the other way round
    // - an emblem always drawn with the picture over it - a broken URL shows both.
    expect(body.indexOf("<img")).toBeGreaterThan(guard);
    expect(body.lastIndexOf("rounded-full")).toBeGreaterThan(body.indexOf("<img"));
  });

  it("writes no words of its own under the emblem", () => {
    /*
      NO CAPTION, and the reason is that a caption here could only ever be wrong. This
      component does not know which game it is illustrating - the glyph is chosen by the
      calling panel, so the rules panel draws the rules glyph whatever game it is describing
      - and the arena's game-agnostic guard reads `components/games/arena/**`, which this
      file is not in. A caption is where somebody would helpfully write "puzzle board".

      Asserted as "no text-bearing element", not as a list of banned nouns: a noun list would
      have to permit `classes.tile` and `aspect-square`, which are class names rather than
      anything a player reads, and a guard that has to make that exception is one that will
      eventually make the wrong one.
    */
    const code = readCode(CARDS);
    const start = code.indexOf("export function NeonIllustration");
    const body = code.slice(start, code.indexOf("export function", start + 10));
    expect(body.length).toBeGreaterThan(200);

    expect(body).not.toMatch(/<(span|p|h[1-6]|figcaption)\b/);
    // The description belongs to the caller, which knows what the panel is for. A default
    // here would be a sentence about an image nobody has seen.
    expect(body).not.toMatch(/alt\s*=\s*"/);
  });

  it("is drawn on both panels, from the field the operator set", () => {
    /*
      Two panels, two fields, and the pairing is the thing that gets crossed: both props are
      optional strings, so handing the highlights emblem to the rules panel typechecks and
      renders a picture in the wrong place.
    */
    const rules = readCode(RULES);
    expect(rules).toMatch(/src=\{presentation\.howToPlayImageUrl\}/);

    const highlights = readCode(HIGHLIGHTS);
    expect(highlights).toMatch(/src=\{imageUrl\}/);

    const page = readCode(PLAY_PAGE);
    expect(page).toMatch(/imageUrl=\{presentation\.highlightsImageUrl\}/);
  });

  it("is not hidden behind a layout the arena never asks for", () => {
    /*
      The rules panel takes a `layout` prop and the arena passes `column`, not `wide`. A
      condition reading `layout === "wide"` around the picture is correct-looking, passes a
      test that only checks the picture exists in the file, and leaves it off the one screen
      it was asked for. This asserts the illustration is NOT inside such a branch.
    */
    const code = readCode(RULES);

    /*
      THE ELEMENT, NOT THE IDENTIFIER. `indexOf("NeonIllustration")` finds the IMPORT on line
      two, so the slice examined the file header and the probe injecting the exact defect came
      back green. An import is not a use - the same trap as `canTransitionRound` and
      `MIN_REASON_LENGTH`, and it has now cost a false pass in this suite too.
    */
    /*
      COUNTED, because there are now TWO of them - the full panel's and the compact strip's -
      and `indexOf` checks the first. A guard aimed at one occurrence is green while the other
      is behind the exact condition being banned, which is the same shape as the `!expectedOrigin`
      and Edit-guard false passes.
    */
    const uses: number[] = [];
    for (let at = code.indexOf("<NeonIllustration"); at > -1; ) {
      uses.push(at);
      at = code.indexOf("<NeonIllustration", at + 1);
    }
    expect(uses.length).toBeGreaterThanOrEqual(2);

    for (const at of uses) {
      const before = code.slice(Math.max(0, at - 400), at);
      expect(before).not.toMatch(/layout\s*===\s*"wide"/);
    }
  });
});

describe("the operator's upload reaches the title", () => {
  it("carries both new fields end to end", () => {
    /*
      THREE PLACES OR IT ARRIVES UNDEFINED - the Mongoose projection, the hand-written lean
      generic and the returned object. An explicitly-typed `.lean<{...}>()` is exactly where a
      field that does not exist looks real: the compiler checks the generic, not the schema,
      which is where the missing `participant.score` read hid for a day (R32/R33).

      ASSERTED BY LOCATION, NEVER BY COUNTING OCCURRENCES. A count was the first version and a
      probe deleting the field from the projection stayed green: the name still appeared in
      the interface, the generic and the return, so the total never fell below the threshold
      - and the projection is the one of the four that decides whether a value arrives.
    */
    const code = readCode(PRESENTATION);

    const select = /\.select\(\s*"([^"]+)"/.exec(code);
    expect(select).not.toBeNull();

    // Reason: the two field names are literals a line above, not input. The rule is right
    // about the shape and there is nothing here a caller could reach.
    /* eslint-disable security/detect-non-literal-regexp */
    for (const field of ["howToPlayImageUrl", "highlightsImageUrl"]) {
      expect(select![1]).toContain(field);
      expect(code).toMatch(new RegExp(`${field}\\?: string;`));
      expect(code).toMatch(new RegExp(`${field}: title\\.${field} \\|\\| undefined`));
    }
    /* eslint-enable security/detect-non-literal-regexp */
  });

  it("offers both as their own slots in the content dialog", () => {
    const code = readCode(CONTENT_DIALOG);

    expect(code).toMatch(/slot="how-to-play"/);
    expect(code).toMatch(/slot="highlight"/);
    // Saved AND handed back to the parent row. Omitting the second leaves the row holding the
    // old value, so reopening shows the picture the operator just replaced.
    expect(code).toMatch(/howToPlayImageUrl: draft\.howToPlayImageUrl/);
    expect(code).toMatch(/highlightsImageUrl: draft\.highlightsImageUrl/);
  });

  it("validates both by the same clause as every other image address", () => {
    /*
      A plain-http address is refused because the app is served over https and the browser
      blocks it as mixed content - so it draws nothing, with no error anywhere. Asserted per
      field, because a second loop written for these two is how one image field ends up with
      a weaker check than its neighbour.
    */
    for (const field of ["howToPlayImageUrl", "highlightsImageUrl"] as const) {
      expect(EDITABLE_CONTENT_FIELDS.has(field)).toBe(true);
      expect(AI_NEVER_WRITABLE_CONTENT_FIELDS.has(field)).toBe(true);

      const bad = validateGameContent({ [field]: "http://example.com/a.png" });
      expect(bad.ok).toBe(false);

      const good = validateGameContent({ [field]: "/api/assets/images/a.png" });
      expect(good.ok).toBe(true);
    }
  });

  it("refuses a slot the upload route does not know", () => {
    /*
      The slot reaches the STORED FILENAME, so an unchecked one is caller-supplied text in a
      path. A `Set` rather than an object because object indexing walks the prototype chain -
      `ACTIONS["__proto__"]` is truthy and survives a `!target` test.
    */
    expect(isArtworkSlot("how-to-play")).toBe(true);
    expect(isArtworkSlot("highlight")).toBe(true);
    expect(isArtworkSlot("__proto__")).toBe(false);
    expect(isArtworkSlot("constructor")).toBe(false);
    expect(ARTWORK_SLOTS.size).toBe(4);
  });

  it("shares one list between the form and the route", () => {
    /*
      Written twice, a form offering a slot the route has not heard of fails with a 400 that
      reads like a permissions problem. Both must IMPORT it - and the route must not keep a
      literal comparison beside the import, which is what the second assertion catches.
    */
    const route = readCode(ARTWORK_ROUTE);
    expect(route).toMatch(/isArtworkSlot/);
    expect(route).not.toMatch(/slot\s*!==\s*"logo"/);

    expect(readCode(ARTWORK_FIELD)).toMatch(/ArtworkSlot/);
  });
});

describe("a control under the pointer shows a hand", () => {
  it("is set on the primitive, not on one component class at a time", () => {
    /*
      Tailwind v4's preflight no longer sets `cursor: pointer` on a <button>, so every button
      in both apps lost its hand cursor on the upgrade and `globals.css` had been putting it
      back a component at a time. The owner asked for it on 11 September 2026.

      `disabled:pointer-events-none` is asserted with it: without that, a disabled control
      still offers the hand, which promises a click that does nothing.
    */
    for (const path of [BUTTON, ADMIN_BUTTON]) {
      const code = readCode(path);
      expect(code).toMatch(/inline-flex cursor-pointer/);
      expect(code).toMatch(/disabled:pointer-events-none/);
    }
  });

  it("is set on the neon control too, without overriding the disabled cursor", () => {
    /*
      The kit's buttons do not use the primitive, so they need their own. The disabled string
      must keep `cursor-not-allowed` - it comes after BASE in the class list, and a version
      that drops it leaves a hand over a control the player cannot use.
    */
    const code = readCode(NEON_BUTTONS);
    expect(code).toMatch(/cursor-pointer/);
    expect(code).toMatch(/cursor-not-allowed/);
  });
});
