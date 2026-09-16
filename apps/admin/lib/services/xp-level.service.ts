"use server";

import { connectToDatabase } from "@/database/mongoose";
import UserLevel from "@/database/models/user-level.model";
import UserBadge from "@/database/models/user-badge.model";
import BadgeConfig from "@/database/models/badge-config.model";
import { getTitleByXP, getXPForBadge } from "@/lib/services/xp-config.service";
import { gameKeyForBadgeXp } from "@/lib/services/games/badge-game-scope";

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
  // Reason (X7 step 4): stamp gameKey so XP can be attributed without recomputing.
  const badgeGameKey = gameKeyForBadgeXp(
    (badge as { gameTypes?: string[] }).gameTypes,
  );
  userLevel.xpHistory.push({
    amount: xpGained,
    source: "badge",
    badgeId,
    timestamp: new Date(),
    ...(badgeGameKey ? { gameKey: badgeGameKey } : {}),
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
 * The sourceId prefix every trade-activity award is written under, and the prefix the daily
 * cap matches on to find today's trade XP.
 *
 * Reason: one definition, because the writer and the reader must agree for the cap to apply
 * at all, and when they disagreed the cap did not fail - it silently admitted everything
 * (risk R95). A second literal would reinstate that, and the symptom is no symptom.
 */
export const TRADE_ACTIVITY_SOURCE_PREFIX = "trade_activity:";

/**
 * The fields the daily cap reads off one stored `xpHistory` row.
 *
 * Reason: deliberately the fields this file READS and not a restatement of the schema. A
 * hand-written interface the compiler checks instead of the schema is exactly where a field
 * that does not exist looks real, which is where the missing `participant.score` read hid
 * for a day (R32/R33) - so `source` and `sourceId` are optional here, because `sourceId` was
 * undeclared until R97 and every row written before that genuinely has none.
 */
interface XPHistoryEntry {
  timestamp: Date | string;
  amount?: number;
  source?: string;
  sourceId?: string;
}

/**
 * Award XP to user from any source (milestone, action, etc.)
 * This is a generic XP award function, separate from badge XP
 */
export async function awardXP(
  userId: string,
  amount: number,
  source: "milestone" | "action" | "competition" | "referral" | "bonus" | "other",
  sourceId?: string,
  gameKey?: string
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
    gameKey,
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

export async function awardActivityXP(
  userId: string,
  activity: "trade_completed" | "winning_trade" | "competition_completed" | "competition_podium_1" | "competition_podium_2" | "competition_podium_3" | "challenge_completed" | "challenge_won",
  gameKey?: string,
): Promise<{ xpAwarded: number; dailyXPUsed: number; dailyCapped: boolean }> {
  await connectToDatabase();

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

  const DAILY_TRADE_XP_CAP = 100;

  // Reason: `activity` is a closed union, not caller-supplied text, so the lookup is total
  // and the rule is a false positive here. Silenced in place rather than by rewriting the
  // table, because the pre-commit hook lints staged files at --max-warnings=0 and this file
  // has to be staged for the R95/R97 fix above.
  // eslint-disable-next-line security/detect-object-injection
  const xpAmount = XP_AMOUNTS[activity] || 0;
  if (xpAmount <= 0) return { xpAwarded: 0, dailyXPUsed: 0, dailyCapped: false };

  const isTradeActivity = activity === "trade_completed" || activity === "winning_trade";

  if (isTradeActivity) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const userLevel = await UserLevel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, currentXP: 0, currentLevel: 1, currentTitle: "Novice Trader", totalBadgesEarned: 0 } },
      { upsert: true, new: true }
    );

    // Reason: risk R95. This filter used to test `h.source === "trade_activity"`, a value
    // nothing has ever written - the award below calls `awardXP` with source `"action"` and
    // puts `trade_activity:` in the sourceId - so the total was always 0 and the daily cap
    // never applied to anybody. Matching on the sourceId instead would ALSO have failed
    // until now, because the schema did not declare that field and strict mode discarded
    // it (R97). The two defects are one item and are fixed together.
    const todayTradeXP = (userLevel.xpHistory || [])
      .filter((h: XPHistoryEntry) => {
        const ts = new Date(h.timestamp);
        return (
          ts >= today &&
          h.source === "action" &&
          String(h.sourceId ?? "").startsWith(TRADE_ACTIVITY_SOURCE_PREFIX)
        );
      })
      .reduce((sum: number, h: XPHistoryEntry) => sum + (h.amount || 0), 0);

    if (todayTradeXP >= DAILY_TRADE_XP_CAP) {
      return { xpAwarded: 0, dailyXPUsed: todayTradeXP, dailyCapped: true };
    }

    const remaining = DAILY_TRADE_XP_CAP - todayTradeXP;
    const actualXP = Math.min(xpAmount, remaining);

    if (actualXP > 0) {
      try {
        await awardXP(
          userId,
          actualXP,
          "action",
          `${TRADE_ACTIVITY_SOURCE_PREFIX}${activity}`,
          gameKey,
        );
      } catch (err) {
        console.error(`[Activity XP] Error awarding trade XP:`, err);
      }
    }

    return { xpAwarded: actualXP, dailyXPUsed: todayTradeXP + actualXP, dailyCapped: todayTradeXP + actualXP >= DAILY_TRADE_XP_CAP };
  }

  try {
    await awardXP(userId, xpAmount, "competition", activity, gameKey);
  } catch (err) {
    console.error(`[Activity XP] Error awarding ${activity} XP: ${err}`);
  }

  return { xpAwarded: xpAmount, dailyXPUsed: 0, dailyCapped: false };
}

/**
 * Sum xpHistory amounts by gameKey (X7 step 4). Entries without a gameKey are
 * bucketed under `"_unscoped"` — platform awards, never reassigned to trading.
 */
export function sumXpByGameKey(
  xpHistory: Array<{ amount?: number; gameKey?: string }> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(xpHistory)) return out;
  for (const row of xpHistory) {
    const key =
      typeof row.gameKey === "string" && row.gameKey.trim()
        ? row.gameKey.trim()
        : "_unscoped";
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    out[key] = (out[key] || 0) + amount;
  }
  return out;
}

/**
 * Get user's current level and XP
 * Always fetches title, icon, and description from database configuration
 */
export async function getUserLevel(userId: string) {
  await connectToDatabase();

  // Reason: left as `any` rather than given a hand-written generic. An explicitly-typed
  // `.lean<{...}>()` makes the compiler check the invented shape instead of the schema, which
  // is where the missing `participant.score` read survived a clean typecheck (R32/R33). A
  // narrowing pass here belongs with X7's stats work, not with a reward-stage extraction
  // whose whole claim is that nothing moved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // Reason (X7 step 4): empty history → empty attribution map, never invent trading.
      xpByGameKey: {},
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
    xpByGameKey: sumXpByGameKey(userLevel.xpHistory),
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
