/**
 * How many of a Game Master's contests count as "active" for the concurrent-cap rule
 * and for dashboard KPIs.
 *
 * A contest is active when:
 * - status is `active` (already running), or
 * - status is `draft` (unpublished still occupies a slot — otherwise drafts can be
 *   stockpiled past the package limit and published together), or
 * - status is `upcoming` AND `currentParticipants >= minParticipants` — a contest that
 *   has not started yet but already has enough entrants to run. Empty upcoming contests
 *   waiting for sign-ups do not count.
 *
 * Terminal statuses (completed / cancelled / emergency_ended) and the brief `finalizing`
 * window do not.
 *
 * MIRRORED into `apps/admin/lib/services/gamemaster/`. `check:mirrors` compares models, so
 * the two copies must stay in lockstep by hand / byte-identical test.
 */

export const GM_ACTIVE_COMPETITION_STATUSES = [
  "draft",
  "upcoming",
  "active",
] as const;

export type GameMasterActiveCompetitionStatus =
  (typeof GM_ACTIVE_COMPETITION_STATUSES)[number];

/** Facts needed to decide whether one contest counts toward the concurrent active cap. */
export interface GameMasterActiveCompetitionFacts {
  status: string;
  currentParticipants?: number | null;
  minParticipants?: number | null;
}

/**
 * Whether one contest counts as active for a Game Master.
 *
 * Pure — safe to call from UI over a list the API already returned.
 */
export function isGameMasterActiveCompetition(
  contest: GameMasterActiveCompetitionFacts,
): boolean {
  if (contest.status === "active" || contest.status === "draft") return true;
  if (contest.status !== "upcoming") return false;
  const min =
    typeof contest.minParticipants === "number" &&
    Number.isFinite(contest.minParticipants)
      ? contest.minParticipants
      : 2;
  const current =
    typeof contest.currentParticipants === "number" &&
    Number.isFinite(contest.currentParticipants)
      ? contest.currentParticipants
      : 0;
  return current >= min;
}

/** Count how many contests in a list are active under {@link isGameMasterActiveCompetition}. */
export function countActiveCompetitionsInList(
  contests: readonly GameMasterActiveCompetitionFacts[],
): number {
  let n = 0;
  for (const c of contests) {
    if (isGameMasterActiveCompetition(c)) n += 1;
  }
  return n;
}

/** Remaining concurrent slots: never negative. */
export function remainingActiveCompetitionSlots(
  activeCount: number,
  maxActive: number,
): number {
  const max = Number.isFinite(maxActive) && maxActive > 0 ? maxActive : 0;
  const used = Number.isFinite(activeCount) && activeCount > 0 ? activeCount : 0;
  return Math.max(0, max - used);
}

/** Mongo filter matching the same rule as {@link isGameMasterActiveCompetition}. */
export function gameMasterActiveCompetitionFilter(
  gameMasterId: string,
): Record<string, unknown> {
  return {
    gameMasterId,
    $or: [
      { status: "active" },
      { status: "draft" },
      {
        status: "upcoming",
        $expr: {
          $gte: [
            { $ifNull: ["$currentParticipants", 0] },
            { $ifNull: ["$minParticipants", 2] },
          ],
        },
      },
    ],
  };
}

/** Minimal DB surface so callers can pass either mongoose.connection.db or a test stub. */
export interface ActiveCompetitionCounterDb {
  collection(name: string): {
    countDocuments(filter: Record<string, unknown>): Promise<number>;
  };
}

/**
 * Count contests this Game Master currently "has" for the package concurrent cap.
 *
 * Filter is keyed on `gameMasterId` (the creator), never `createdBy` alone — admin-created
 * contests use `createdBy` for the employee id and leave `gameMasterId` unset.
 */
export async function countGameMasterActiveCompetitions(
  db: ActiveCompetitionCounterDb,
  gameMasterId: string,
): Promise<number> {
  if (!gameMasterId) return 0;
  return db
    .collection("competitions")
    .countDocuments(gameMasterActiveCompetitionFilter(gameMasterId));
}
