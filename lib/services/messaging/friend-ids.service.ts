import {
  Friendship,
  type IFriendship,
} from "@/database/models/messaging/friend.model";

/*
  Reason: `models.Friendship || model(...)` widens the export so statics are not
  visible. Same narrowing as `app/api/challenges/opponents/route.ts`.
*/
const Friends = Friendship as unknown as {
  getUserFriends: (userId: string) => Promise<IFriendship[]>;
};

/**
 * The other party of each of the caller's friendships.
 *
 * Used by the arena Friends scope. Deliberately NOT matchmaking - that ranks by
 * trading skill (X13). Snapshot names on the friendship are irrelevant here; we
 * only need ids to filter an already-ranked board.
 */
export async function listFriendUserIds(userId: string): Promise<string[]> {
  const friendships = await Friends.getUserFriends(userId);
  const ids: string[] = [];

  for (const friendship of friendships) {
    const other = friendship.userDetails?.find(
      (detail) => detail.userId !== userId,
    );
    if (other?.userId) {
      ids.push(other.userId);
      continue;
    }
    // Fallback when userDetails is missing - the users pair still names both.
    const fromPair = friendship.users?.find((id) => id !== userId);
    if (fromPair) ids.push(fromPair);
  }

  return ids;
}
