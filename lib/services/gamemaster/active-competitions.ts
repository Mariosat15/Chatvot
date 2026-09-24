/**
 * How many of a Game Master's contests are still "open" for the concurrent-cap rule.
 *
 * Draft, upcoming and active occupy a slot: a draft the operator has not published still
 * counts, because otherwise a Game Master could stockpile drafts past the package limit and
 * publish them all at once. Terminal statuses (completed / cancelled / emergency_ended) and
 * the brief `finalizing` window do not.
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
  return db.collection("competitions").countDocuments({
    gameMasterId,
    status: { $in: [...GM_ACTIVE_COMPETITION_STATUSES] },
  });
}
