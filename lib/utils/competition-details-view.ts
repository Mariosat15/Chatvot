/**
 * The one definition of "show me the lobby even though I've finished this contest".
 *
 * WHY THIS EXISTS AT ALL. A participant of a completed contest who opens `/competitions/[id]`
 * is redirected to their own results, because that is what they came for. `?view=details`
 * turns that off so they can go back and read the public lobby - the leaderboard, the prize
 * table, the schedule.
 *
 * THE DEFECT THAT PRODUCED THIS MODULE. That query string was written out by hand at every
 * call site, and the game results screen's two links to the lobby were written **without it**.
 * So a player on a finished game contest pressing "View Competition Details" was redirected
 * straight back to the results page they were already looking at. The button appeared to do
 * nothing at all: no error, no log line, no navigation the player could perceive. Trading's
 * three links had the query string, which is precisely why nobody caught it - the feature
 * worked on the path everybody tests.
 *
 * // Reason: this is the "one rule, two copies" shape behind `referenceId`, `failedReason`,
 * `challengeId` and the Game Master `||`, in its smallest possible form. The gate reads a
 * literal and the links write a literal, so they can disagree - and when they do, the failure
 * is a control that silently does nothing rather than anything that reports itself. One
 * module, imported by the gate and by every link, cannot drift.
 *
 * Main app only. `apps/admin` has no results screen and no such redirect, so there is nothing
 * to mirror and `check:mirrors` correctly says nothing about it.
 */

/** The query parameter name, and the value that switches the redirect off. */
export const COMPETITION_VIEW_PARAM = "view";
export const COMPETITION_DETAILS_VIEW = "details";

/**
 * The link a results screen uses to reach the lobby.
 *
 * Every caller must use this rather than composing the query string, or the drift this module
 * exists to close reopens one call site at a time.
 */
export function competitionDetailsHref(competitionId: string): string {
  return `/competitions/${competitionId}?${COMPETITION_VIEW_PARAM}=${COMPETITION_DETAILS_VIEW}`;
}

/**
 * Whether a request is explicitly asking for the lobby rather than the results.
 *
 * Takes the resolved `searchParams` object. Next.js types a repeated parameter as an array, so
 * `?view=details&view=x` arrives as `["details", "x"]` - and reading `=== "details"` off that
 * is `false`, which is the safe direction here (the redirect still happens) but is not a
 * decision anyone made. An array is treated as asking for the details view if any entry says
 * so, because a duplicated parameter is a malformed link rather than an attempt to opt out.
 */
export function wantsCompetitionDetailsView(
  query: Record<string, string | string[] | undefined> | undefined,
): boolean {
  // Reason it reads entries rather than indexing: the object comes from a request, and an
  // index expression walks the prototype chain. `Object.entries` returns own enumerable keys
  // only, so the lookup is total - the same reasoning behind the `Set` in the contest-edit
  // field list and the `Map` in the round-inspector action list.
  const value = Object.entries(query ?? {}).find(
    ([key]) => key === COMPETITION_VIEW_PARAM,
  )?.[1];

  if (Array.isArray(value)) {
    return value.includes(COMPETITION_DETAILS_VIEW);
  }
  return value === COMPETITION_DETAILS_VIEW;
}
