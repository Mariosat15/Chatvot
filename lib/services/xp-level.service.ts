"use server";

import { connectToDatabase } from "@/database/mongoose";
import UserLevel from "@/database/models/user-level.model";
import UserBadge from "@/database/models/user-badge.model";
import BadgeConfig from "@/database/models/badge-config.model";
import { getTitleByXP, getXPForBadge } from "@/lib/services/xp-config.service";

/**
 * Award XP to user for earning a badge
 */
export async function awardXPForBadge(
  userId: string,
  badgeId: string,
): Promise<{
  xpGained: number;
  newXP: number;
  newLevel: number;
  newTitle: string;
  leveledUp: boolean;
  oldLevel?: number;
  oldTitle?: string;
}> {
  console.log(
    `💫 [XP AWARD] Starting XP award for user ${userId}, badge ${badgeId}`,
  );
  await connectToDatabase();

  // Find the badge to get rarity from database
  const badge = await BadgeConfig.findOne({
    id: badgeId,
    isActive: true,
  }).lean();
  if (!badge) {
    console.error(`❌ [XP AWARD] Badge ${badgeId} not found in database`);
    throw new Error("Badge not found");
  }
  console.log(
    `🏅 [XP AWARD] Badge found: ${badge.name}, rarity: ${badge.rarity}`,
  );

  const xpGained = await getXPForBadge(badge.rarity);
  console.log(`⭐ [XP AWARD] XP to be gained: ${xpGained}`);

  // Reason: Atomic upsert prevents E11000 duplicate key when concurrent XP awards
  // race to create the same UserLevel document (e.g., challenge_completed + challenge_won).
  let userLevel = await UserLevel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
    { upsert: true, new: true }
  );
  console.log(
    `📊 [XP AWARD] User stats: XP=${userLevel.currentXP}, Level=${userLevel.currentLevel}, Badges=${userLevel.totalBadgesEarned}`,
  );

  const oldXP = userLevel.currentXP;
  const oldLevel = userLevel.currentLevel;
  const oldTitle = userLevel.currentTitle;

  // Add XP
  const newXP = oldXP + xpGained;
  console.log(
    `📈 [XP AWARD] XP progression: ${oldXP} → ${newXP} (+${xpGained})`,
  );

  const newTitleLevel = await getTitleByXP(newXP); // ✅ Fetch from database
  console.log(
    `👑 [XP AWARD] New title level: ${newTitleLevel.title} (Level ${newTitleLevel.level})`,
  );

  const leveledUp = newTitleLevel.level > oldLevel;
  if (leveledUp) {
    console.log(`🎉 [XP AWARD] LEVEL UP! ${oldLevel} → ${newTitleLevel.level}`);
  }

  // Update user level with database values
  userLevel.currentXP = newXP;
  userLevel.currentLevel = newTitleLevel.level;
  userLevel.currentTitle = newTitleLevel.title; // ✅ From database
  userLevel.totalBadgesEarned += 1;
  userLevel.lastXPGain = new Date();

  // Add to XP history
  userLevel.xpHistory.push({
    amount: xpGained,
    source: "badge",
    badgeId,
    timestamp: new Date(),
  });
  console.log(
    `📜 [XP AWARD] XP history updated (${userLevel.xpHistory.length} entries)`,
  );

  const savedLevel = await userLevel.save();
  console.log(`💾 [XP AWARD] UserLevel saved successfully:`, savedLevel._id);
  console.log(
    `✅ [XP AWARD] Final state: XP=${savedLevel.currentXP}, Level=${savedLevel.currentLevel}, Title=${savedLevel.currentTitle}, Badges=${savedLevel.totalBadgesEarned}`,
  );

  // Send level up notification if user leveled up
  if (leveledUp) {
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");
      await notificationService.notifyLevelUp(
        userId,
        newTitleLevel.level,
        newTitleLevel.title,
      );
      console.log(
        `🔔 [XP AWARD] Level up notification sent for level ${newTitleLevel.level}`,
      );
    } catch (error) {
      console.error(
        `❌ [XP AWARD] Error sending level up notification:`,
        error,
      );
    }
  }

  return {
    xpGained,
    newXP,
    newLevel: newTitleLevel.level,
    newTitle: newTitleLevel.title,
    leveledUp,
    oldLevel: leveledUp ? oldLevel : undefined,
    oldTitle: leveledUp ? oldTitle : undefined,
  };
}

