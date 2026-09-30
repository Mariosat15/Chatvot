/**
 * Who may SEE and ENTER a `gm_private` contest - the one definition (`External game plans/24` s4).
 *
 * Model-free on purpose: every discovery reader, the entry gate and a client screen can share
 * it without reaching the database driver (R58). Resolving who the viewer is affiliated to
 * needs a database read and lives in `contest-viewer.service.ts` beside it.
 *
 * Main app only. The admin app shows operators every contest and has no reader to filter, and
 * mirroring a file before anything there imports it is two copies agreeing while one runs (R42).
 */

import { resolveCompetitionVisibility } from "./competition-visibility";

/**
 * The stored values that read as PUBLIC. `null` inside `$in` also matches a missing field, so
 * every contest written before `visibility` existed stays listed.
 *
 * Reason: `$in` of the public values, deliberately NOT the plan's `$ne: "gm_private"`. The
 * resolver treats any unrecognised value as private (fail closed); `$ne` would list a contest
 * carrying such a value to everybody, so the list and the entry gate would disagree about the
 * same document - and in the direction that leaks (R117).
 */
export const PUBLIC_VISIBILITY_VALUES: readonly (string | null)[] = [null, "", "public"];

export interface ContestViewer {
  /** The signed-in viewer. Absent for anonymous and public routes. */
  userId?: string | null;
  /** The Game Master the viewer is affiliated to, if any. */
  affiliatedGameMasterId?: string | null;
}

/** Contests anybody may see. `prefix` addresses the field inside a `$lookup` result. */
export function publicContestsFilter(prefix = ""): Record<string, unknown> {
  return { [`${prefix}visibility`]: { $in: [...PUBLIC_VISIBILITY_VALUES] } };
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Contests this viewer may see: every public one, plus any contest created by the Game Master
 * they are affiliated to, plus their own if they ARE a Game Master (a creator must be able to
 * find the private contest they just made).
 */
export function visibleContestsFilter(viewer: ContestViewer | null): Record<string, unknown> {
  const gameMasterIds = [viewer?.affiliatedGameMasterId, viewer?.userId].filter(nonEmpty);
  if (gameMasterIds.length === 0) return publicContestsFilter();
  return {
    $or: [publicContestsFilter(), { gameMasterId: { $in: [...new Set(gameMasterIds)] } }],
  };
}

/**
 * Narrow an existing competition query to what the viewer may see.
 *
 * Reason: `$and`, never a spread. Several readers already carry their own `$or` (status
 * windows, legacy game labels); spreading a second `$or` over it silently replaces the first,
 * which widens the reader while every assertion about the visibility half still passes.
 */
export function withVisibleContests(
  query: Record<string, unknown>,
  viewer: ContestViewer | null,
): Record<string, unknown> {
  return { $and: [query, visibleContestsFilter(viewer)] };
}

/**
 * May this player take a seat? A public contest: yes. A private one: only when they are
 * affiliated to the Game Master who created it. A private contest with no creator admits
 * nobody - an unknown shape fails towards the closed door, as the resolver does.
 */
export function canEnterPrivateContest(
  contest: { visibility?: unknown; gameMasterId?: unknown },
  affiliatedGameMasterId: string | null | undefined,
): boolean {
  if (resolveCompetitionVisibility(contest.visibility) !== "gm_private") return true;
  return (
    nonEmpty(affiliatedGameMasterId) &&
    typeof contest.gameMasterId === "string" &&
    contest.gameMasterId === affiliatedGameMasterId
  );
}
