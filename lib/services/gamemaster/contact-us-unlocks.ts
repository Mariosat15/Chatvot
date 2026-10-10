/**
 * Ends a player's "Contact us" Game Master package permissions.
 *
 * An admin enables a Contact-us package for one player (the admin app's package-unlocks service).
 * That permission is for ONE purchase decision. When the subscription it led to expires, the
 * player must ask support again - otherwise they keep the Buy button for ever.
 *
 * Reason it uses the raw collection: the daily renewal worker writes with the raw driver and must
 * call this too, and a model import there would pull the whole marketplace schema into the worker.
 * The admin app's revoke uses its own `disableAllContactUsPackagesForUser`, which runs the same
 * filter and update.
 */

import mongoose from "mongoose";

export async function clearContactUsUnlocks(
  userIds: string | string[],
): Promise<number> {
  const ids = (Array.isArray(userIds) ? userIds : [userIds])
    .map((id) => String(id))
    .filter((id) => id.length > 0);
  if (ids.length === 0) return 0;

  const result = await mongoose.connection
    .collection<{ contactUsUnlockedUserIds?: string[] }>("marketplaceitems")
    .updateMany(
    {
      category: "gamemaster",
      "gameMasterConfig.contactUsOnly": true,
      contactUsUnlockedUserIds: { $in: ids },
    },
    { $pull: { contactUsUnlockedUserIds: { $in: ids } } },
  );
  return result.modifiedCount;
}
