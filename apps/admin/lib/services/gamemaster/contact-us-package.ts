/**
 * "Contact us" Game Master packages.
 *
 * A package with `gameMasterConfig.contactUsOnly === true` cannot be bought from the
 * marketplace: the player is sent to the support chat instead. An administrator can then
 * enable the package for ONE specific player from Manage Game Masters, which adds that
 * player's id to `contactUsUnlockedUserIds` on the package, and from that moment the
 * player sees the normal Buy button for that package only.
 *
 * Model-free on purpose: the marketplace screen, the purchase route and the admin app all
 * ask the same question, and a second copy of the rule is how a screen offers a Buy button
 * the server then refuses. Mirrored into `apps/admin/lib/services/gamemaster/`, pinned
 * byte-identical by a test.
 */

export const GM_CONTACT_US_ERROR_CODE = "GM_CONTACT_US";

export const GM_CONTACT_US_MESSAGE =
  "This Game Master package is available on request. Please contact us in the support chat and we will enable it for you.";

export interface ContactUsPackageFacts {
  category?: string | null;
  gameMasterConfig?: { contactUsOnly?: boolean | null } | null;
  contactUsUnlockedUserIds?: readonly unknown[] | null;
}

/** Only an explicit `true` makes a package contact-us; absent means buyable as before. */
export function isContactUsPackage(item: ContactUsPackageFacts | null | undefined): boolean {
  return item?.category === "gamemaster" && item.gameMasterConfig?.contactUsOnly === true;
}

/** Whether an administrator has enabled this package for this player. */
export function isUnlockedForUser(
  item: ContactUsPackageFacts | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  const ids = item?.contactUsUnlockedUserIds;
  if (!Array.isArray(ids)) return false;
  return ids.some((id) => String(id) === userId);
}

/**
 * True when this player must contact us instead of buying. A package that is not
 * contact-us, or one enabled for this player, is bought normally.
 */
export function mustContactUsToBuy(
  item: ContactUsPackageFacts | null | undefined,
  userId: string | null | undefined,
): boolean {
  return isContactUsPackage(item) && !isUnlockedForUser(item, userId);
}

/** The support-chat link the Contact us button opens, pre-filled with the package name. */
export function contactUsChatHref(packageName: string): string {
  const topic = `Hi, I would like to buy the "${packageName}" Game Master package.`;
  return `/messaging?support=1&topic=${encodeURIComponent(topic)}`;
}
