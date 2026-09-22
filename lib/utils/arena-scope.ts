/**
 * Arena board scope — Global vs Friends on the standings rail.
 *
 * MODEL-FREE AND CLIENT-REACHABLE (R58). The panel is `"use client"`; the friend
 * ids arrive from the server as a plain string array. Filtering here rather than
 * on the standings poll means one fetch still feeds both scopes, so switching
 * tabs cannot produce two answers that disagree.
 *
 * Country is deliberately absent: publishing a player's country on a public board
 * is a disclosure decision the owner scheduled as later work (`13` s4.1y).
 */

export type ArenaBoardScope = "global" | "friends";

export function filterRowsForScope<T extends { userId: string }>(
  rows: readonly T[],
  scope: ArenaBoardScope,
  currentUserId: string,
  friendIds: ReadonlySet<string> | readonly string[],
): T[] {
  if (scope === "global") return [...rows];
  const friends =
    friendIds instanceof Set ? friendIds : new Set(friendIds);
  // Reason: the viewer always sees themselves on a Friends board, even with no
  // friends in the contest - otherwise an empty rail reads as "nobody played".
  return rows.filter(
    (row) => row.userId === currentUserId || friends.has(row.userId),
  );
}
