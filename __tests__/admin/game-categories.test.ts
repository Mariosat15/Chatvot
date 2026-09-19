/**
 * Task document 9 - the game type / category vocabulary.
 *
 * WHAT THIS IS TESTING, because the task's wording invites the wrong reading: the FIELD
 * already existed. `provider_game.category` has been there since X2, free text with a
 * 40-character limit, seeded from the provider on the first sync and operator-owned after
 * that. What did not exist was a vocabulary, so the harm is the one this codebase keeps
 * finding - free text used as a grouping key, where "Racing", "racing" and "race" become
 * three rows that each look complete with no error and totals that still add up.
 *
 * So almost every assertion here is about a DISTINCTION rather than a feature:
 *
 *   a known slug versus one the vocabulary does not carry  (shown, never remapped)
 *   an absent genre versus an empty one                    (nothing, never a placeholder)
 *   the stored slug versus the displayed label             (key versus copy)
 *   normalising versus refusing                            (see `game-content-fields.ts`)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  GAME_CATEGORIES,
  CATEGORY_SLUG_MAX_LENGTH,
  isKnownCategorySlug,
  normaliseCategorySlug,
  resolveGameCategory,
} from "@/lib/services/games/game-categories";
import {
  validateGameContent,
  CONTENT_LIMITS,
  EDITABLE_CONTENT_FIELDS,
} from "../../apps/admin/lib/admin/game-content-fields";

const ROOT = join(__dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** Strip comments, so a file that EXPLAINS an anti-pattern is not flagged for discussing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the vocabulary itself", () => {
  it("carries every genre task 9 names, so the picker is not a tiny permanent list", () => {
    const slugs = new Set(GAME_CATEGORIES.map((entry) => entry.slug));
    for (const asked of [
      "racing",
      "puzzle",
      "arcade",
      "strategy",
      "sports",
      "shooter",
      "survival",
      "card",
      "board",
      "trivia",
      "reflex",
      "circuit",
      "other",
    ]) {
      expect(slugs.has(asked)).toBe(true);
    }
  });

  it("carries the genres the live and mock catalogues already declare", () => {
    // `circuit-sprint` and `circuit-perfect` declare `puzzle`; the mock adapter declares
    // `reflex`. Both must be KNOWN, or the two titles that exist render as unrecognised on
    // every screen the moment this ships - which would read as a bug in the vocabulary.
    expect(isKnownCategorySlug("puzzle")).toBe(true);
    expect(isKnownCategorySlug("reflex")).toBe(true);
  });

  it("every slug is already normalised, so a picked value never changes on save", () => {
    // A vocabulary entry that does not survive its own normaliser would mean choosing it
    // from the dropdown stored something else - and the stored value is a grouping key.
    for (const entry of GAME_CATEGORIES) {
      expect(normaliseCategorySlug(entry.slug)).toBe(entry.slug);
      expect(entry.slug.length).toBeLessThanOrEqual(CATEGORY_SLUG_MAX_LENGTH);
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = GAME_CATEGORIES.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("is NOT declared as a Mongoose enum on either model copy", () => {
    // The load-bearing refusal of this slice. A missing enum value REJECTS THE WHOLE WRITE,
    // so putting the vocabulary on the schema means a provider shipping a title in a genre
    // we have not thought of costs us that entire catalogue row - silently, on a scheduled
    // sync, with the row simply absent afterwards.
    for (const path of [
      "database/models/games/provider-game.model.ts",
      "apps/admin/database/models/games/provider-game.model.ts",
    ]) {
      const source = stripComments(read(path));
      const at = source.indexOf("category:");
      expect(at).toBeGreaterThan(-1);
      const declaration = source.slice(at, at + 120);
      expect(declaration).not.toContain("enum");
    }
  });
});

describe("resolveGameCategory - display", () => {
  it("gives a known slug its label, not the slug", () => {
    expect(resolveGameCategory("puzzle")).toEqual({
      slug: "puzzle",
      label: "Puzzle",
      isKnown: true,
    });
  });

  it("SHOWS an unrecognised slug rather than dropping or remapping it", () => {
    // The mock catalogue's `quiz` is the live example. Conceptually it is `trivia`, and
    // mapping it would be a silent rewrite of a provider's own statement about their game -
    // while dropping it would hide a real grouping key with real titles filed under it. Same
    // reasoning as the analytics label chain ending at the game code and NEVER at "Unknown".
    expect(resolveGameCategory("quiz")).toEqual({
      slug: "quiz",
      label: "Quiz",
      isKnown: false,
    });
  });

  it("humanises a hyphenated custom slug", () => {
    expect(resolveGameCategory("sci-fi")?.label).toBe("Sci Fi");
  });

  it("answers undefined for absent, empty and whitespace, never a placeholder", () => {
    // Three shapes, one answer. An empty string is what a pre-`$unset` document can hold,
    // and every consumer of this treats a present value as something to render - so a
    // placeholder here puts a badge on a player's screen for a decision nobody took.
    expect(resolveGameCategory(undefined)).toBeUndefined();
    expect(resolveGameCategory(null)).toBeUndefined();
    expect(resolveGameCategory("")).toBeUndefined();
    expect(resolveGameCategory("   ")).toBeUndefined();
  });

  it("cannot be steered onto the prototype chain by a stored value", () => {
    // A `Map`, never `BY_SLUG[stored]`. Object indexing returns `Object.prototype` for
    // "__proto__" - truthy, survives a `!found` test, and fails later somewhere unrelated.
    // Fourth instance after the round-inspector action map, the contest-edit field list and
    // the unscored-policy copy.
    expect(resolveGameCategory("__proto__")?.isKnown).toBe(false);
    expect(resolveGameCategory("constructor")?.isKnown).toBe(false);
    expect(resolveGameCategory("toString")?.isKnown).toBe(false);
    // And it comes back verbatim rather than as something plausible. None of the three can be
    // stored through the dialog - the normaliser strips the underscores - so reaching one of
    // them means somebody wrote it straight into the database, and a screen that renders it
    // as `Proto` would hide that.
    expect(resolveGameCategory("__proto__")?.label).toBe("__proto__");
  });
});

describe("normaliseCategorySlug - what an operator typed", () => {
  it("lower-cases and hyphenates, so one genre is one key however it is typed", () => {
    expect(normaliseCategorySlug("Racing")).toBe("racing");
    expect(normaliseCategorySlug("  RACING  ")).toBe("racing");
    expect(normaliseCategorySlug("Sci Fi")).toBe("sci-fi");
  });

  it("collapses a RUN of separators into one hyphen", () => {
    // Single-character replacement yields `sci---fi`, which is a different grouping key from
    // `sci-fi` - so two operators typing the same genre file their titles in two buckets.
    expect(normaliseCategorySlug("sci - fi")).toBe("sci-fi");
    expect(normaliseCategorySlug("beat/em up")).toBe("beat-em-up");
  });

  it("never returns a slug with a leading or trailing hyphen", () => {
    expect(normaliseCategorySlug("-racing-")).toBe("racing");
    expect(normaliseCategorySlug("!racing!")).toBe("racing");
  });

  it("re-strips after truncating, because the cut can land on a separator", () => {
    // THE FIXTURE IS THE WHOLE TEST, and the first version of it proved nothing. `slice(0, 40)`
    // keeps indices 0..39, so a hyphen at index 40 is dropped by the cut itself and the second
    // strip has nothing to do - the probe removing that strip stayed green. The hyphen has to
    // be the LAST character kept, at index 39.
    const typed = "a".repeat(CATEGORY_SLUG_MAX_LENGTH - 1) + "-tail";
    const slug = normaliseCategorySlug(typed);
    expect(slug).toBe("a".repeat(CATEGORY_SLUG_MAX_LENGTH - 1));
    expect(slug!.endsWith("-")).toBe(false);
    expect(slug!.length).toBeLessThanOrEqual(CATEGORY_SLUG_MAX_LENGTH);
  });

  it("truncates a long single word to the limit exactly", () => {
    const slug = normaliseCategorySlug("x".repeat(200));
    expect(slug!.length).toBe(CATEGORY_SLUG_MAX_LENGTH);
  });

  it("answers null when nothing is left, never an empty slug", () => {
    // A stored "" reads as ABSENT to the badge and as PRESENT to a `has` check, which is a
    // value that is simultaneously there and not there.
    expect(normaliseCategorySlug("")).toBeNull();
    expect(normaliseCategorySlug("   ")).toBeNull();
    expect(normaliseCategorySlug("!!!")).toBeNull();
    expect(normaliseCategorySlug("---")).toBeNull();
  });

  it("is idempotent, so re-saving an unchanged title cannot drift the key", () => {
    for (const typed of ["Racing", "Sci Fi", "beat/em up", "x".repeat(200)]) {
      const once = normaliseCategorySlug(typed)!;
      expect(normaliseCategorySlug(once)).toBe(once);
    }
  });
});

describe("the content validator", () => {
  it("still treats category as an editable content field", () => {
    expect(EDITABLE_CONTENT_FIELDS.has("category")).toBe(true);
  });

  it("takes its length limit FROM the vocabulary module, not a second literal", () => {
    // Two numbers would let the normaliser return a slug the validator on the next line
    // refuses - a form that reports success and then fails with a 400 the operator reads as
    // a permissions problem.
    expect(CONTENT_LIMITS.category).toBe(CATEGORY_SLUG_MAX_LENGTH);
  });

  it("NORMALISES what it is sent rather than storing it as typed", () => {
    const result = validateGameContent({ category: "Sci Fi" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content.category).toBe("sci-fi");
  });

  it("passes a picked vocabulary slug through untouched", () => {
    const result = validateGameContent({ category: "puzzle" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content.category).toBe("puzzle");
  });

  it("ACCEPTS an unrecognised genre rather than refusing it", () => {
    // The deliberate opposite of the unknown-FIELD rule beside it, and the reasoning is what
    // matters: the dialog submits every field in one request, so refusing an unrecognised
    // genre would mean a title stored as free text before this existed could never have its
    // description fixed. Refusal there tells an operator their edit did not happen; refusal
    // here blocks an edit that has nothing to do with the genre.
    const result = validateGameContent({ category: "rhythm", description: "New copy." });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content.category).toBe("rhythm");
      expect(result.content.description).toBe("New copy.");
    }
  });

  it("an empty box clears the genre", () => {
    const result = validateGameContent({ category: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content.category).toBe("");
  });

  it("a value with nothing groupable in it clears rather than storing punctuation", () => {
    const result = validateGameContent({ category: "!!!" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content.category).toBe("");
  });

  it("refuses a non-string and an over-long value", () => {
    expect(validateGameContent({ category: 7 }).ok).toBe(false);
    expect(validateGameContent({ category: "x".repeat(200) }).ok).toBe(false);
  });
});

describe("the consumers read the LABEL, never the stored slug", () => {
  it("game-presentation.service.ts resolves it and does not pass it through", () => {
    const source = stripComments(read("lib/services/games/game-presentation.service.ts"));

    // The label, explicitly. This is what the arena badge renders, so the raw form puts
    // `sci-fi` in front of a paying player.
    expect(source).toContain("resolveGameCategory(title.category)?.label");

    // AND `title.category` appears exactly ONCE, inside that call. Counting is what makes the
    // negative half work: a `not.toMatch(/category:\s*title\.category/)` was satisfied by
    // `resolveGameCategory(title.category) ? title.category : undefined`, which calls the
    // resolver, discards its answer and ships the slug - a probe proved it green. Third
    // instance of one identifier appearing twice defeating a structural test.
    const mentions = source.match(/title\.category/g) ?? [];
    expect(mentions).toHaveLength(1);
  });

  it("the AI vocabulary composes the prompt from the label", () => {
    const source = stripComments(read("apps/admin/lib/admin/ai-contest-vocabulary.ts"));
    expect(source).toContain("resolveGameCategory(title.category)");
    // A model handed "Circuit Sprint (sci-fi)" is being shown our database rather than being
    // told what the game is.
    expect(source).not.toMatch(/\$\{title\.category/);
  });

  it("listContestableTitles hands the wizard the resolved label", () => {
    const source = stripComments(
      read("apps/admin/lib/services/game-providers/provider-contest.service.ts"),
    );
    expect(source).toContain("resolveGameCategory(title.category)");
  });

  it("the wizard picker does NOT re-derive the label", () => {
    // Same rule as `playMode` on this screen: it is handed the resolved answer. A screen that
    // re-derives is a second copy of the vocabulary, and the two spellings of one genre then
    // depend on which screen you are looking at.
    const source = stripComments(
      read("apps/admin/components/admin/games/wizard/StepChooseGame.tsx"),
    );
    expect(source).toContain("title.category");
    expect(source).not.toContain("resolveGameCategory");
    expect(source).not.toContain("GAME_CATEGORIES");
  });
});

describe("the genre picker is drawn by the app, not by the browser", () => {
  const DIALOG = "apps/admin/components/admin/games/GameContentDialog.tsx";

  it("uses the shared Select, never a native <select>", () => {
    const source = stripComments(read(DIALOG));

    // A DEFECT TEST, NOT A STYLE TEST, and the mechanism is the reason it is scoped to this
    // surface. A browser paints the native drop-down list itself: the list background comes
    // from the element's own `background-color`, while the options inherit `color`. Every
    // field on this surface is themed `bg-white/5 text-white`, and a translucent white
    // composites over the browser's light list surface - so all fifteen options rendered
    // white on white. Only the highlighted row was legible, against the operating system's
    // selection band, which is exactly what was reported: a tall empty list with one word in
    // it. Nothing was missing and nothing failed to render, which is why it reads as a data
    // fault rather than a CSS one.
    //
    // The primitive draws its own list in a portal and never asks the browser for one, so it
    // cannot take a background from one place and a foreground from another.
    expect(source.length).toBeGreaterThan(200);
    expect(source).not.toMatch(/<select[\s>]/);
    expect(source).toContain("<SelectTrigger");
  });

  it("and no other picker on this surface has one either", () => {
    // READS THE DIRECTORY rather than naming files, so it is not green on the day a twelfth
    // picker is added. Every field here inherits the same translucent theme, so a native
    // `<select>` anywhere on this surface reproduces the defect.
    //
    // DELIBERATELY SCOPED TO THIS FOLDER and not platform-wide. The reproducing condition is
    // a native select AND a translucent background AND a light foreground; the ~24 native
    // selects elsewhere in the admin app sit on an opaque `bg-gray-*` and mostly set no
    // colour at all, so they are correct. A platform-wide ban would fire on two dozen
    // working files and be deleted by the first person it inconvenienced - the reasoning that
    // narrowed the `GameIcon` ban in `13` s4.1g.
    const dir = join(ROOT, "apps/admin/components/admin/games");
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((name) =>
      name.endsWith(".tsx"),
    );
    expect(files.length).toBeGreaterThan(10);

    const offenders = files.filter((name) =>
      /<select[\s>]/.test(stripComments(readFileSync(join(dir, name), "utf8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("generates the options from the vocabulary rather than listing them", () => {
    const source = stripComments(read(DIALOG));

    // So adding a genre reaches the picker with no second edit. A typed-out list is the
    // "one rule, two copies" shape, and the copy that drifts is the one an operator reads.
    expect(source).toMatch(/GAME_CATEGORIES\.map/);
    for (const entry of GAME_CATEGORIES) {
      expect(source).not.toContain(`"${entry.slug}"`);
    }
  });

  it("its sentinels are non-empty and unreachable from the slug namespace", () => {
    const source = stripComments(read(DIALOG));

    const sentinels = [...source.matchAll(/const (?:NO_GENRE|CUSTOM) = "([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(sentinels).toHaveLength(2);

    for (const sentinel of sentinels) {
      // Non-empty, because Radix reserves `""` for "nothing is selected" and THROWS on an
      // item carrying it - so the native `<option value="">` could not be ported across as
      // it stood, and "no genre" has to travel as a sentinel mapped back at the boundary.
      expect(sentinel).not.toBe("");

      // And it must be a value no operator can produce. Behavioural rather than a check on
      // the spelling: a sentinel of "none" or "custom" is a genre somebody can legitimately
      // type, and they would then find their own word clearing the field or opening the
      // custom box. Normalising strips every non-alphanumeric run, so the double underscores
      // are what put these outside the namespace - and this is what fails if anybody tidies
      // them away.
      expect(normaliseCategorySlug(sentinel)).not.toBe(sentinel);
    }
  });
});

describe("the mirror", () => {
  it("both copies of the vocabulary are byte-identical", () => {
    // `check:mirrors` compares MODELS, so it has no opinion about this file - and the drift
    // it would miss is the worst available: one app's known slug is the other's unknown one,
    // so the admin offers a genre the player app renders as if it were a typo.
    const main = read("lib/services/games/game-categories.ts");
    const admin = read("apps/admin/lib/services/games/game-categories.ts");
    expect(admin).toBe(main);
  });
});
