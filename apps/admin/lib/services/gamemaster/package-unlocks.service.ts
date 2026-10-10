/**
 * Per-player unlocks for "Contact us" Game Master packages.
 *
 * Shared by Manage Game Masters (`/api/gamemasters/[id]/package-unlocks`, keyed on the
 * subscription) and the Users section (`/api/users/[userId]/package-unlocks`, keyed on the
 * player, so a player who is not a Game Master yet can be enabled to buy their first package).
 * Reason: one implementation, so the two screens can never disagree about who may buy what.
 */

import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { isContactUsPackage, isUnlockedForUser } from "./contact-us-package";

export interface ContactUsPackageUnlockRow {
  id: string;
  name: string;
  price: number;
  isPublished?: boolean;
  status?: string;
  unlocked: boolean;
}

/** Every Contact-us GM package, with whether it is enabled for this player. */
export async function listContactUsPackagesForUser(
  userId: string,
): Promise<ContactUsPackageUnlockRow[]> {
  await connectToDatabase();
  const items = await MarketplaceItem.find({
    category: "gamemaster",
    "gameMasterConfig.contactUsOnly": true,
  })
    .select("name price isPublished status category gameMasterConfig.contactUsOnly +contactUsUnlockedUserIds")
    .sort({ price: 1 })
    .lean();

  return items.map((item) => ({
    id: String(item._id),
    name: item.name,
    price: item.price,
    isPublished: item.isPublished,
    status: item.status,
    unlocked: isUnlockedForUser(item, userId),
  }));
}

/**
 * Enables or disables one Contact-us package for one player. Refuses anything that is not a
 * Contact-us GM package, so an unlock list is never stamped onto an item nothing reads it on.
 */
export async function setContactUsPackageUnlock(
  userId: string,
  packageId: string,
  enabled: boolean,
): Promise<{ ok: true; packageName: string } | { ok: false; error: string }> {
  await connectToDatabase();
  const item = await MarketplaceItem.findById(packageId)
    .select("name category gameMasterConfig.contactUsOnly")
    .lean();
  if (!item || !isContactUsPackage(item)) {
    return { ok: false, error: "This package is not a Contact us Game Master package" };
  }

  await MarketplaceItem.updateOne(
    { _id: item._id },
    enabled
      ? { $addToSet: { contactUsUnlockedUserIds: userId } }
      : { $pull: { contactUsUnlockedUserIds: userId } },
  );
  return { ok: true, packageName: item.name };
}

/**
 * Disables EVERY Contact-us package for one player, so they see Contact us again everywhere.
 * Used by the "Disable GM package" button and by an admin revoke.
 * Reason: an unlock is a one-off permission from support. Left in place after a revoke or an
 * expiry, the player could buy the package again without asking, which is what the owner forbade.
 */
export async function disableAllContactUsPackagesForUser(
  userId: string,
): Promise<{ disabledCount: number }> {
  await connectToDatabase();
  const result = await MarketplaceItem.updateMany(
    {
      category: "gamemaster",
      "gameMasterConfig.contactUsOnly": true,
      contactUsUnlockedUserIds: userId,
    },
    { $pull: { contactUsUnlockedUserIds: userId } },
  );
  return { disabledCount: result.modifiedCount };
}
