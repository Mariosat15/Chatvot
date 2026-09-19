/**
 * What KIND of game a title is - the controlled vocabulary behind `provider_game.category`
 * (task document 9).
 *
 * THE FIELD ALREADY EXISTED. This module does not add one; it gives the existing one a
 * vocabulary. Before this, `category` was free text with a 40-character limit, seeded from
 * the provider on the first sync and operator-owned thereafter, edited as a plain text box
 * and rendered raw in two places. That is a specific and familiar hazard rather than an
 * untidiness: `category` is the natural grouping key for discovery, for the Game Performance
 * screen and for analytics, and as free text "Racing", "racing" and "race" become three rows
 * that each look complete. No error, no log line, and the totals still add up. It is the same
 * failure as grouping revenue by a display name instead of `gameKey`, one field along.
 *
 * MODEL-FREE BY REQUIREMENT, not preference. Both the content dialog and the catalogue list
 * are `"use client"`, so a module reaching a Mongoose model cannot be imported by them and
 * the vocabulary would have to be written twice - the "one rule, two copies" shape behind
 * `referenceId`, `failedReason`, `challengeId` and the Game Master `||`. The drift it would
 * cause here is not cosmetic: the admin offering a slug the player app does not know renders
 * a badge that reads like a typo on the one screen a paying player is looking at.
 *
 * MIRRORED into `apps/admin/lib/services/games/`, and `check:mirrors` compares MODELS, so it
 * has no opinion about this file. The guarantee is a byte-for-byte test - and it is
 * load-bearing rather than tidiness for the reason above: the two copies disagreeing means
 * one app's known slug is the other's unknown one.
 *
 * WHAT THIS DELIBERATELY IS NOT: a `game_category` collection. Task 9 offers that as its
 * first preference and the second option is the right one here. Thirteen rows nobody
 * administers is a screen, a route, a model pair and an RBAC decision bought for nothing -
 * and worse, a deletable category is a deletable grouping key, so removing a row orphans
 * every title and every historical figure joined to it. That is the reasoning that gives
 * providers a disable switch and no delete, and that retires a disabled game's rows rather
 * than deleting them (R29). A slug in code cannot be deleted by an operator at 2am.
 */

export interface GameCategory {
  /** Stored on the title. Lowercase, hyphenated, and a grouping key for ever. */
  slug: string;
  /** What an operator and a player read. Never stored - always derived from the slug. */
  label: string;
}

/**
 * The predefined vocabulary.
 *
 * ADD-ONLY IN SPIRIT, for the same reason `ADMIN_SECTIONS` and `gameKey` are: a slug that has
 * been stored is the join key for whatever was grouped by it, so removing one leaves rows
 * pointing at a word nothing can resolve. Adding is a one-line change; removing is a
 * migration.
 *
 * NOT A MONGOOSE ENUM, and that is a deliberate refusal rather than an omission. A missing
 * enum value REJECTS THE WHOLE WRITE - the lesson from the model-mirror work - so declaring
 * this list on the schema would mean a provider shipping a title in a genre we have not
 * thought of costs us that entire catalogue row, silently, on a scheduled sync. The
 * vocabulary is what we OFFER; an unrecognised stored value is displayed, never refused and
 * never remapped. See `resolveGameCategory`.
 *
 * The list is task 9's own, plus `circuit` and `reflex`, which the live and mock catalogues
 * already declare. Ordered for a human reading a dropdown - the common shapes first, with
 * `other` last - rather than alphabetically, because a picker sorted alphabetically buries
 * the two or three genres an operator actually uses.
 */
export const GAME_CATEGORIES: readonly GameCategory[] = [
  { slug: "racing", label: "Racing" },
  { slug: "circuit", label: "Circuit" },
  { slug: "puzzle", label: "Puzzle" },
  { slug: "arcade", label: "Arcade" },
  { slug: "reflex", label: "Reflex" },
  { slug: "strategy", label: "Strategy" },
  { slug: "sports", label: "Sports" },
  { slug: "shooter", label: "Shooter" },
  { slug: "survival", label: "Survival" },
  { slug: "card", label: "Card" },
  { slug: "board", label: "Board" },
  { slug: "trivia", label: "Trivia" },
  { slug: "other", label: "Other" },
];

/**
 * A `Map`, never an object.
 *
 * The key comes from a stored document, and object indexing walks the prototype chain: a
 * title whose category is `"constructor"` returns something truthy that survives a `!found`
 * test and fails later somewhere unrelated. Fourth instance of that trap after the
 * round-inspector action map, the contest-edit field list and the unscored-policy copy.
 */
