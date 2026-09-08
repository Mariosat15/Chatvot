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
 */

/** Fields an operator owns. A value outside this set is REFUSED, never ignored - see below. */
export const EDITABLE_CONTENT_FIELDS: ReadonlySet<string> = new Set([
  "displayName",
  "tagline",
  "description",
  "category",
  "thumbnailUrl",
  "bannerUrl",
  "highlights",
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
  ["scoreDirection", "declared by the provider and rewritten by every catalogue sync"],
  ["scoreType", "declared by the provider and rewritten by every catalogue sync"],
  ["configSchema", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsCompetition", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsOneVsOne", "declared by the provider and rewritten by every catalogue sync"],
  ["supportsContentSeed", "declared by the provider and rewritten by every catalogue sync"],
]);

export const CONTENT_LIMITS = {
  displayName: 80,
  tagline: 120,
  description: 2000,
  category: 40,
  url: 500,
  highlights: 6,
  highlightTitle: 40,
  highlightDetail: 140,
} as const;

export interface GameHighlight {
  title: string;
  detail: string;
}

export interface GameContentInput {
  displayName?: string;
  tagline?: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  highlights?: GameHighlight[];
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
  for (const field of ["tagline", "description", "category"] as const) {
    if (!(field in raw)) continue;
    const value = trimmedString(raw[field]);
    if (value === null) return { ok: false, error: `"${field}" must be text.` };
    if (value.length > CONTENT_LIMITS[field]) {
      return { ok: false, error: `The ${field} must be ${CONTENT_LIMITS[field]} characters or fewer.` };
    }
    content[field] = value;
  }

  for (const field of ["thumbnailUrl", "bannerUrl"] as const) {
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

  if (Object.keys(content).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, content };
}
