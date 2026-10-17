/**
 * Who may see and enter a competition - the vocabulary, and nothing else.
 *
 * Model-free on purpose: both `competition.model.ts` copies and the package/subscription
 * limit resolver import it, and a client screen will too (R58 - a `"use client"` file must
 * never reach the database driver). Mirrored into `apps/admin`; a test pins the two copies
 * byte-identical, because `check:mirrors` compares models and cannot see this file.
 *
 * `gm_private` means: open only to players affiliated to the Game Master who created the
 * contest (`External game plans/24-gamemaster-program-v2.md` s2.2). Enforcement lives in the
 * entry gate and the discovery filters, not here.
 */

export const COMPETITION_VISIBILITIES = ["public", "gm_private"] as const;

export type CompetitionVisibility = (typeof COMPETITION_VISIBILITIES)[number];

export const DEFAULT_COMPETITION_VISIBILITY: CompetitionVisibility = "public";

/**
 * The visibility a stored contest actually has.
 *
 * Absent, `null` and `""` are PUBLIC - every contest written before this field existed is
 * public and must stay so, and the Game Master creation routes insert with the raw driver,
 * which never applies the schema default (R7).
 *
 * Any OTHER unrecognised value is treated as PRIVATE, deliberately. Reason: the two mistakes
 * are not symmetric. Hiding a contest that should have been public is visible and somebody
 * complains; showing a contest that should have been private leaks it to players it was
 * never meant for (R117), and nothing reports that. Only our own code writes this field, so
 * an unknown value is a bug, and a bug should fail towards the closed door.
 */
export function resolveCompetitionVisibility(
  stored: unknown,
): CompetitionVisibility {
  if (stored === undefined || stored === null) {
    return DEFAULT_COMPETITION_VISIBILITY;
  }
  if (typeof stored === "string" && stored.trim() === "") {
    return DEFAULT_COMPETITION_VISIBILITY;
  }
  return stored === "public" ? "public" : "gm_private";
}
