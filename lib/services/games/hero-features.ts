/**
 * The four small claims across the middle of a game's hero banner, and who writes them.
 *
 * WHERE THIS CAME FROM. The owner's instruction of 11 September 2026: *"the info and icons of
 * the banner must be able to change them from the games edit content in admin like the
 * others"*. Before this the four were entirely derived - read from declared fields on the
 * catalogue row - which is correct and is also the one thing an operator could not adjust,
 * on the one strip a paying player reads before deciding to enter.
 *
 * AUTHORED OVERRIDES DERIVED, AND ABSENT MEANS DERIVED. That ordering is the whole design and
 * the alternative is worse in a way that is hard to see: if an unset field meant "no
 * features", then every title in the catalogue would lose four facts the moment this shipped,
 * silently, because nobody has written any yet. So an empty list is a MISSING VALUE rather
 * than an empty set - the `resolveAllowedGameTypes` reading, and the opposite of
 * `entryBlockThreshold`'s - and the content dialog says so beside the field, because the
 * empty state is the normal one and an operator needs to know what it produces.
 *
 * THE ICON IS A SLUG FROM A VOCABULARY, NEVER A COMPONENT OR A CLASS NAME. The arena maps it
 * to a glyph. Two rules follow and both are load-bearing:
 *
 *   * A slug the vocabulary does not carry is drawn with a NEUTRAL MARK and its label is
 *     rendered unchanged. Never dropped, and never remapped to the nearest known glyph - the
 *     label is the operator's statement and the icon is decoration beside it, so losing the
 *     row to save the picture is the wrong way round. Same rule as an unrecognised genre.
 *   * No slug here may be a game-shaped noun. `__tests__/games/arena-game-agnostic.test.ts`
 *     bans nine of them inside quoted strings anywhere in the arena, and these slugs are
 *     quoted strings in `arena-facts.ts` - so `board`, `level`, `lap`, `tile` and the rest
 *     would turn that guard red, correctly: a glyph named after one game's furniture is the
 *     first step towards a hero that knows which game it is describing.
 *
 * MODEL-FREE BY REQUIREMENT, not preference. The content dialog is `"use client"`, so a
 * module reaching a Mongoose model cannot be imported by it (R58) and the vocabulary would
 * have to be written twice - the "one rule, two copies" shape behind `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `||`.
 *
 * MIRRORED into `apps/admin/lib/services/games/`, and `check:mirrors` compares MODELS, so it
 * has no opinion about this file. The guarantee is a byte-for-byte test, and it is
 * load-bearing rather than tidiness: the two copies disagreeing means a glyph the admin
 * offers is one the player's banner cannot draw, which renders as a blank space beside a
 * label on the screen a player is deciding to pay on.
 */

/** A glyph an operator may choose. The arena owns which picture each one draws. */
export type HeroFeatureIcon =
  | "speed"
  | "players"
  | "skill"
  | "ranking"
  | "reward"
  | "clock"
  | "target"
  | "spark";

export interface HeroFeatureIconOption {
  slug: HeroFeatureIcon;
  /** What an operator reads in the picker. Never stored. */
  label: string;
}

/**
 * The vocabulary, in the order a picker should offer it.
 *
 * ADD-ONLY IN SPIRIT, for the same reason as the genre slugs and `ADMIN_SECTIONS`: a slug
 * that has been stored is what a row on a live banner is drawn from, so removing one turns
 * every title using it into a neutral mark. Adding is a one-line change here plus one in the
 * arena's glyph map, and a test asserts the map covers every entry - a vocabulary offering a
 * slug the arena cannot draw is a control that appears to work and does nothing.
 *
 * `reward` is here even though the platform refuses to DERIVE a rewards claim, and the
 * distinction is worth stating because it looks like an inconsistency. The hero receives no
 * prize figure, so the platform asserting "big rewards" on its own would be a promise it
 * cannot check and a free contest would carry it too. An operator typing their own marketing
 * line is a person making a claim about their own contest, with a name and a timestamp
 * against it. The refusal was never about the words.
 */
export const HERO_FEATURE_ICONS: readonly HeroFeatureIconOption[] = [
  { slug: "speed", label: "Lightning - speed" },
  { slug: "clock", label: "Timer - duration" },
  { slug: "players", label: "People - players" },
  { slug: "skill", label: "Shield - fairness" },
  { slug: "ranking", label: "Globe - leaderboard" },
  { slug: "reward", label: "Trophy - rewards" },
  { slug: "target", label: "Target - precision" },
  { slug: "spark", label: "Sparkle - anything else" },
];

/** How many rows the banner draws, and therefore how many may be stored. */
export const HERO_FEATURE_LIMIT = 4;

/** Two short lines in an 88px column. Longer than this is clipped rather than wrapped. */
export const HERO_FEATURE_LABEL_MAX_LENGTH = 24;

/**
 * The glyph an operator chose, or `undefined` if they chose nothing this module knows.
 *
 * `undefined` is deliberately NOT an error and deliberately not a substitution. The caller
 * draws its neutral mark and renders the label as written, so a title carrying a slug from a
 * future version of this list - or from a hand-edited document - keeps its words.
 */
export function resolveHeroFeatureIcon(
  slug: string | undefined,
): HeroFeatureIcon | undefined {
  if (!slug) return undefined;
  const found = HERO_FEATURE_ICONS.find((option) => option.slug === slug.trim());
  return found?.slug;
}

/** Is this a slug the picker offers? Used by the validator, which refuses anything else. */
export function isHeroFeatureIcon(slug: unknown): slug is HeroFeatureIcon {
  return typeof slug === "string" && resolveHeroFeatureIcon(slug) !== undefined;
}
