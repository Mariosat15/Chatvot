/**
 * What an operator may write on a catalogue title, and what a valid value looks like.
 *
 * MODEL-FREE BY REQUIREMENT, not by preference. The editor dialog is `"use client"`, so a
 * module that reaches a Mongoose model cannot be imported by it and the rules would have to
 * be written twice - once for the server to enforce and once for the form to check. That is
 * the "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and
 * the Game Master `||`, none of which `check:mirrors` can see, and the drift it causes here
 * is not cosmetic: a form offering a 200-character tagline the server refuses fails with a
 * 400 that reads to the operator like a permissions problem.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only; the player app reads this content and
 * never writes it, so there is no second copy for `check:mirrors` to have an opinion about.
 * The one exception it IMPORTS is the category vocabulary, which both apps need - see
 * `lib/services/games/game-categories.ts`.
 */

import { normaliseCategorySlug, CATEGORY_SLUG_MAX_LENGTH } from "@/lib/services/games/game-categories";
import {
  HERO_FEATURE_LABEL_MAX_LENGTH,
  HERO_FEATURE_LIMIT,
  isHeroFeatureIcon,
} from "@/lib/services/games/hero-features";

/** Fields an operator owns. A value outside this set is REFUSED, never ignored - see below. */
export const EDITABLE_CONTENT_FIELDS: ReadonlySet<string> = new Set([
  "displayName",
  "tagline",
  "description",
  // Seeded from the provider on the first sync and the operator's thereafter, exactly like
  // `description` beside them. Editable rather than read-only because a provider's grammar,
  // tone and language are all things an operator legitimately has to fix - and because the
  // sync will not overwrite the correction (`firstSyncOnlyFields`). See R63.
  "rulesSummary",
  "howToPlay",
  "category",
  "thumbnailUrl",
  "bannerUrl",
  "highlights",
  // The arena's two illustrations (owner, 11 September 2026). Ours rather than the
  // provider's - they illustrate OUR panels - so unlike the six above they are seeded by no
  // sync and are only ever written here.
  "howToPlayImageUrl",
  "highlightsImageUrl",
  // The hero banner's four small claims (owner, 11 September 2026). Ours too, and the only
  // content field where LEAVING IT EMPTY IS A DIFFERENT INSTRUCTION from filling it in: the
  // banner works four out from the title's declared settings when nothing is stored, so an
  // empty list restores those rather than emptying the strip. See `hero-features.ts`.
  "heroFeatures",
]);

/**
 * Fields that must never be written through this door, listed so the refusal can say WHY.
 *
 * `chartvoltEnabled` is the one worth explaining. It is operator-owned, so it looks like it
 * belongs above - but it is the switch that puts a title in front of paying players, it has
 * its own control and its own audit line, and `setProviderEnabled` refuses to raise it while
 * the provider has no adapter or no callback secret. Accepting it here would let an operator
 * go live as a side effect of fixing a typo in a tagline, with the audit trail recording a
 * content edit. The capability and scoring fields are the provider's and are re-written by
 * every catalogue sync, so an edit to them would be reverted without explanation.
 */
