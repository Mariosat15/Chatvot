import type { ClientSession } from "mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";

/**
 * A Game Master subscription the admin revoked (or that was otherwise cancelled).
 *
 * Reason this is its own question rather than "not active": an expired subscription is
 * the player's to renew, a revoked one is not. `userId` is unique on the collection, so a
 * revoked row is never replaced by a second document - the next purchase must reset this
 * one in place, and nothing may offer to renew it.
 */
export function isRevokedSubscription(
  subscription: { status?: string } | null | undefined,
): boolean {
  return subscription?.status === "cancelled";
}

/**
 * Removes every Game Master package purchase the user holds.
 *
 * Reason: the purchase route refuses "You already own this item", so a revoked
 * subscription's leftover purchase row would stop the player buying that same package
 * again. A purchase row grants nothing on its own - the subscription is what grants.
 */
export async function removeGameMasterPurchases(
  userId: string,
  session?: ClientSession,
): Promise<number> {
  const gmItems = await MarketplaceItem.find({ category: "gamemaster" })
    .select("_id")
    .session(session ?? null)
    .lean<{ _id: unknown }[]>();
  if (gmItems.length === 0) return 0;
  const result = await UserPurchase.deleteMany({
    userId,
    itemId: { $in: gmItems.map((i) => i._id) },
  }).session(session ?? null);
  return result.deletedCount ?? 0;
}

/**
 * The fields that turn a revoked subscription back into a brand-new one.
 *
 * Reason every per-subscription override is cleared: the new package's rules must apply
 * exactly as for a first purchase, so an admin override, a pause or a scheduled deletion
 * from the revoked period must not leak into it. Lifetime totals (earnings, referrals,
 * renewal history) and the referral code are kept - they belong to the person.
 */
export function freshSubscriptionFields(input: {
  packageId: string;
  packageName: string;
  renewalPrice: number;
  limits: unknown;
  startDate: Date;
  endDate: Date;
}): Record<string, unknown> {
  return {
    packageId: input.packageId,
    packageName: input.packageName,
    status: "active",
    activatedAt: input.startDate,
    startDate: input.startDate,
    endDate: input.endDate,
    nextRenewalDate: input.endDate,
    autoRenew: true,
    renewalPrice: input.renewalPrice,
    limits: input.limits,
    currentPeriodCompetitionsCreated: 0,
    lastCompetitionResetDate: input.startDate,
    expiryWarnings: {},
    isPaused: false,
    pausedAt: undefined,
    scheduledForDeletion: false,
    scheduledDeletionAt: undefined,
    suspendedAt: undefined,
    suspendedReason: undefined,
    cancelledAt: undefined,
    cancellationReason: undefined,
    competitionCreationOverride: null,
    overrideLimits: {},
  };
}
