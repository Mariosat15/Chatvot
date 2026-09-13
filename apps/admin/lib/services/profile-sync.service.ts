/**
 * Profile Sync Service (Admin)
 *
 * Syncs employee profile data (name, avatar) across all messaging-related collections.
 */

import mongoose from "mongoose";

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

      // Update results if we processed conversations as participant
      if (results.conversations === 0) {
        results.conversations = conversations.length;
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
  syncEmployeeProfile,
};