/**
 * Award XP to user from any source (milestone, action, etc.)
 * This is a generic XP award function, separate from badge XP
 */
export async function awardXP(
  userId: string,
  amount: number,
  source: "milestone" | "action" | "competition" | "referral" | "bonus" | "other",
  sourceId?: string
): Promise<{
  xpGained: number;
  newXP: number;
  newLevel: number;
  newTitle: string;
  leveledUp: boolean;
  oldLevel?: number;
  oldTitle?: string;
}> {
  console.log(`💫 [XP AWARD] Awarding ${amount} XP to user ${userId} from ${source}`);
  await connectToDatabase();

  if (amount <= 0) {
    throw new Error("XP amount must be positive");
  }

  // Reason: Atomic upsert prevents E11000 duplicate key when concurrent XP awards
  // race to create the same UserLevel document (e.g., challenge_completed + challenge_won).
  let userLevel = await UserLevel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
    { upsert: true, new: true }
  );

  const oldXP = userLevel.currentXP;
  const oldLevel = userLevel.currentLevel;
  const oldTitle = userLevel.currentTitle;

  // Add XP
  const newXP = oldXP + amount;
  console.log(`📈 [XP AWARD] XP progression: ${oldXP} → ${newXP} (+${amount})`);

  const newTitleLevel = await getTitleByXP(newXP);
  const leveledUp = newTitleLevel.level > oldLevel;

  if (leveledUp) {
    console.log(`🎉 [XP AWARD] LEVEL UP! ${oldLevel} → ${newTitleLevel.level}`);
  }

  // Update user level
  userLevel.currentXP = newXP;
  userLevel.currentLevel = newTitleLevel.level;
  userLevel.currentTitle = newTitleLevel.title;
  userLevel.lastXPGain = new Date();

  // Add to XP history
  userLevel.xpHistory.push({
    amount,
    source,
    sourceId,
    timestamp: new Date(),
  });

  await userLevel.save();

  // Send level up notification if user leveled up
  if (leveledUp) {
    try {
      const { notificationService } = await import("@/lib/services/notification.service");
      await notificationService.notifyLevelUp(userId, newTitleLevel.level, newTitleLevel.title);
    } catch (error) {
      console.error(`❌ [XP AWARD] Error sending level up notification:`, error);
    }
  }

  return {
    xpGained: amount,
    newXP,
    newLevel: newTitleLevel.level,
    newTitle: newTitleLevel.title,
    leveledUp,
    oldLevel: leveledUp ? oldLevel : undefined,
    oldTitle: leveledUp ? oldTitle : undefined,
  };
}

/**
 * Award XP for trading activity (trade close, competition end, etc.)
 * Includes daily cap to prevent exploitation and encourage daily return.
 *
 * XP Sources:
 *   - Trade completed: 2 XP (cap: 50/day)
 *   - Winning trade:  +3 bonus XP (cap: 30/day)
 *   - Competition completed: 25 XP (no cap)
 *   - Competition podium: 50/35/20 XP for 1st/2nd/3rd (no cap)
 *   - Challenge completed: 15 XP (no cap)
 *   - Challenge won: 30 XP (no cap)
 *
 * Daily activity XP cap: 100 XP (trades only; competition/challenge XP is uncapped)
 */