const BY_SLUG: ReadonlyMap<string, GameCategory> = new Map(
  GAME_CATEGORIES.map((entry) => [entry.slug, entry]),
);

/**
 * Matches `CONTENT_LIMITS.category`, which is what the server enforces.
 *
 * Declared here as well because this module normalises and must not be able to return a
 * value the validator then refuses - a form that reports success and fails with a 400 the
 * operator reads as a permissions problem. A test pins the two together.
 */
export const CATEGORY_SLUG_MAX_LENGTH = 40;

export function isKnownCategorySlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/**
 * Turn anything an operator typed into a value that can be grouped on.
 *
 * NORMALISES RATHER THAN REFUSING, which is the opposite of this codebase's usual rule that
 * an unknown field is refused with its name. The difference is what the two are protecting.
 * There, refusing tells an operator their edit did not happen; here, refusing a legacy
 * free-text `category` would block an unrelated edit to a tagline, because the content dialog
 * submits every field together - so a title stored as "Racing game" before this existed could
 * never have its description fixed. Normalising accepts it as `racing-game`, and the form
 * shows the operator the slug before they save, so nothing is rewritten behind their back.
 *
 * Returns `null` only when there is nothing left, which the caller must treat as "clear the
 * field" and never as an empty category: a stored `""` reads as absent to the badge and as
 * present to a `has` check, which is a value that is simultaneously there and not.
 */
export function normaliseCategorySlug(input: string): string | null {
  const slug = input
    .trim()
    .toLowerCase()
    // Every run of anything that is not a letter or a digit becomes ONE hyphen. Runs rather
    // than single characters, or "sci - fi" yields `sci---fi`.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug === "") return null;

  // Truncate, THEN strip a trailing hyphen again. Cutting at 40 can land exactly on a
  // separator - "a-very-long-genre-name-that-keeps-going-on" - and a slug ending in a hyphen
  // is a different grouping key from the same slug without one, so two operators typing the
  // same long genre would file their titles in two buckets.
  const clipped = slug.slice(0, CATEGORY_SLUG_MAX_LENGTH).replace(/-+$/g, "");

  // The second `=== ""` COVERS THE FIRST rather than catching a case of its own, and neither
  // can be probed alone - removing either leaves the other answering `null` for every empty
  // input, so the probe has to inject both in one edit. Worth stating rather than calling one
  // of them dead: given the strip above, `slug` starts with an alphanumeric and `clipped`
  // always keeps it, so this check only ever fires as the fallback for an input the first
  // check would have taken - which is exactly why it must stay if that one ever moves.
  return clipped === "" ? null : clipped;
}

export interface ResolvedGameCategory {
  slug: string;
  label: string;
  /** `false` for a value the vocabulary does not carry. It is still shown. */
  isKnown: boolean;
}

/**
 * What to display for a stored value.
 *
 * AN UNRECOGNISED VALUE IS DISPLAYED, NOT DROPPED AND NOT REMAPPED. The mock catalogue's
 * `quiz` is the live example - conceptually it is `trivia`, and mapping it would be a silent
 * rewrite of a provider's own statement about their game. It renders as "Quiz" and stays the
 * grouping key it already was, which is the same reason the analytics label chain ends at the
 * game code and then the key and NEVER at "Unknown": a row captioned "Unknown" holding real
 * data cannot be investigated.
 *
 * `undefined` for an absent or empty value, deliberately, rather than a placeholder category.
 * A title with no genre must render nothing - every consumer already guards on the field
 * being present - and inventing "Uncategorised" here would put a badge on the player's screen
 * for a decision no operator took.
 */
export function resolveGameCategory(
  stored: string | undefined | null,
): ResolvedGameCategory | undefined {
  if (typeof stored !== "string") return undefined;
  const slug = stored.trim();
  if (slug === "") return undefined;

  const known = BY_SLUG.get(slug);
  if (known) return { slug: known.slug, label: known.label, isKnown: true };

  return { slug, label: humaniseSlug(slug), isKnown: false };
}

/**
 * `racing-game` -> `Racing Game`, `quiz` -> `Quiz`.
 *
 * Only ever reached for a value the vocabulary does not carry, so it is a best effort at
 * reading well rather than a translation. It must not lower-case the rest of a word: an
 * acronym a provider chose (`rpg`) is theirs, and `Rpg` is already a compromise.
 */
function humaniseSlug(slug: string): string {
  return slug
    .split("-")
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
