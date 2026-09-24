/**
 * Locale selection for catalogue text and in-frame rules (A11 / A12).
 *
 * Catalogue fields are always flat strings. `Accept-Language` picks which
 * language to return; a missing locale falls back to the first entry in the
 * title's `locales` list, then `en` if that list somehow has neither.
 */

export const SUPPORTED_LOCALES = ["en", "el"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * Parse an Accept-Language header into language tags ordered by q-value.
 *
 * Ignores `*` and strips region subtags for matching (`el-GR` → `el`). A
 * missing or empty header yields an empty list so the caller applies the
 * title's own fallback chain rather than inventing a preference.
 */
export function parseAcceptLanguage(header: string | undefined | null): string[] {
  if (!header || typeof header !== "string") return [];

  const parts = header
    .split(",")
    .map((raw) => {
      const [tagPart, ...params] = raw.trim().split(";");
      const tag = (tagPart ?? "").trim().toLowerCase();
      if (!tag || tag === "*") return null;
      let q = 1;
      for (const param of params) {
        const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
        if (match) {
          const parsed = Number.parseFloat(match[1] ?? "");
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      // Reason: region is irrelevant for our two-locale catalogue; matching on
      // the primary subtag keeps `el-GR` and `el` the same preference.
      const primary = tag.split("-")[0] ?? tag;
      return { tag: primary, q };
    })
    .filter((entry): entry is { tag: string; q: number } => entry !== null)
    .sort((a, b) => b.q - a.q);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const part of parts) {
    if (seen.has(part.tag)) continue;
    seen.add(part.tag);
    ordered.push(part.tag);
  }
  return ordered;
}

/**
 * Choose a locale the title actually declares.
 *
 * Order: first requested tag that is declared → first declared → `en` if
 * declared → first declared again (last resort so a response always has a
 * language even if somebody empties the list in a test).
 */
export function pickLocale(
  requested: readonly string[],
  declared: readonly string[],
): string {
  const available = declared.filter((l) => typeof l === "string" && l.length > 0);
  if (available.length === 0) return DEFAULT_LOCALE;

  for (const tag of requested) {
    if (available.includes(tag)) return tag;
  }
  if (available.includes(DEFAULT_LOCALE)) return DEFAULT_LOCALE;
  return available[0]!;
}

export function resolveLocaleFromHeader(
  header: string | undefined | null,
  declared: readonly string[],
): string {
  return pickLocale(parseAcceptLanguage(header), declared);
}

/**
 * Resolve a player-supplied locale string (create-round `player.locale`) the
 * same way as Accept-Language: primary subtag, then the declared fallback.
 */
export function resolvePlayerLocale(
  playerLocale: string | undefined | null,
  declared: readonly string[],
): string {
  if (!playerLocale || typeof playerLocale !== "string") {
    return pickLocale([], declared);
  }
  const primary = playerLocale.trim().toLowerCase().split("-")[0] ?? "";
  return pickLocale(primary ? [primary] : [], declared);
}
