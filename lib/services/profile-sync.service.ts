/**
 * Profile Sync Service
 *
 * Syncs user profile data (name, avatar) across all related collections
 * when a user updates their profile.
 */

import mongoose from "mongoose";

interface ProfileSyncData {
  userId: string;
  name?: string;
  avatar?: string;
}

/**
 * Notify affected users via WebSocket that a profile has been updated
 */
async function notifyProfileUpdate(
  userId: string,
  name: string | undefined,
  avatar: string | undefined,
  affectedUserIds: string[],
): Promise<void> {
  if (affectedUserIds.length === 0) return;

  try {
    const wsHost = process.env.WEBSOCKET_HOST || "localhost";
    const wsPort = process.env.WEBSOCKET_PORT || "3003";
    const wsUrl = `http://${wsHost}:${wsPort}/internal/profile-updated`;

    await fetch(wsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name,
        avatar,
        affectedUserIds: [...new Set(affectedUserIds)], // Deduplicate
      }),
    });

    console.log(
      `[ProfileSync] WebSocket notification sent to ${affectedUserIds.length} users`,
    );
  } catch (error) {
    console.error(
      "[ProfileSync] Failed to send WebSocket notification:",
      error,
    );
    // Don't throw - WebSocket notification is optional
  }
}

/**
 * Sync user profile changes across all messaging-related collections
 */