export async function awardActivityXP(
  userId: string,
  activity: "trade_completed" | "winning_trade" | "competition_completed" | "competition_podium_1" | "competition_podium_2" | "competition_podium_3" | "challenge_completed" | "challenge_won",
): Promise<{ xpAwarded: number; dailyXPUsed: number; dailyCapped: boolean }> {
  await connectToDatabase();

  // XP amounts per activity
  const XP_AMOUNTS: Record<string, number> = {
    trade_completed: 2,
    winning_trade: 3,
    competition_completed: 25,
    competition_podium_1: 50,
    competition_podium_2: 35,
    competition_podium_3: 20,
    challenge_completed: 15,
    challenge_won: 30,
  };

  const DAILY_TRADE_XP_CAP = 100; // Max XP from trade activity per day

  const xpAmount = XP_AMOUNTS[activity] || 0;
  if (xpAmount <= 0) return { xpAwarded: 0, dailyXPUsed: 0, dailyCapped: false };

  // Check daily cap for trade-based activities only
  const isTradeActivity = activity === "trade_completed" || activity === "winning_trade";
  
  if (isTradeActivity) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let userLevel = await UserLevel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
      { upsert: true, new: true }
    );

    // Calculate today's trade XP from history
    const todayTradeXP = (userLevel.xpHistory || [])
      .filter((h: any) => {
        const ts = new Date(h.timestamp);
        return ts >= today && (h.source === "trade_activity");
      })
      .reduce((sum: number, h: any) => sum + (h.amount || 0), 0);

    if (todayTradeXP >= DAILY_TRADE_XP_CAP) {
      return { xpAwarded: 0, dailyXPUsed: todayTradeXP, dailyCapped: true };
    }

    // Clamp to remaining daily budget
    const remaining = DAILY_TRADE_XP_CAP - todayTradeXP;
    const actualXP = Math.min(xpAmount, remaining);

    if (actualXP > 0) {
      try {
        await awardXP(userId, actualXP, "action", `trade_activity:${activity}`);
      } catch (err) {
        console.error(`[Activity XP] Error awarding trade XP:`, err);
      }
    }

    return { xpAwarded: actualXP, dailyXPUsed: todayTradeXP + actualXP, dailyCapped: todayTradeXP + actualXP >= DAILY_TRADE_XP_CAP };
  }

  // Competition/challenge XP is uncapped -- award directly
  try {
    await awardXP(userId, xpAmount, "competition", activity);
  } catch (err) {
    console.error(`[Activity XP] Error awarding ${activity} XP: ${err}`);
  }

  return { xpAwarded: xpAmount, dailyXPUsed: 0, dailyCapped: false };
}

/**
 * Get user's current level and XP
 * Always fetches title, icon, and description from database configuration
 */
export async function getUserLevel(userId: string) {
  await connectToDatabase();

  const userLevel = (await UserLevel.findOne({ userId }).lean()) as any;

  if (!userLevel) {
    // Get default level from database
    const titleLevel = await getTitleByXP(0);
    return {
      userId,
      currentXP: 0,
      currentLevel: 1,
      currentTitle: titleLevel.title,
      currentIcon: titleLevel.icon,
      currentDescription: titleLevel.description,
      currentColor: titleLevel.color,
      totalBadgesEarned: 0,
      lastXPGain: new Date(),
    };
  }

  // Get current level details from database configuration
  const titleLevel = await getTitleByXP(userLevel.currentXP || 0);

  return {
    ...userLevel,
    currentTitle: titleLevel.title, // ✅ From database
    currentIcon: titleLevel.icon, // ✅ From database
    currentDescription: titleLevel.description, // ✅ From database
    currentColor: titleLevel.color, // ✅ From database
    currentLevel: titleLevel.level, // ✅ From database
  };
}

/**
 * Recalculate user level based on badges
 */