export const NEVER_EDITABLE_CONTENT_FIELDS: ReadonlyMap<string, string> = new Map([
  ["gameKey", "the join key for every historical stat, and immutable"],
  ["providerKey", "part of the immutable identity of the title"],
  ["gameCode", "part of the immutable identity of the title"],
  ["chartvoltEnabled", "changed with the Live on ChartVolt switch, which has its own checks"],
  ["providerStatus", "the provider's own status, rewritten by every catalogue sync"],
  ["family", "declared by the provider and rewritten by every catalogue sync"],
  ["playMode", "declared by the provider and rewritten by every catalogue sync"],
  // Ours, like `chartvoltEnabled` above it, and barred here for the same reason: it has its
  // own control and its own audit line, and it decides when entry closes and how many
  // attempts a player gets. Accepting it here would let an operator turn a puzzle into a
  // gun-start race as a side effect of fixing a typo in a tagline, with the audit trail
  // recording a content edit.
  ["playModeOverride", "changed with the Play style control, which has its own audit line"],
  // Ours, and barred for the same reason as `playModeOverride` beside it. This one decides
  // which shapes an operator may pick when they create a contest on the title (task document
  // 11), so writing it here would widen what a future contest may be run as from a screen
  // labelled "title and description".
  ["supportedPlayModes", "changed with the Play style control, which has its own audit line"],
  ["scoreDirection", "declared by the provider and rewritten by every catalogue sync"],
  ["scoreType", "declared by the provider and rewritten by every catalogue sync"],
  // Ours, like `chartvoltEnabled` and `playModeOverride` above, and barred for the same
  // reason rather than because a sync would revert them: these two decide WHO IS PAID out of
  // a pot people have bought into. Accepting them here would let a prize rule change as a
  // side effect of fixing a typo in a tagline, with the audit trail recording a content edit.
  //
  // `scoreUnit` is display-only and would be harmless here - it is barred anyway so that the
  // three fields of one screen cannot be written through two different doors with two
  // different audit lines, which is how an operator ends up unable to answer "when did this
  // change and who did it".
  ["zeroIsValidResult", "changed with the Prize eligibility control, which has its own audit line"],
  ["minimumEligibleScore", "changed with the Prize eligibility control, which has its own audit line"],
  ["scoreUnit", "changed with the Prize eligibility control, which has its own audit line"],
  ["configSchema", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsCompetition", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsOneVsOne", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsContentSeed", "declared by the provider and rewritten by every catalogue sync"],
]);

/**
 * What the content assistant may write, and what it may never write.
 *
 * TWO LISTS RATHER THAN ONE, for the same reason `NEVER_EDITABLE_CONTENT_FIELDS` sits beside
 * `EDITABLE_CONTENT_FIELDS` above: a field merely absent from an allow-list is admitted the
 * moment somebody widens that list for an unrelated reason, and the refusal cannot say why.
 * A named bar with a reason is the thing that survives the next person's edit.
 *
 * THE BAR ON `rulesSummary` AND `howToPlay` IS AN OWNER DECISION, 10 September 2026, and it
 * is not a matter of taste. `01` s3.1 requires both of a provider and calls the rules summary
 * the first text support quotes back when a player disputes a prize - so generated wording
 * there is invented wording in a money argument, about a game the model has never seen, and
 * an operator reviewing it has no way to know whether it is true. Both are already seeded
 * from the provider (R63) and both are already editable by hand on the same screen, so there
 * is nothing the assistant would add except the risk.
 *
 * `category`, `thumbnailUrl` and `bannerUrl` are barred as well and for a duller reason: a
 * genre is a grouping key chosen from a vocabulary, and an image address is not prose.
 */
export const AI_WRITABLE_CONTENT_FIELDS = [
  "displayName",
  "tagline",
  "description",
  "highlights",
] as const;

export const AI_NEVER_WRITABLE_CONTENT_FIELDS: ReadonlyMap<string, string> = new Map([
  ["rulesSummary", "the provider's account of how their game scores, and the text support quotes back in a prize dispute"],
  ["howToPlay", "the provider's account of how their game is played, which the assistant has no way to know"],
  ["category", "chosen from the genre vocabulary, because it is a grouping key rather than prose"],
  ["thumbnailUrl", "an image address, not prose"],
  ["bannerUrl", "an image address, not prose"],
  ["howToPlayImageUrl", "an image address, not prose"],
  ["highlightsImageUrl", "an image address, not prose"],
  // Barred for a reason worth spelling out, because these ARE short marketing lines and so
  // look like the assistant's natural territory. Each one occupies a FACT POSITION on the
  // hero: the slot the assistant would write into is the slot the platform otherwise fills
  // from the round ceiling, the declared family and the contest's own player range. A model
  // filling it writes "3 minute rounds" on a title whose ceiling is ten, in the strip a
  // player reads immediately before paying, and it is right about the genre and wrong about
  // the number - which is the hardest kind of wrong to notice. An operator typing it is
  // making their own claim with their own name against it.
  ["heroFeatures", "the banner's statements of fact about the contest, which a model cannot check"],
]);

export const CONTENT_LIMITS = {
  displayName: 80,
  tagline: 120,
  description: 2000,
  rulesSummary: 2000,
  howToPlay: 2000,
  // Reason: imported rather than repeated. The normaliser truncates to this, so two numbers
  // would let it return a slug the validator on the next line refuses - a form that reports
  // success and then fails with a 400 the operator reads as a permissions problem.
  category: CATEGORY_SLUG_MAX_LENGTH,
  url: 500,
  highlights: 6,
  highlightTitle: 40,
  highlightDetail: 140,
  // Reason: imported rather than typed, unlike `highlights` above it. The banner draws
  // exactly what is stored, so a fifth row is not "stored and not shown" - there is nowhere
  // for it to go, and a second number here would let the form offer one the banner has no
  // column for.
  heroFeatures: HERO_FEATURE_LIMIT,
  heroFeatureLabel: HERO_FEATURE_LABEL_MAX_LENGTH,
} as const;

/**
 * How many highlights the player's contest screen actually draws.
 *
 * IT IS NOT `CONTENT_LIMITS.highlights` AND THAT IS THE POINT. The arena's bottom band is a
 * fixed-height strip - the owner's reference measures 986 x 103 - so the card has room for
 * four ticked lines, while six can be stored. An operator adding a fifth would otherwise get
 * a control that appears to work and does nothing, which is a shape this programme keeps
 * finding; the hint beside the field is the only place it can be said.
 *
 * IT IS A SECOND COPY OF THE PLAYER APP'S `STRIP_TIP_LIMIT` and it cannot be anything else -
 * `apps/admin` cannot import from `components/games/`, and a number in a comment drifts
 * silently in the direction that makes the hint a lie. So `__tests__/games/arena-band.test.ts`
 * reads the literal out of both files and asserts they agree. Change one, change the other.
 */
export const ARENA_HIGHLIGHT_LIMIT = 4;

/**
 * How many numbered steps that same strip draws from `howToPlay`.
 *
 * THREE, FOR THE SAME ARITHMETIC as the four above - a 96px card, a 26px heading, 22px rows.
 * It is here rather than only in the player app for the same reason too: the hint beside the
 * field is where an operator learns that a fourth step is stored and not shown, and a number
 * typed into that sentence is a number that drifts. Pinned against `STRIP_STEP_LIMIT` in
 * `GameRulesPanel.tsx` by the same test.
 */
export const ARENA_STEP_LIMIT = 3;

export interface GameHighlight {
  title: string;
  detail: string;
}

export interface GameHeroFeature {
  /** A slug from `HERO_FEATURE_ICONS`. Refused here if it is not one. */
  icon: string;
  label: string;
}

export interface GameContentInput {
  displayName?: string;
  tagline?: string;
  description?: string;
  rulesSummary?: string;
  howToPlay?: string;
  category?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  highlights?: GameHighlight[];
  heroFeatures?: GameHeroFeature[];
}

export type ContentValidation =
  | { ok: true; content: GameContentInput }
  | { ok: false; error: string };

/**
 * Is this a URL an `<img src>` can actually load from a page served over https?
 *
 * Plain http is refused because the browser blocks it as mixed content and draws NOTHING -
 * no error an operator would see, just a logo that is missing on the live site and present
 * in the admin preview if that preview is served over http. A relative path is the normal
 * case, because that is what our own upload route returns.
 */
function isRenderableImageUrl(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function trimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/**
 * Validate a submitted content patch.
 *
 * An unknown field is REFUSED WITH ITS NAME rather than dropped. Dropping is the tidier
 * implementation and it is the one this codebase keeps having to undo: the request succeeds,
 * the screen says saved, the value is not there, and the operator concludes they misclicked.
 * The same reasoning as `competition-update-fields.ts`.
 *
 * An empty string CLEARS the field, and that is safe here in a way it is not for a secret:
 * the operator can see what is currently stored, so a blank box is a decision rather than an
 * omission. Write-only fields invert that answer - see the credentials dialog.
 */
export function validateGameContent(body: unknown): ContentValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected an object of fields to update." };
  }

  const content: GameContentInput = {};
  const raw = body as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    // A `Set`, never `ALLOWED[key]`: object indexing walks the prototype chain, so
    // "constructor" and "__proto__" both return something truthy and survive a `!allowed`
    // test before failing somewhere unrelated. Third instance of that trap after the
    // round-inspector action map and the contest-edit field list.
    if (NEVER_EDITABLE_CONTENT_FIELDS.has(key)) {
      return {
        ok: false,
        error: `"${key}" cannot be edited here: it is ${NEVER_EDITABLE_CONTENT_FIELDS.get(key)}.`,
      };
    }
    if (!EDITABLE_CONTENT_FIELDS.has(key)) {
      return { ok: false, error: `"${key}" is not an editable field of a game title.` };
    }
  }

  if ("displayName" in raw) {
    const name = trimmedString(raw.displayName);
    if (!name) return { ok: false, error: "The game's title cannot be empty." };
    if (name.length > CONTENT_LIMITS.displayName) {
      return { ok: false, error: `The title must be ${CONTENT_LIMITS.displayName} characters or fewer.` };
    }
    content.displayName = name;
  }

  // Reason: `field` below is a literal from an `as const` tuple written here, not a key
  // taken from the request, so there is no prototype chain a caller can steer these
  // accesses onto. The rule cannot see the difference between that and `raw[userInput]`,
  // and the request-derived case is already total - every key of `raw` was proved a
  // member of `EDITABLE_CONTENT_FIELDS` above, which is a `Set` for exactly that reason.
  /* eslint-disable security/detect-object-injection */
  for (const field of ["tagline", "description", "rulesSummary", "howToPlay"] as const) {
    if (!(field in raw)) continue;
    const value = trimmedString(raw[field]);
    if (value === null) return { ok: false, error: `"${field}" must be text.` };
    if (value.length > CONTENT_LIMITS[field]) {
      return { ok: false, error: `The ${field} must be ${CONTENT_LIMITS[field]} characters or fewer.` };
    }
    content[field] = value;
  }

  // `category` is handled on its own because it is the one content field with a VOCABULARY
  // (task document 9). It is normalised to a slug rather than stored as typed, so that
  // anything grouping by it - discovery, the Game Performance screen, analytics - cannot see
  // "Racing" and "racing" as two genres that each look complete.
  //
  // NORMALISED, NOT REFUSED, which is the deliberate opposite of the unknown-field rule
  // above. Refusing an unrecognised genre would block an unrelated edit, because the dialog
  // submits every field in one request: a title stored as free text before this existed could
  // never have its description fixed. The form shows the operator the slug it will store, so
  // this is a stated transformation rather than a silent rewrite.
  if ("category" in raw) {
    const typed = trimmedString(raw.category);
    if (typed === null) return { ok: false, error: `"category" must be text.` };
    if (typed.length > CONTENT_LIMITS.category) {
      return {
        ok: false,
        error: `The category must be ${CONTENT_LIMITS.category} characters or fewer.`,
      };
    }
    // An empty box CLEARS the genre, and the badge then renders nothing. `normaliseCategorySlug`
    // answers `null` both for "" and for a value with no letters or digits in it at all - "!!!"
    // is not a genre - and both mean the same thing to an operator who can see the box.
    content.category = typed === "" ? "" : (normaliseCategorySlug(typed) ?? "");
  }

  // Every image address on a title goes through the same clause, deliberately. Written as a
  // second loop for the two arena illustrations, the mixed-content refusal below would exist
  // twice and the next image field added would be the one that got a weaker check.
  for (const field of [
    "thumbnailUrl",
    "bannerUrl",
    "howToPlayImageUrl",
    "highlightsImageUrl",
  ] as const) {
    if (!(field in raw)) continue;
    const value = trimmedString(raw[field]);
    if (value === null) return { ok: false, error: `"${field}" must be text.` };
    if (value.length > CONTENT_LIMITS.url) {
      return { ok: false, error: "That image address is too long to store." };
    }
    if (value !== "" && !isRenderableImageUrl(value)) {
      return {
        ok: false,
        error: "An image must be an uploaded file or an https address - a plain http image is blocked by the browser and shows nothing.",
      };
    }
    content[field] = value;
  }
  /* eslint-enable security/detect-object-injection */

  if ("highlights" in raw) {
    const list = raw.highlights;
    if (!Array.isArray(list)) return { ok: false, error: "Highlights must be a list." };
    if (list.length > CONTENT_LIMITS.highlights) {
      return { ok: false, error: `A title can carry at most ${CONTENT_LIMITS.highlights} highlights.` };
    }
    const highlights: GameHighlight[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { ok: false, error: "Each highlight needs a title and a detail." };
      }
      const row = entry as Record<string, unknown>;
      const title = trimmedString(row.title);
      const detail = trimmedString(row.detail);
      // Both required, because the card renders both and a half-filled one reads as a bug
      // on the player's screen rather than as an operator leaving something out.
      if (!title || !detail) {
        return { ok: false, error: "Each highlight needs both a title and a detail." };
      }
      if (title.length > CONTENT_LIMITS.highlightTitle) {
        return { ok: false, error: `A highlight title must be ${CONTENT_LIMITS.highlightTitle} characters or fewer.` };
      }
      if (detail.length > CONTENT_LIMITS.highlightDetail) {
        return { ok: false, error: `A highlight detail must be ${CONTENT_LIMITS.highlightDetail} characters or fewer.` };
      }
      highlights.push({ title, detail });
    }
    content.highlights = highlights;
  }

  // The hero banner's strip. Three differences from `highlights` above, each deliberate.
  //
  // AN UNKNOWN ICON IS REFUSED, where an unknown genre is normalised. The opposite answer,
  // and the question that decides it is whether any legitimate writer can produce the value:
  // a genre can arrive as free text from a provider sync or from a title that predates the
  // vocabulary, so refusing it would block an unrelated edit to a field on the same screen.
  // Nothing but this dialog has ever written an icon slug, so an unrecognised one is a bad
  // request rather than history - and accepting it would put a neutral mark on a live banner
  // while the form showed the operator the glyph they picked.
  //
  // THE LABEL IS REQUIRED AND THE ICON IS NOT OPTIONAL EITHER, because the banner draws a
  // fixed-height column: a row with no words is a floating glyph, and a row with no glyph is
  // a label that no longer lines up with the three beside it.
  if ("heroFeatures" in raw) {
    const list = raw.heroFeatures;
    if (!Array.isArray(list)) return { ok: false, error: "Banner features must be a list." };
    if (list.length > CONTENT_LIMITS.heroFeatures) {
      return {
        ok: false,
        error: `The banner has room for ${HERO_FEATURE_LIMIT} features.`,
      };
    }
    const features: GameHeroFeature[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { ok: false, error: "Each banner feature needs an icon and a label." };
      }
      const row = entry as Record<string, unknown>;
      const label = trimmedString(row.label);
      if (!label) return { ok: false, error: "Each banner feature needs a label." };
      if (label.length > CONTENT_LIMITS.heroFeatureLabel) {
        return {
          ok: false,
          error: `A feature label must be ${HERO_FEATURE_LABEL_MAX_LENGTH} characters or fewer - the banner has room for two short lines.`,
        };
      }
      if (!isHeroFeatureIcon(row.icon)) {
        return { ok: false, error: "Each banner feature needs one of the offered icons." };
      }
      features.push({ icon: row.icon, label });
    }
    content.heroFeatures = features;
  }

  if (Object.keys(content).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, content };
}
