/**
 * Arena board scope — Global / Friends / Country on the standings rail.
 *
 * MODEL-FREE AND CLIENT-REACHABLE (R58). The panel is `"use client"`; friend ids
 * arrive once with the page, country codes arrive with each standings payload.
 * Filtering here rather than on the poll means one fetch still feeds every
 * scope, so switching tabs cannot produce two answers that disagree.
 *
 * Country is a FILTER, never a column: the rail does not print where anyone
 * lives. Matching players share the viewer's stored country code; players with
 * no country set simply do not appear under Country.
 */

export type ArenaBoardScope = "global" | "friends" | "country";

/** Trim + upper-case so "cy", " Cy " and "CY" are one country. */
export function normalizeCountryCode(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return code.length > 0 ? code : undefined;
}

export function filterRowsForScope<T extends { userId: string }>(
  rows: readonly T[],
  scope: ArenaBoardScope,
  currentUserId: string,
  friendIds: ReadonlySet<string> | readonly string[],
  countries: ReadonlyMap<string, string> | Readonly<Record<string, string>> = {},
): T[] {
  if (scope === "global") return [...rows];

  if (scope === "friends") {
    const friends =
      friendIds instanceof Set ? friendIds : new Set(friendIds);
    // Reason: the viewer always sees themselves on a Friends board, even with no
    // friends in the contest - otherwise an empty rail reads as "nobody played".
    return rows.filter(
      (row) => row.userId === currentUserId || friends.has(row.userId),
    );
  }

  // country
  const countryOf = (userId: string): string | undefined => {
    if (countries instanceof Map) {
      return normalizeCountryCode(countries.get(userId));
    }
    // Reason: Map preferred; Record is what JSON delivers from the standings poll.
    return Object.prototype.hasOwnProperty.call(countries, userId)
      ? normalizeCountryCode(countries[userId as keyof typeof countries] as string)
      : undefined;
  };

  const viewerCountry = countryOf(currentUserId);
  // Reason: without a country on the viewer there is nobody to match — keep only
  // the viewer so the rail does not silently fall back to Global.
  if (!viewerCountry) {
    return rows.filter((row) => row.userId === currentUserId);
  }

  return rows.filter((row) => {
    if (row.userId === currentUserId) return true;
    return countryOf(row.userId) === viewerCountry;
  });
}
