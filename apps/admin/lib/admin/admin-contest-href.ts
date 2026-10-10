/**
 * Where an operator opens one competition or one challenge inside the admin app.
 *
 * Used by Manage Game Masters, whose Competitions and Earnings tabs list contests by name
 * and previously offered no way to reach them. Model-free on purpose: the detail view is
 * `"use client"` (R58).
 */
import { isCompetitionIdShaped } from "../utils/competition-id";

export type AdminContestKind = "competition" | "challenge";

// Reason: the kind comes from a stored `sourceType`, so a Map keeps the lookup total -
// an object index would hand "__proto__" or "toString" something truthy.
const VIEW_ROUTES = new Map<string, string>([
  ["competition", "/competitions/view/"],
  ["challenge", "/challenges/view/"],
]);

/**
 * The admin view page for a contest, or `null` when the kind is unknown or the id is not
 * an ObjectId - a button that opens a 404 is worse than no button.
 */
export function adminContestViewHref(
  kind: string | null | undefined,
  id: string | null | undefined,
): string | null {
  const base = typeof kind === "string" ? VIEW_ROUTES.get(kind) : undefined;
  if (!base || !isCompetitionIdShaped(id)) return null;
  return `${base}${id}`;
}
