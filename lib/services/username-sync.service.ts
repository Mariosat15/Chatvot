import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import Competition from "@/database/models/trading/competition.model";
import UserPresence from "@/database/models/user-presence.model";
import { FriendRequest, Friendship } from "@/database/models/messaging/friend.model";
import Conversation from "@/database/models/messaging/conversation.model";
import Message from "@/database/models/messaging/message.model";
import { BlockedUser } from "@/database/models/messaging/blocked-user.model";
import { connectToDatabase } from "@/database/mongoose";

/**
 * Rewrites every stored copy of a player's display name to their public name.
 *
 * Reason: many collections denormalize the name at write time (a leaderboard row, a
 * challenge, a friendship, a chat message). Before usernames existed those copies held the
 * REAL name, and they are read by other players. Fixing the writers covers new rows only;
 * this covers the rows already written, and it runs again whenever a player changes their
 * username so old rows never show a name they abandoned.
 *
 * Deliberately NOT rewritten: `UserReferral.userName`, which is the Game Master's private
 * record and is masked on read by `gm-referral-view.ts`; support conversations, whose other
 * party is staff who may see real names; and the text of past notifications, which is prose
 * rather than a field.
 */

export type PublicNameSyncCounts = Record<string, number>;

export async function syncPublicNameCopies(
  userId: string,
  publicName: string,
): Promise<PublicNameSyncCounts> {
  await connectToDatabase();

  const supportConversationIds = await Conversation.find(
    { type: "user-to-support", "participants.id": userId },
    { _id: 1 },
  )
    .lean()
    .then((rows) => rows.map((r) => r._id));

  const [
    competitionSeats,
    challengeSeats,
    challengerRows,
    challengedRows,
    presence,
    requestsFrom,
    requestsTo,
    friendships,
    conversations,
    lastMessages,
    messages,
    blockedAsBlocker,
    blockedAsBlocked,
    gmContests,
  ] = await Promise.all([
    CompetitionParticipant.updateMany(
      { userId, username: { $ne: publicName } },
      { $set: { username: publicName } },
    ),
    ChallengeParticipant.updateMany(
      { userId, username: { $ne: publicName } },
      { $set: { username: publicName } },
    ),
    Challenge.updateMany(
      { challengerId: userId, challengerName: { $ne: publicName } },
      { $set: { challengerName: publicName } },
    ),
    Challenge.updateMany(
      { challengedId: userId, challengedName: { $ne: publicName } },
      { $set: { challengedName: publicName } },
    ),
    UserPresence.updateMany(
      { userId, username: { $ne: publicName } },
      { $set: { username: publicName } },
    ),
    FriendRequest.updateMany(
      { fromUserId: userId, fromUserName: { $ne: publicName } },
      { $set: { fromUserName: publicName } },
    ),
    FriendRequest.updateMany(
      { toUserId: userId, toUserName: { $ne: publicName } },
      { $set: { toUserName: publicName } },
    ),
    Friendship.updateMany(
      { "userDetails.userId": userId },
      { $set: { "userDetails.$[me].userName": publicName } },
      { arrayFilters: [{ "me.userId": userId }] },
    ),
    Conversation.updateMany(
      { type: { $ne: "user-to-support" }, "participants.id": userId },
      { $set: { "participants.$[me].name": publicName } },
      { arrayFilters: [{ "me.id": userId, "me.type": "user" }] },
    ),
    Conversation.updateMany(
      {
        type: { $ne: "user-to-support" },
        "lastMessage.senderId": userId,
        "lastMessage.senderType": "user",
      },
      { $set: { "lastMessage.senderName": publicName } },
    ),
    Message.updateMany(
      {
        senderId: userId,
        senderType: "user",
        senderName: { $ne: publicName },
        conversationId: { $nin: supportConversationIds },
      },
      { $set: { senderName: publicName } },
    ),
    BlockedUser.updateMany(
      { blockerUserId: userId, blockerUserName: { $ne: publicName } },
      { $set: { blockerUserName: publicName } },
    ),
    BlockedUser.updateMany(
      { blockedUserId: userId, blockedUserName: { $ne: publicName } },
      { $set: { blockedUserName: publicName } },
    ),
    Competition.updateMany(
      { gameMasterId: userId, gameMasterName: { $ne: publicName } },
      { $set: { gameMasterName: publicName } },
    ),
  ]);

  return {
    competitionSeats: competitionSeats.modifiedCount,
    challengeSeats: challengeSeats.modifiedCount,
    challengerRows: challengerRows.modifiedCount,
    challengedRows: challengedRows.modifiedCount,
    presence: presence.modifiedCount,
    friendRequestsFrom: requestsFrom.modifiedCount,
    friendRequestsTo: requestsTo.modifiedCount,
    friendships: friendships.modifiedCount,
    conversations: conversations.modifiedCount,
    lastMessages: lastMessages.modifiedCount,
    messages: messages.modifiedCount,
    blockedAsBlocker: blockedAsBlocker.modifiedCount,
    blockedAsBlocked: blockedAsBlocked.modifiedCount,
    gmContests: gmContests.modifiedCount,
  };
}
