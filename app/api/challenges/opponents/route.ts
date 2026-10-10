import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import {
  Friendship,
  type IFriendship,
} from "@/database/models/messaging/friend.model";

/*
  Reason: `models.Friendship || model(...)` widens the export to the union of the two, so the
  statics declared on `FriendshipModel` are not visible to a caller - the same shape every
  other consumer of this model works around. Narrowed to the one static this route calls,
  rather than casting the whole model to `any`, so a signature change is still a type error
  here. Same approach as `app/api/messaging/search/users/route.ts`.
*/
const Friends = Friendship as unknown as {
  getUserFriends: (userId: string) => Promise<IFriendship[]>;
};

/**
 * GET /api/challenges/opponents
 *
 * The first list the opponent picker shows: the player's own friends.
 *
 * WHY FRIENDS AND NOT A RANKING. A challenge is two people agreeing to stake credits against
 * each other, so the opponent a player wants is overwhelmingly somebody they already know.
 * Matchmaking by skill exists (`lib/services/matchmaking.service.ts`) and is deliberately not
 * used here - it ranks opponents by TRADING skill, which for a provider game returns a list
 * ordered by something with no bearing on the game being played, happily and with no log line.
 * That is risk X13 and belongs with X11.5, not with a picker.
 *
 * ANYBODY ELSE COMES FROM THE EXISTING SEARCH, `GET /api/messaging/search/users`, which already
 * applies both directions of the block list and the friend-request privacy setting. Reusing it
 * rather than writing a second search is the point: a second one is a second answer to "may I
 * see this person", and the two drift in the direction that shows somebody who blocked you.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const friendships = await Friends.getUserFriends(session.user.id);

    /*
      The name and avatar come off `userDetails`, which is a SNAPSHOT written when the
      friendship was created, so a renamed player shows their old name here. That is accepted
      rather than overlooked: the alternative is a user lookup per friend on a list that is
      only ever used to pick somebody, and the create route resolves the real name from the
      user record anyway - so what is stored on the challenge is always current, whatever this
      list happened to say.
    */
    const opponents = friendships
      .map((friendship) => {
        const other = friendship.userDetails?.find(
          (detail) => detail.userId !== session.user.id,
        );
        if (!other?.userId) return null;
        return {
          userId: other.userId,
          username: other.userName,
          avatar: other.userAvatar,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return NextResponse.json({ opponents });
  } catch (error) {
    console.error("❌ Failed to list challenge opponents:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
