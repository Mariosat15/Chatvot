import { getUsersByIds } from "@/lib/utils/user-lookup";

/**
 * Puts each player's profile picture beside their row on a game leaderboard.
 *
 * WHY THIS IS ITS OWN MODULE RATHER THAN A LINE IN `getCompetitionLeaderboard`. That action is
 * mirrored into `apps/admin` and ranks every contest of every game; a picture is a screen's
 * concern and the admin app draws none. Widening the mirrored action for one player screen is
 * how a cosmetic field ends up in a settlement read. The two screens that show a game board -
 * the lobby and the arena - both call this after the ranking has been read, so the ranked rows
 * are untouched and the picture is attached to them.
 *
 * ONE PRODUCER FOR BOTH SCREENS, AND FOR THE ARENA'S POLL. The arena renders its board once on
 * the server and then refreshes it from `/api/competitions/[id]/standings`; if the page attached
 * pictures and the route did not, the avatars would vanish fifteen seconds after the page loaded
 * and reappear on reload - which reads as a broken screen. Both go through
 * `arena-standings.service.ts`, which calls this once.
 *
 * ONLY THE PICTURE IS TAKEN OFF THE LOOKUP. `getUsersByIds` returns the whole user card - email,
 * address, city - because it serves the messaging screens. None of that belongs on a public
 * board, and a spread here would put it on one; the row gains exactly one field.
 *
 * THE PICTURE IS `profileImage || image`, the same resolution the platform's global leaderboard
 * has always published (`LeaderboardContent.tsx`), so a player who is shown with a face on
 * `/leaderboard` is shown with the same face here and a player who has none gets initials in
 * both places. An absent picture stays absent - the component draws the fallback - rather than
 * being replaced with a placeholder URL nothing serves.
 */

export interface WithProfileImage {
  profileImage?: string;
}

export async function attachProfileImages<T extends { userId: string }>(
  rows: T[],
): Promise<(T & WithProfileImage)[]> {
  if (rows.length === 0) return rows;

  const users = await getUsersByIds(rows.map((row) => row.userId));

  return rows.map((row) => {
    const picture = users.get(row.userId)?.profileImage;
    // Reason: a row with no picture carries no `profileImage` key at all, rather than
    // `undefined`, so `JSON.stringify` on the polling route and the server render agree.
    return picture ? { ...row, profileImage: picture } : row;
  });
}
