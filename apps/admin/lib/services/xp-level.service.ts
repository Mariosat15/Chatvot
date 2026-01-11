'use server';

import { connectToDatabase } from '@/database/mongoose';
import UserLevel from '@/database/models/user-level.model';
import UserBadge from '@/database/models/user-badge.model';
import BadgeConfig from '@/database/models/badge-config.model';
import { getTitleByXP, getXPForBadge } from '@/lib/services/xp-config.service';

/**
 * Award XP to user for earning a badge
 */
export async function awardXPForBadge(userId: string, badgeId: string): Promise<{
  xpGained: number;
  newXP: number;
  newLevel: number;
  newTitle: string;
  leveledUp: boolean;
  oldLevel?: number;
  oldTitle?: string;
}> {
  console.log(`💫 [XP AWARD] Starting XP award for user ${userId}, badge ${badgeId}`);
  await connectToDatabase();

  // Find the badge to get rarity from database
  const badge = await BadgeConfig.findOne({ id: badgeId, isActive: true }).lean();
  if (!badge) {
    console.error(`❌ [XP AWARD] Badge ${badgeId} not found in database`);
    throw new Error('Badge not found');
  }
  console.log(`🏅 [XP AWARD] Badge found: ${badge.name}, rarity: ${badge.rarity}`);

  const xpGained = await getXPForBadge(badge.rarity);
  console.log(`⭐ [XP AWARD] XP to be gained: ${xpGained}`);

  // Get or create user level
  let userLevel = await UserLevel.findOne({ userId });

  if (!userLevel) {
    console.log(`📝 [XP AWARD] Creating new UserLevel document for user ${userId}`);
    userLevel = await UserLevel.create({
      userId,
      currentXP: 0,
      currentLevel: 1,
      currentTitle: 'Novice Trader',
      totalBadgesEarned: 0,
    });
    console.log(`✅ [XP AWARD] UserLevel created:`, userLevel._id);
  } else {
    console.log(`📊 [XP AWARD] Current user stats: XP=${userLevel.currentXP}, Level=${userLevel.currentLevel}, Badges=${userLevel.totalBadgesEarned}`);
  }

  const oldXP = userLevel.currentXP;
  const oldLevel = userLevel.currentLevel;
  const oldTitle = userLevel.currentTitle;

  // Add XP
  const newXP = oldXP + xpGained;
  console.log(`📈 [XP AWARD] XP progression: ${oldXP} → ${newXP} (+${xpGained})`);
  
  const newTitleLevel = await getTitleByXP(newXP); // ✅ Fetch from database
  console.log(`👑 [XP AWARD] New title level: ${newTitleLevel.title} (Level ${newTitleLevel.level})`);

  const leveledUp = newTitleLevel.level > oldLevel;
  if (leveledUp) {
    console.log(`🎉 [XP AWARD] LEVEL UP! ${oldLevel} → ${newTitleLevel.level}`);
  }

  // Update user level with database values
  userLevel.currentXP = newXP;
  userLevel.currentLevel = newTitleLevel.level;
  userLevel.currentTitle = newTitleLevel.title;  // ✅ From database
  userLevel.totalBadgesEarned += 1;
  userLevel.lastXPGain = new Date();

  // Add to XP history
  userLevel.xpHistory.push({
    amount: xpGained,
    source: 'badge',
    badgeId,
    timestamp: new Date(),
  });
  console.log(`📜 [XP AWARD] XP history updated (${userLevel.xpHistory.length} entries)`);

  const savedLevel = await userLevel.save();
  console.log(`💾 [XP AWARD] UserLevel saved successfully:`, savedLevel._id);
  console.log(`✅ [XP AWARD] Final state: XP=${savedLevel.currentXP}, Level=${savedLevel.currentLevel}, Title=${savedLevel.currentTitle}, Badges=${savedLevel.totalBadgesEarned}`);

  // Send level up notification if user leveled up
  if (leveledUp) {
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.notifyLevelUp(userId, newTitleLevel.level, newTitleLevel.title);
      console.log(`🔔 [XP AWARD] Level up notification sent for level ${newTitleLevel.level}`);
    } catch (error) {
      console.error(`❌ [XP AWARD] Error sending level up notification:`, error);
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
 * Get user's current level and XP
 * Always fetches title, icon, and description from database configuration
 */
export async function getUserLevel(userId: string) {
  await connectToDatabase();

  const userLevel = await UserLevel.findOne({ userId }).lean() as any;

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
    currentTitle: titleLevel.title,        // ✅ From database
    currentIcon: titleLevel.icon,          // ✅ From database
    currentDescription: titleLevel.description, // ✅ From database
    currentColor: titleLevel.color,        // ✅ From database
    currentLevel: titleLevel.level,        // ✅ From database
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
    const badge = await BadgeConfig.findOne({ id: userBadge.badgeId, isActive: true }).lean();
    if (badge) {
      const xpValue = await getXPForBadge(badge.rarity); // ✅ Fetch from database
      totalXP += xpValue;
      console.log(`  ⭐ Badge: ${badge.name} (${badge.rarity}) = ${xpValue} XP`);
    } else {
      console.warn(`  ⚠️ Badge ${userBadge.badgeId} not found in database`);
    }
  }

  console.log(`📊 [XP RECALC] Total XP calculated: ${totalXP}`);

  const titleLevel = await getTitleByXP(totalXP); // ✅ Fetch from database
  console.log(`👑 [XP RECALC] Title for ${totalXP} XP: ${titleLevel.title} (Level ${titleLevel.level})`);

  // Update or create user level
  const userLevel = await UserLevel.findOneAndUpdate(
    { userId },
    {
      currentXP: totalXP,
      currentLevel: titleLevel.level,
      currentTitle: titleLevel.title, // ✅ From database
      totalBadgesEarned: userBadges.length,
    },
    { upsert: true, new: true }
  );

  console.log(`💾 [XP RECALC] UserLevel updated:`, {
    id: userLevel._id,
    currentXP: userLevel.currentXP,
    currentLevel: userLevel.currentLevel,
    currentTitle: userLevel.currentTitle,
    totalBadgesEarned: userLevel.totalBadgesEarned
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

  const levelMap = new Map(
    userLevels.map(ul => [ul.userId, ul])
  );

  // Return map for easy lookup
  return levelMap;
}

/**
 * Ensure a UserLevel document exists for a user
 * Call this after registration or first deposit to ensure user appears in leaderboard
 */
export async function ensureUserLevel(userId: string): Promise<void> {
  await connectToDatabase();
  
  const existing = await UserLevel.findOne({ userId });
  if (!existing) {
    console.log(`📝 [USER LEVEL] Creating UserLevel for user ${userId}`);
    await UserLevel.create({
      userId,
      currentXP: 0,
      currentLevel: 1,
      currentTitle: 'Novice Trader',
      totalBadgesEarned: 0,
    });
  }
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
  
  const mongoose = await import('mongoose');
  const db = mongoose.default.connection.db;
  
  if (!db) {
    throw new Error('Database not connected');
  }
  
  console.log('🔄 [SYNC] Starting sync of missing user levels...');
  
  // Get all users who have made deposits
  const WalletTransaction = (await import('@/database/models/trading/wallet-transaction.model')).default;
  const depositUserIds = await WalletTransaction.distinct('userId', { 
    transactionType: 'deposit', 
    status: 'completed' 
  });
  
  console.log(`📊 [SYNC] Found ${depositUserIds.length} users with completed deposits`);
  
  // Get all users who already have UserLevel
  const existingLevelUserIds = await UserLevel.distinct('userId');
  const existingSet = new Set(existingLevelUserIds);
  
  // Find users missing UserLevel
  const missingUserIds = depositUserIds.filter((id: string) => !existingSet.has(id));
  console.log(`⚠️ [SYNC] Found ${missingUserIds.length} users missing UserLevel`);
  
  let synced = 0;
  let evaluated = 0;
  let newBadgesAwarded = 0;
  
  // Import badge evaluation
  const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
  
  for (const userId of missingUserIds) {
    try {
      // Create UserLevel
      await UserLevel.create({
        userId,
        currentXP: 0,
        currentLevel: 1,
        currentTitle: 'Novice Trader',
        totalBadgesEarned: 0,
      });
      synced++;
      console.log(`✅ [SYNC] Created UserLevel for user ${userId}`);
      
      // Run badge evaluation
      const result = await evaluateUserBadges(userId);
      evaluated++;
      newBadgesAwarded += result.newBadges.length;
      
      if (result.newBadges.length > 0) {
        console.log(`🏅 [SYNC] User ${userId} earned ${result.newBadges.length} badges`);
      }
    } catch (error) {
      console.error(`❌ [SYNC] Error syncing user ${userId}:`, error);
    }
  }
  
  console.log(`✅ [SYNC] Complete: ${synced} users synced, ${evaluated} evaluated, ${newBadgesAwarded} badges awarded`);
  
  return { synced, evaluated, newBadgesAwarded };
}