export async function syncUserProfile(data: ProfileSyncData): Promise<{
  success: boolean;
  updated: {
    friendships: number;
    friendRequests: number;
    conversations: number;
    messages: number;
  };
}> {
  const { userId, name, avatar } = data;
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Database not connected");
  }

  const results = {
    friendships: 0,
    friendRequests: 0,
    conversations: 0,
    messages: 0,
  };

  // Build update fields for different contexts
  const hasNameUpdate = name !== undefined;
  const hasAvatarUpdate = avatar !== undefined;

  if (!hasNameUpdate && !hasAvatarUpdate) {
    console.log(`[ProfileSync] No changes to sync for user ${userId}`);
    return { success: true, updated: results };
  }

  console.log(`[ProfileSync] Syncing profile for user ${userId}`, {
    name,
    avatar: avatar ? "(updated)" : undefined,
  });

  // Collect all affected user IDs for WebSocket notification
  const affectedUserIds: string[] = [];

  try {
    // 1. Update Friendships - userDetails array
    if (hasNameUpdate || hasAvatarUpdate) {
      const friendshipUpdateFields: Record<string, any> = {};
      if (hasNameUpdate) {
        friendshipUpdateFields["userDetails.$.userName"] = name;
      }
      if (hasAvatarUpdate) {
        friendshipUpdateFields["userDetails.$.userAvatar"] = avatar;
      }

      // Get friendships to collect friend IDs for notification
      const friendships = await db
        .collection("friendships")
        .find({ "userDetails.userId": userId })
        .toArray();

      // Collect friend IDs
      for (const friendship of friendships) {
        for (const detail of friendship.userDetails || []) {
          if (detail.userId && detail.userId !== userId) {
            affectedUserIds.push(detail.userId);
          }
        }
      }

      const friendshipResult = await db
        .collection("friendships")
        .updateMany(
          { "userDetails.userId": userId },
          { $set: friendshipUpdateFields },
        );
      results.friendships = friendshipResult.modifiedCount;
      console.log(`[ProfileSync] Updated ${results.friendships} friendships`);
    }

    // 2. Update Friend Requests - both sender and receiver fields
    if (hasNameUpdate || hasAvatarUpdate) {
      // Update as sender (fromUser)
      const fromUserUpdate: Record<string, any> = {};
      if (hasNameUpdate) fromUserUpdate.fromUserName = name;
      if (hasAvatarUpdate) fromUserUpdate.fromUserAvatar = avatar;

      const fromResult = await db
        .collection("friend_requests")
        .updateMany({ fromUserId: userId }, { $set: fromUserUpdate });

      // Update as receiver (toUser)
      const toUserUpdate: Record<string, any> = {};
      if (hasNameUpdate) toUserUpdate.toUserName = name;
      if (hasAvatarUpdate) toUserUpdate.toUserAvatar = avatar;

      const toResult = await db
        .collection("friend_requests")
        .updateMany({ toUserId: userId }, { $set: toUserUpdate });

      results.friendRequests =
        fromResult.modifiedCount + toResult.modifiedCount;
      console.log(
        `[ProfileSync] Updated ${results.friendRequests} friend requests`,
      );
    }

    // 3. Update Conversations - participants array and customerName
    if (hasNameUpdate || hasAvatarUpdate) {
      // First, get all conversations where user is a participant
      const conversations = await db
        .collection("conversations")
        .find({
          "participants.id": userId,
        })
        .toArray();

      for (const conv of conversations) {
        const updateDoc: Record<string, any> = {};

        // Update the participant in the array
        const participantIndex = conv.participants.findIndex(
          (p: { id: string }) => p.id === userId,
        );

        if (participantIndex !== -1) {
          if (hasNameUpdate) {
            updateDoc[`participants.${participantIndex}.name`] = name;
          }
          if (hasAvatarUpdate) {
            updateDoc[`participants.${participantIndex}.avatar`] = avatar;
          }
        }

        // Collect other participant IDs for notification
        for (const participant of conv.participants || []) {
          if (
            participant.id &&
            participant.id !== userId &&
            participant.type === "user"
          ) {
            affectedUserIds.push(participant.id);
          }
        }

        // Also update customerName if this user is the customer
        if (hasNameUpdate && conv.customerId === userId) {
          updateDoc.customerName = name;
        }

        // Update lastMessage.senderName if they were the last sender
        if (hasNameUpdate && conv.lastMessage?.senderId === userId) {
          updateDoc["lastMessage.senderName"] = name;
        }

        if (Object.keys(updateDoc).length > 0) {
          await db
            .collection("conversations")
            .updateOne({ _id: conv._id }, { $set: updateDoc });
        }
      }

      results.conversations = conversations.length;
      console.log(
        `[ProfileSync] Updated ${results.conversations} conversations`,
      );
    }

    // 4. Update recent Messages (last 30 days only to avoid massive updates)
    if (hasNameUpdate || hasAvatarUpdate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const messageUpdateFields: Record<string, any> = {};
      if (hasNameUpdate) messageUpdateFields.senderName = name;
      if (hasAvatarUpdate) messageUpdateFields.senderAvatar = avatar;

      const messageResult = await db.collection("messages").updateMany(
        {
          senderId: userId,
          createdAt: { $gte: thirtyDaysAgo },
        },
        { $set: messageUpdateFields },
      );
      results.messages = messageResult.modifiedCount;
      console.log(`[ProfileSync] Updated ${results.messages} recent messages`);
    }

    // Notify affected users via WebSocket
    if (affectedUserIds.length > 0) {
      await notifyProfileUpdate(userId, name, avatar, affectedUserIds);
    }

    console.log(
      `[ProfileSync] ✅ Profile sync completed for user ${userId}`,
      results,
    );
    return { success: true, updated: results };
  } catch (error) {
    console.error(
      `[ProfileSync] ❌ Error syncing profile for user ${userId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Sync employee profile changes across all messaging-related collections
 */
export async function syncEmployeeProfile(data: {
  employeeId: string;
  name?: string;
  avatar?: string;
}): Promise<{
  success: boolean;
  updated: {
    conversations: number;
    messages: number;
  };
}> {
  const { employeeId, name, avatar } = data;
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Database not connected");
  }

  const results = {
    conversations: 0,
    messages: 0,
  };

  const hasNameUpdate = name !== undefined;
  const hasAvatarUpdate = avatar !== undefined;

  if (!hasNameUpdate && !hasAvatarUpdate) {
    return { success: true, updated: results };
  }

  console.log(`[ProfileSync] Syncing employee profile ${employeeId}`, { name });

  try {
    // Update assignedEmployeeName in conversations
    if (hasNameUpdate) {
      const convResult = await db
        .collection("conversations")
        .updateMany(
          { assignedEmployeeId: new mongoose.Types.ObjectId(employeeId) },
          { $set: { assignedEmployeeName: name } },
        );

      // Also update in originalEmployeeName if redirected
      await db
        .collection("conversations")
        .updateMany(
          { originalEmployeeId: new mongoose.Types.ObjectId(employeeId) },
          { $set: { originalEmployeeName: name } },
        );

      results.conversations = convResult.modifiedCount;
    }

    // Update employee as participant in conversations
    if (hasNameUpdate || hasAvatarUpdate) {
      const conversations = await db
        .collection("conversations")
        .find({
          "participants.id": employeeId,
          "participants.type": "employee",
        })
        .toArray();

      for (const conv of conversations) {
        const updateDoc: Record<string, any> = {};
        const participantIndex = conv.participants.findIndex(
          (p: { id: string }) => p.id === employeeId,
        );

        if (participantIndex !== -1) {
          if (hasNameUpdate) {
            updateDoc[`participants.${participantIndex}.name`] = name;
          }
          if (hasAvatarUpdate) {
            updateDoc[`participants.${participantIndex}.avatar`] = avatar;
          }
        }

        if (hasNameUpdate && conv.lastMessage?.senderId === employeeId) {
          updateDoc["lastMessage.senderName"] = name;
        }

        if (Object.keys(updateDoc).length > 0) {
          await db
            .collection("conversations")
            .updateOne({ _id: conv._id }, { $set: updateDoc });
        }
      }
    }

    // Update recent messages from employee
    if (hasNameUpdate || hasAvatarUpdate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const messageUpdateFields: Record<string, any> = {};
      if (hasNameUpdate) messageUpdateFields.senderName = name;
      if (hasAvatarUpdate) messageUpdateFields.senderAvatar = avatar;

      const messageResult = await db.collection("messages").updateMany(
        {
          senderId: employeeId,
          senderType: "employee",
          createdAt: { $gte: thirtyDaysAgo },
        },
        { $set: messageUpdateFields },
      );
      results.messages = messageResult.modifiedCount;
    }

    console.log(`[ProfileSync] ✅ Employee profile sync completed`, results);
    return { success: true, updated: results };
  } catch (error) {
    console.error(`[ProfileSync] ❌ Error syncing employee profile:`, error);
    throw error;
  }
}

export default {
  syncUserProfile,
  syncEmployeeProfile,
};