export async function recalculateUserLevel(userId: string) {
  console.log(`🔄 [XP RECALC] Starting XP recalculation for user ${userId}`);
  await connectToDatabase();

  // Get all user badges
  const userBadges = await UserBadge.find({ userId }).lean();
  console.log(`🏅 [XP RECALC] Found ${userBadges.length} badges for user`);

  let totalXP = 0;

  // Calculate XP from all badges
  for (const userBadge of userBadges) {
    const badge = await BadgeConfig.findOne({
      id: userBadge.badgeId,
      isActive: true,
    }).lean();
    if (badge) {
      const xpValue = await getXPForBadge(badge.rarity); // ✅ Fetch from database
      totalXP += xpValue;
      console.log(
        `  ⭐ Badge: ${badge.name} (${badge.rarity}) = ${xpValue} XP`,
      );
    } else {
      console.warn(`  ⚠️ Badge ${userBadge.badgeId} not found in database`);
    }
  }

  console.log(`📊 [XP RECALC] Total XP calculated: ${totalXP}`);

  const titleLevel = await getTitleByXP(totalXP); // ✅ Fetch from database
  console.log(
    `👑 [XP RECALC] Title for ${totalXP} XP: ${titleLevel.title} (Level ${titleLevel.level})`,
  );

  // Update or create user level
  const userLevel = await UserLevel.findOneAndUpdate(
    { userId },
    {
      currentXP: totalXP,
      currentLevel: titleLevel.level,
      currentTitle: titleLevel.title, // ✅ From database
      totalBadgesEarned: userBadges.length,
    },
    { upsert: true, new: true },
  );

  console.log(`💾 [XP RECALC] UserLevel updated:`, {
    id: userLevel._id,
    currentXP: userLevel.currentXP,
    currentLevel: userLevel.currentLevel,
    currentTitle: userLevel.currentTitle,
    totalBadgesEarned: userLevel.totalBadgesEarned,
  });

  return userLevel;
}

/**
 * Get leaderboard with titles
 */
export async function getUsersWithTitles(userIds: string[]) {
  await connectToDatabase();

  const userLevels = await UserLevel.find({
    userId: { $in: userIds },
  }).lean();

  const levelMap = new Map(userLevels.map((ul) => [ul.userId, ul]));

  // Return map for easy lookup
  return levelMap;
}

/**
 * Ensure a UserLevel document exists for a user
 * Call this after registration or first deposit to ensure user appears in leaderboard
 */
export async function ensureUserLevel(userId: string): Promise<void> {
  await connectToDatabase();

  await UserLevel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
    { upsert: true }
  );
}

/**
 * Sync missing users - find all users with deposits but no UserLevel and create them
 * Returns count of users synced
 */
export async function syncMissingUserLevels(): Promise<{
  synced: number;
  evaluated: number;
  newBadgesAwarded: number;
}> {
  await connectToDatabase();

  const mongoose = await import("mongoose");
  const db = mongoose.default.connection.db;

  if (!db) {
    throw new Error("Database not connected");
  }

  console.log("🔄 [SYNC] Starting sync of missing user levels...");

  // Get all users who have made deposits
  const WalletTransaction = (
    await import("@/database/models/trading/wallet-transaction.model")
  ).default;
  const depositUserIds = await WalletTransaction.distinct("userId", {
    transactionType: "deposit",
    status: "completed",
  });

  console.log(
    `📊 [SYNC] Found ${depositUserIds.length} users with completed deposits`,
  );

  // Get all users who already have UserLevel
  const existingLevelUserIds = await UserLevel.distinct("userId");
  const existingSet = new Set(existingLevelUserIds);

  // Find users missing UserLevel
  const missingUserIds = depositUserIds.filter(
    (id: string) => !existingSet.has(id),
  );
  console.log(
    `⚠️ [SYNC] Found ${missingUserIds.length} users missing UserLevel`,
  );

  let synced = 0;
  let evaluated = 0;
  let newBadgesAwarded = 0;

  // Import badge evaluation
  const { evaluateUserBadges } =
    await import("@/lib/services/badge-evaluation.service");

  for (const userId of missingUserIds) {
    try {
      // Reason: Atomic upsert handles edge case where another process created the document between our distinct() query and this insert.
      await UserLevel.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
        { upsert: true }
      );
      synced++;
      console.log(`✅ [SYNC] Created UserLevel for user ${userId}`);

      // Run badge evaluation
      const result = await evaluateUserBadges(userId);
      evaluated++;
      newBadgesAwarded += result.newBadges.length;

      if (result.newBadges.length > 0) {
        console.log(
          `🏅 [SYNC] User ${userId} earned ${result.newBadges.length} badges`,
        );
      }
    } catch (error) {
      console.error(`❌ [SYNC] Error syncing user ${userId}:`, error);
    }
  }

  console.log(
    `✅ [SYNC] Complete: ${synced} users synced, ${evaluated} evaluated, ${newBadgesAwarded} badges awarded`,
  );

  return { synced, evaluated, newBadgesAwarded };
}
