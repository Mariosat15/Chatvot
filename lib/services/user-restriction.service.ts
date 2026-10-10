import { connectToDatabase } from "@/database/mongoose";
import UserRestriction from "@/database/models/user-restriction.model";
import { invalidateLeaderboardCache } from "./leaderboard-cache.invalidator";

/**
 * Check if a user has any active restrictions
 */
export async function getUserRestrictions(userId: string) {
  await connectToDatabase();

  // Find active restrictions
  const restrictions = await UserRestriction.find({
    userId,
    isActive: true,
  }).sort({ restrictedAt: -1 });

  // Check for expired suspensions and auto-unrestrict
  const now = new Date();
  for (const restriction of restrictions) {
    if (
      restriction.restrictionType === "suspended" &&
      restriction.expiresAt &&
      restriction.expiresAt <= now
    ) {
      // Auto-unrestrict expired suspension
      restriction.isActive = false;
      restriction.unrestrictedAt = now;
      restriction.unrestrictedBy = "system"; // Auto-unrestricted
      await restriction.save();
    }
  }

  // Return only active restrictions (after auto-expiration check)
  return restrictions.filter((r) => r.isActive);
}

/**
 * Check if user can perform a specific action
 */
export async function canUserPerformAction(
  userId: string,
  action:
    | "trade"
    | "enterCompetition"
    | "enterChallenge"
    | "deposit"
    | "withdraw",
): Promise<{ allowed: boolean; reason?: string; restrictionType?: string }> {
  console.log(
    `🔍 Checking restrictions for user ${userId} - Action: ${action}`,
  );

  const restrictions = await getUserRestrictions(userId);

  console.log(`   Found ${restrictions.length} active restriction(s)`);

  if (restrictions.length === 0) {
    console.log(`   ✅ No restrictions - Action allowed`);
    return { allowed: true };
  }

  // Check if any restriction blocks this action
  for (const restriction of restrictions) {
    console.log(
      `   Checking restriction: ${restriction.restrictionType} - Reason: ${restriction.reason}`,
    );
    console.log(
      `   Permissions: canTrade=${restriction.canTrade}, canEnterCompetitions=${restriction.canEnterCompetitions}, canDeposit=${restriction.canDeposit}, canWithdraw=${restriction.canWithdraw}`,
    );

    let isBlocked = false;

    switch (action) {
      case "trade":
        isBlocked = !restriction.canTrade;
        console.log(
          `   Trade check: canTrade=${restriction.canTrade}, isBlocked=${isBlocked}`,
        );
        break;
      case "enterCompetition":
        isBlocked = !restriction.canEnterCompetitions;
        console.log(
          `   Competition check: canEnterCompetitions=${restriction.canEnterCompetitions}, isBlocked=${isBlocked}`,
        );
        break;
      case "enterChallenge":
        // Reason: only an explicit `false` blocks — older restrictions predate
        // this field (undefined) and must remain allowed for challenges.
        isBlocked = restriction.canEnterChallenges === false;
        console.log(
          `   Challenge check: canEnterChallenges=${restriction.canEnterChallenges}, isBlocked=${isBlocked}`,
        );
        break;
      case "deposit":
        isBlocked = !restriction.canDeposit;
        console.log(
          `   Deposit check: canDeposit=${restriction.canDeposit}, isBlocked=${isBlocked}`,
        );
        break;
      case "withdraw":
        isBlocked = !restriction.canWithdraw;
        console.log(
          `   Withdraw check: canWithdraw=${restriction.canWithdraw}, isBlocked=${isBlocked}`,
        );
        break;
    }

    if (isBlocked) {
      const isBanned = restriction.restrictionType === "banned";
      const expiresText = restriction.expiresAt
        ? ` until ${restriction.expiresAt.toLocaleString()}`
        : "";

      const reason =
        restriction.customReason ||
        `Your account has been ${isBanned ? "banned" : "suspended"}${expiresText} due to ${restriction.reason.replace("_", " ")}. Please contact support for more information.`;

      console.log(`   ❌ ACTION BLOCKED!`);
      console.log(`   Reason: ${reason}`);

      return {
        allowed: false,
        reason,
        restrictionType: restriction.restrictionType,
      };
    }
  }

  console.log(`   ✅ No blocking restrictions - Action allowed`);
  return { allowed: true };
}

/**
 * Get all restrictions for admin view
 */
export async function getAllRestrictions(filters?: {
  userId?: string;
  restrictionType?: string;
  isActive?: boolean;
}) {
  await connectToDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};
  if (filters?.userId) query.userId = filters.userId;
  if (filters?.restrictionType) query.restrictionType = filters.restrictionType;
  if (filters?.isActive !== undefined) query.isActive = filters.isActive;

  return await UserRestriction.find(query).sort({ restrictedAt: -1 }).lean();
}

/**
 * Get user IDs that should be hidden from public-facing lists
 * (leaderboard, matchmaking, match cards, landing preview).
 * Returns IDs with an active restriction where hideFromPublic is true.
 */
export async function getHiddenUserIds(): Promise<Set<string>> {
  await connectToDatabase();

  const hidden = await UserRestriction.find(
    { isActive: true, hideFromPublic: true },
    { userId: 1 },
  ).lean();

  return new Set(hidden.map((r) => r.userId));
}

/**
 * Unrestrict a user (unban/unsuspend)
 */
export async function unrestrictUser(
  userId: string,
  adminUserId: string,
): Promise<boolean> {
  await connectToDatabase();

  // Reason: checked BEFORE the update so we only bust the leaderboard cache
  // when the user was actually hidden. Skips an HTTP call for suspensions /
  // trade-blocks that never affected leaderboard visibility.
  const wasHidden = await UserRestriction.exists({
    userId,
    isActive: true,
    hideFromPublic: true,
  });

  const result = await UserRestriction.updateMany(
    { userId, isActive: true },
    {
      $set: {
        isActive: false,
        unrestrictedAt: new Date(),
        unrestrictedBy: adminUserId,
      },
    },
  );

  if (result.modifiedCount > 0 && wasHidden) {
    // Fire-and-forget; never block the response on cache invalidation.
    void invalidateLeaderboardCache();
  }

  return result.modifiedCount > 0;
}
