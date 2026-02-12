"use server";

import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import JourneyMilestone, { IJourneyMilestone, IMilestoneCondition } from "@/database/models/journey-milestone.model";
import UserJourneyProgress, { IUserJourneyProgress } from "@/database/models/user-journey-progress.model";
import { awardXPForBadge } from "@/lib/services/xp-level.service";

/**
 * Initialize journey progress for a new user
 */
export async function initializeUserJourney(
  userId: string,
  mapId: string = "traders_journey"
): Promise<IUserJourneyProgress> {
  console.log(`🗺️ [JOURNEY] Initializing journey for user ${userId}`);
  await connectToDatabase();

  // Check if progress already exists
  const existing = await UserJourneyProgress.findOne({ userId, mapId });
  if (existing) {
    console.log(`ℹ️ [JOURNEY] User ${userId} already has journey progress`);
    return existing;
  }

  // Get the map config for default start node
  const mapConfig = await JourneyMapConfig.findOne({ mapId, isActive: true }).lean();
  const startNode = mapConfig?.defaultStartNode || "account_created";

  // Get the start milestone to auto-complete it
  const startMilestone = await JourneyMilestone.findOne({ 
    id: startNode, 
    mapId, 
    isActive: true 
  }).lean();

  // Create new progress
  const progress = await UserJourneyProgress.create({
    userId,
    mapId,
    currentZone: startMilestone?.zoneId || "starting_dock",
    currentMilestone: startNode,
    completedMilestones: startMilestone?.isAutoComplete ? [{
      milestoneId: startNode,
      completedAt: new Date(),
      rewards: { xp: startMilestone?.rewards?.xp || 0 },
    }] : [],
    unlockedMilestones: [startNode, ...(startMilestone?.connectedTo || [])],
    totalXPFromJourney: startMilestone?.isAutoComplete ? (startMilestone?.rewards?.xp || 0) : 0,
    totalMilestonesCompleted: startMilestone?.isAutoComplete ? 1 : 0,
    journeyStartedAt: new Date(),
    lastProgressAt: new Date(),
  });

  console.log(`✅ [JOURNEY] Journey initialized for user ${userId}`);
  return progress;
}

/**
 * Quick sync to unlock milestones - STRICTLY SEQUENTIAL by ORDER
 * Only ONE milestone is unlocked at a time (the next one by order number)
 * Auto-completes milestones with always-true conditions (account_created)
 * This is FAST and safe to run on every page load
 */
export async function quickSyncUnlocks(
  userId: string,
  mapId: string = "traders_journey"
): Promise<void> {
  await connectToDatabase();

  const progress = await UserJourneyProgress.findOne({ userId, mapId });
  if (!progress) return;

  // Get all milestones sorted by order for STRICTLY sequential progression
  const allMilestones = await JourneyMilestone.find({ mapId, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  const completedIds = new Set(progress.completedMilestones.map(m => m.milestoneId));
  let hasChanges = false;

  // STRICTLY SEQUENTIAL: Only ONE milestone unlocked at a time
  // Find the FIRST milestone (by order) that is NOT completed - that's the only one that should be unlocked
  let nextMilestoneToUnlock: typeof allMilestones[0] | null = null;
  
  for (const milestone of allMilestones) {
    if (!completedIds.has(milestone.id)) {
      nextMilestoneToUnlock = milestone;
      break; // Found the first uncompleted milestone by order
    }
  }

  // The ONLY unlocked milestone should be the next one in sequence
  const newUnlockedIds = new Set<string>();
  if (nextMilestoneToUnlock) {
    newUnlockedIds.add(nextMilestoneToUnlock.id);
  }

  // Check if unlocked list needs updating
  const currentUnlocked = new Set(progress.unlockedMilestones);
  const needsUpdate = newUnlockedIds.size !== currentUnlocked.size || 
    ![...newUnlockedIds].every(id => currentUnlocked.has(id));
  
  if (needsUpdate) {
    progress.unlockedMilestones = [...newUnlockedIds];
    hasChanges = true;
  }

  // Auto-complete milestones with always-true conditions
  const alwaysTrueConditions = ["account_created"];
  
  if (nextMilestoneToUnlock && 
      nextMilestoneToUnlock.completeCondition && 
      alwaysTrueConditions.includes(nextMilestoneToUnlock.completeCondition.type)) {
    // Complete this milestone
    progress.completedMilestones.push({
      milestoneId: nextMilestoneToUnlock.id,
      completedAt: new Date(),
      rewards: {
        xp: nextMilestoneToUnlock.rewards?.xp || 0,
        badgeId: nextMilestoneToUnlock.rewards?.badgeId,
        title: nextMilestoneToUnlock.rewards?.title,
      },
    });
    completedIds.add(nextMilestoneToUnlock.id);
    progress.totalXPFromJourney = (progress.totalXPFromJourney || 0) + (nextMilestoneToUnlock.rewards?.xp || 0);
    progress.totalMilestonesCompleted = (progress.totalMilestonesCompleted || 0) + 1;
    progress.lastProgressAt = new Date();
    hasChanges = true;

    // Find the NEXT milestone after this one
    const nextOrder = (nextMilestoneToUnlock.order || 0) + 1;
    const nextAfterCompletion = allMilestones.find(m => (m.order || 0) >= nextOrder && !completedIds.has(m.id));
    
    if (nextAfterCompletion) {
      progress.unlockedMilestones = [nextAfterCompletion.id];
      progress.currentMilestone = nextAfterCompletion.id;
      progress.currentZone = nextAfterCompletion.zoneId;
    } else {
      progress.unlockedMilestones = [];
    }
  } else if (nextMilestoneToUnlock) {
    progress.currentMilestone = nextMilestoneToUnlock.id;
    progress.currentZone = nextMilestoneToUnlock.zoneId;
  }

  if (hasChanges) {
    await progress.save();
    console.log(`✅ [JOURNEY] Quick sync completed for user ${userId} - current: ${progress.currentMilestone}`);
  }
}

/**
 * Get user's journey progress with full milestone details
 * Runs a FAST sync to ensure basic unlocks are in place (start nodes, completed prerequisites)
 */
export async function getUserJourneyProgress(
  userId: string,
  mapId: string = "traders_journey"
): Promise<{
  progress: IUserJourneyProgress | null;
  mapConfig: any;
  milestones: IJourneyMilestone[];
  completedIds: string[];
  unlockedIds: string[];
}> {
  await connectToDatabase();

  // Get or initialize progress
  let progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
  
  if (!progress) {
    progress = await initializeUserJourney(userId, mapId);
    progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
  }

  // Quick sync to ensure basic unlocks are in place (fast, no stats gathering)
  await quickSyncUnlocks(userId, mapId);
  // Refresh progress after sync
  progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();

  // Get map config
  const mapConfig = await JourneyMapConfig.findOne({ mapId, isActive: true }).lean();

  // Get all milestones for the map
  const milestones = await JourneyMilestone.find({ 
    mapId, 
    isActive: true 
  }).sort({ order: 1 }).lean();

  const completedIds = progress?.completedMilestones?.map(m => m.milestoneId) || [];
  const unlockedIds = progress?.unlockedMilestones || [];

  return {
    progress: progress as IUserJourneyProgress | null,
    mapConfig,
    milestones: milestones as IJourneyMilestone[],
    completedIds,
    unlockedIds,
  };
}

/**
 * Check if a milestone condition is met based on user stats
 * @param userId - The user ID to check
 * @param condition - The condition to evaluate
 * @param preloadedStats - Optional pre-gathered stats to avoid repeated DB queries
 */
export async function checkConditionMet(
  userId: string,
  condition: IMilestoneCondition,
  preloadedStats?: Record<string, any>
): Promise<{ met: boolean; currentValue?: number }> {
  await connectToDatabase();

  const { type, value, comparison = "gte" } = condition;

  // Use preloaded stats if provided, otherwise gather them
  let stats: Record<string, any>;
  if (preloadedStats) {
    stats = preloadedStats;
  } else {
    const { gatherUserStats } = await import("@/lib/services/badge-evaluation.service");
    stats = await gatherUserStats(userId);
  }

  let currentValue: number | undefined;

  // Map condition types to user stats
  switch (type) {
    // ============================================
    // Account & Setup
    // ============================================
    case "account_created":
      return { met: true, currentValue: 1 };

    case "first_deposit":
    case "has_deposit":
      // totalDeposited is the amount, > 0 means at least one deposit
      currentValue = (stats.totalDeposited || 0) > 0 ? 1 : 0;
      break;

    case "kyc_verified":
      // Check actual KYC status from CreditWallet (where KYC data is stored)
      if (stats.kycVerified !== undefined) {
        currentValue = stats.kycVerified ? 1 : 0;
      } else {
        const CreditWallet = (await import("@/database/models/trading/credit-wallet.model")).default;
        const wallet = await CreditWallet.findOne({ userId }).lean();
        currentValue = (wallet as any)?.kycVerified || (wallet as any)?.kycStatus === "approved" ? 1 : 0;
      }
      break;

    case "profile_complete":
      // Check if user has profile data (stored in CreditWallet or has activity)
      if (stats.profileComplete !== undefined) {
        currentValue = stats.profileComplete ? 1 : 0;
      } else {
        // Profile is considered complete if user has made any activity
        const CreditWalletModel = (await import("@/database/models/trading/credit-wallet.model")).default;
        const walletProfile = await CreditWalletModel.findOne({ userId }).lean();
        // Has profile if wallet exists with any deposits or activity
        const isComplete = !!(walletProfile && ((walletProfile as any).totalDeposited > 0 || (walletProfile as any).creditBalance > 0));
        currentValue = isComplete ? 1 : 0;
      }
      break;

    // ============================================
    // Trading Activity
    // ============================================
    case "total_deposits":
    case "total_deposited":
      // Total amount deposited
      currentValue = stats.totalDeposited || 0;
      break;

    case "first_trade":
    case "total_trades":
      currentValue = stats.totalTrades || 0;
      break;

    case "winning_trades":
      currentValue = stats.winningTrades || 0;
      break;

    case "losing_trades":
      currentValue = stats.losingTrades || 0;
      break;

    case "trades_today":
      currentValue = stats.tradesToday || stats.maxTradesInOneDay || 0;
      break;

    case "trades_this_week":
      currentValue = stats.tradesThisWeek || stats.maxTradesInOneWeek || 0;
      break;

    case "trades_this_month":
      currentValue = stats.tradesThisMonth || stats.maxTradesInOneMonth || 0;
      break;

    case "consecutive_trading_days":
      currentValue = stats.consecutiveTradingDays || 0;
      break;

    case "different_assets_traded":
    case "unique_pairs_traded":
      currentValue = stats.uniquePairsTraded || stats.differentAssetsTraded || 0;
      break;

    // ============================================
    // Performance
    // ============================================
    case "win_rate":
      currentValue = stats.winRate || 0;
      break;

    case "win_streak":
      currentValue = stats.currentWinStreak || stats.maxWinStreak || 0;
      break;

    case "max_win_streak":
      currentValue = stats.maxWinStreak || 0;
      break;

    case "total_pnl_positive":
      return { met: (stats.totalPnl || 0) > 0, currentValue: stats.totalPnl || 0 };

    case "total_pnl":
      currentValue = stats.totalPnl || 0;
      break;

    case "profit_factor":
      currentValue = stats.profitFactor || 0;
      break;

    case "best_trade_pnl":
    case "best_single_trade":
      currentValue = stats.bestSingleTrade || stats.bestTradePnl || 0;
      break;

    case "average_trade_pnl":
    case "average_win":
      currentValue = stats.averageWin || stats.averageTradePnl || 0;
      break;

    case "risk_reward_ratio":
      // Average win / Average loss
      const avgWin = stats.averageWin || 0;
      const avgLoss = stats.averageLoss || 1;
      currentValue = avgLoss > 0 ? avgWin / avgLoss : 0;
      break;

    // ============================================
    // Competitions
    // ============================================
    case "competitions_entered":
      currentValue = stats.competitionsEntered || 0;
      break;

    case "competitions_completed":
      currentValue = stats.completedCompetitions || stats.competitionsCompleted || 0;
      break;

    case "first_place_finishes":
      currentValue = stats.firstPlaceFinishes || 0;
      break;

    case "second_place_finishes":
      currentValue = stats.secondPlaceFinishes || 0;
      break;

    case "third_place_finishes":
      currentValue = stats.thirdPlaceFinishes || 0;
      break;

    case "podium_finishes":
      currentValue = stats.podiumFinishes || 0;
      break;

    case "top_10_finishes":
      currentValue = stats.top10Finishes || 0;
      break;

    case "top_50_percent_finishes":
      currentValue = stats.top50PercentFinishes || 0;
      break;

    case "competition_pnl":
      currentValue = stats.competitionPnl || 0;
      break;

    // ============================================
    // Progression & XP
    // ============================================
    case "level_reached":
      const UserLevelModel = (await import("@/database/models/user-level.model")).default;
      const level = await UserLevelModel.findOne({ userId }).lean();
      currentValue = (level as any)?.currentLevel || 1;
      break;

    case "xp_threshold":
      const UserLevel = (await import("@/database/models/user-level.model")).default;
      const userLevel = await UserLevel.findOne({ userId }).lean();
      currentValue = (userLevel as any)?.currentXP || 0;
      break;

    case "xp_earned_today":
      currentValue = stats.xpEarnedToday || 0;
      break;

    case "xp_earned_this_week":
      currentValue = stats.xpEarnedThisWeek || 0;
      break;

    case "total_badges":
      const UserBadgeCount = (await import("@/database/models/user-badge.model")).default;
      const badgeCount = await UserBadgeCount.countDocuments({ userId });
      currentValue = badgeCount;
      break;

    case "badge_earned":
      // Check if user has earned a specific badge
      if (condition.badgeId) {
        const UserBadge = (await import("@/database/models/user-badge.model")).default;
        // PERF: .lean() for read-only check
        const badge = await UserBadge.findOne({ userId, badgeId: condition.badgeId }).lean();
        return { met: !!badge, currentValue: badge ? 1 : 0 };
      }
      return { met: false };

    case "milestone_complete":
      // Check if user has completed a specific milestone
      if (condition.milestoneId) {
        const progress = await UserJourneyProgress.findOne({ userId }).lean();
        const isComplete = progress?.completedMilestones?.some(
          m => m.milestoneId === condition.milestoneId
        );
        return { met: !!isComplete, currentValue: isComplete ? 1 : 0 };
      }
      return { met: false };

    // ============================================
    // Social & Community
    // ============================================
    case "referrals_made":
      if (stats.referralsMade !== undefined) {
        currentValue = stats.referralsMade;
      } else {
        // Count actual referrals from database (Game Master referrals)
        const UserReferral = (await import("@/database/models/user-referral.model")).default;
        currentValue = await UserReferral.countDocuments({ gameMasterId: userId });
      }
      break;

    case "referrals_active":
      if (stats.referralsActive !== undefined) {
        currentValue = stats.referralsActive;
      } else {
        // Count active referrals (users who have entered competitions)
        const UserReferralActive = (await import("@/database/models/user-referral.model")).default;
        currentValue = await UserReferralActive.countDocuments({ 
          gameMasterId: userId,
          isActive: true,
          competitionsEntered: { $gt: 0 }
        });
      }
      break;

    case "friends_added":
      currentValue = stats.friendsAdded || 0;
      break;

    case "messages_sent":
      currentValue = stats.messagesSent || 0;
      break;

    // ============================================
    // Risk Management
    // ============================================
    case "stop_loss_used":
    case "always_uses_sl":
      // alwaysUsesSL is boolean - convert to 1/0
      currentValue = stats.alwaysUsesSL ? 1 : (stats.stopLossUsed || 0);
      break;

    case "take_profit_used":
    case "always_uses_tp":
      // alwaysUsesTP is boolean - convert to 1/0
      currentValue = stats.alwaysUsesTP ? 1 : (stats.takeProfitUsed || 0);
      break;

    case "max_drawdown_under":
      // For "under" conditions, we check if current is LESS than target
      currentValue = stats.maxDrawdown || 0;
      return { 
        met: value !== undefined && currentValue <= value, 
        currentValue 
      };

    case "position_size_under":
      currentValue = stats.maxPositionSize || 0;
      return { 
        met: value !== undefined && currentValue <= value, 
        currentValue 
      };

    // ============================================
    // Time-based
    // ============================================
    case "account_age_days":
    case "account_age":
      currentValue = stats.accountAge || stats.accountAgeDays || 0;
      break;

    case "active_days":
    case "active_trading_days":
      currentValue = stats.consecutiveTradingDays || stats.activeTradingDays || 0;
      break;

    case "login_streak":
      currentValue = stats.loginStreak || stats.consecutiveTradingDays || 0;
      break;

    case "consecutive_profitable_days":
      currentValue = stats.consecutiveProfitableDays || 0;
      break;

    default:
      console.warn(`⚠️ [JOURNEY] Unknown condition type: ${type}`);
      return { met: false };
  }

  // Apply comparison
  if (value === undefined) {
    return { met: currentValue !== undefined && currentValue > 0, currentValue };
  }

  let met = false;
  switch (comparison) {
    case "gte":
      met = currentValue !== undefined && currentValue >= value;
      break;
    case "gt":
      met = currentValue !== undefined && currentValue > value;
      break;
    case "lte":
      met = currentValue !== undefined && currentValue <= value;
      break;
    case "lt":
      met = currentValue !== undefined && currentValue < value;
      break;
    case "eq":
      met = currentValue !== undefined && currentValue === value;
      break;
  }

  return { met, currentValue };
}

/**
 * Check if a specific milestone can be completed
 * @param preloadedStats - Optional pre-gathered stats to avoid repeated DB queries
 */
export async function checkMilestoneCompletion(
  userId: string,
  milestoneId: string,
  mapId: string = "traders_journey",
  preloadedStats?: Record<string, any>
): Promise<{
  canComplete: boolean;
  isCompleted: boolean;
  isUnlocked: boolean;
  canUnlock: boolean;
  currentValue?: number;
  targetValue?: number;
}> {
  await connectToDatabase();

  // Get user's progress
  const progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
  
  // Check if already completed
  const isCompleted = progress?.completedMilestones?.some(m => m.milestoneId === milestoneId) || false;
  if (isCompleted) {
    return { canComplete: false, isCompleted: true, isUnlocked: true, canUnlock: true };
  }

  // Get milestone
  const milestone = await JourneyMilestone.findOne({ id: milestoneId, mapId, isActive: true }).lean();
  if (!milestone) {
    return { canComplete: false, isCompleted: false, isUnlocked: false, canUnlock: false };
  }

  // Check if unlocked
  const isUnlocked = progress?.unlockedMilestones?.includes(milestoneId) || false;
  
  // Check if can be unlocked (for display purposes)
  let canUnlock = isUnlocked;
  if (!isUnlocked && milestone.unlockCondition) {
    const { met } = await checkConditionMet(userId, milestone.unlockCondition, preloadedStats);
    canUnlock = met;
  }
  
  // If not unlocked, can't complete
  if (!isUnlocked) {
    return { canComplete: false, isCompleted: false, isUnlocked: false, canUnlock };
  }

  // Check completion condition
  const { met, currentValue } = await checkConditionMet(userId, milestone.completeCondition, preloadedStats);

  return {
    canComplete: met,
    isCompleted: false,
    isUnlocked: true,
    canUnlock: true,
    currentValue,
    targetValue: milestone.completeCondition.value,
  };
}

/**
 * Complete a milestone and award rewards
 */
export async function completeMilestone(
  userId: string,
  milestoneId: string,
  mapId: string = "traders_journey"
): Promise<{
  success: boolean;
  message: string;
  rewards?: { xp: number; badgeId?: string };
  newUnlocks?: string[];
  leveledUp?: boolean;
}> {
  console.log(`🎯 [JOURNEY] Attempting to complete milestone ${milestoneId} for user ${userId}`);
  await connectToDatabase();

  // Check if can complete
  const { canComplete, isCompleted } = await checkMilestoneCompletion(userId, milestoneId, mapId);

  if (isCompleted) {
    return { success: false, message: "Milestone already completed" };
  }

  if (!canComplete) {
    return { success: false, message: "Milestone requirements not met" };
  }

  // Get milestone details
  const milestone = await JourneyMilestone.findOne({ id: milestoneId, mapId, isActive: true }).lean();
  if (!milestone) {
    return { success: false, message: "Milestone not found" };
  }

  // Update user progress
  const progress = await UserJourneyProgress.findOne({ userId, mapId });
  if (!progress) {
    return { success: false, message: "Journey not initialized" };
  }

  // Add to completed milestones
  progress.completedMilestones.push({
    milestoneId,
    completedAt: new Date(),
    rewards: {
      xp: milestone.rewards.xp,
      badgeId: milestone.rewards.badgeId,
      title: milestone.rewards.title,
    },
  });

  // STRICTLY SEQUENTIAL: Find and unlock ONLY the next milestone by order
  const allMilestones = await JourneyMilestone.find({ mapId, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  const completedIds = new Set(progress.completedMilestones.map(m => m.milestoneId));
  completedIds.add(milestoneId); // Include the one we just completed
  
  // Find the NEXT uncompleted milestone by order
  const newUnlocks: string[] = [];
  let nextMilestone = null;
  
  for (const m of allMilestones) {
    if (!completedIds.has(m.id)) {
      nextMilestone = m;
      break;
    }
  }
  
  // Clear unlocked list and set only the next milestone
  progress.unlockedMilestones = [];
  if (nextMilestone) {
    progress.unlockedMilestones = [nextMilestone.id];
    newUnlocks.push(nextMilestone.id);
    progress.currentMilestone = nextMilestone.id;
    progress.currentZone = nextMilestone.zoneId;
  }

  // Update stats
  progress.totalXPFromJourney += milestone.rewards.xp;
  progress.totalMilestonesCompleted += 1;
  progress.lastProgressAt = new Date();

  await progress.save();

  // ============================================
  // UNIFIED REWARD SYSTEM
  // ============================================
  let leveledUp = false;
  let totalXPAwarded = 0;

  // 1. Award MILESTONE XP directly to user level
  if (milestone.rewards.xp > 0) {
    try {
      const { awardXP } = await import("@/lib/services/xp-level.service");
      const xpResult = await awardXP(userId, milestone.rewards.xp, "milestone", milestoneId);
      totalXPAwarded += milestone.rewards.xp;
      leveledUp = xpResult.leveledUp;
      console.log(`⭐ [JOURNEY] Awarded ${milestone.rewards.xp} XP for milestone completion`);
    } catch (error) {
      console.error(`⚠️ [JOURNEY] Error awarding milestone XP:`, error);
    }
  }

  // 2. Award BADGE if milestone has one
  if (milestone.rewards.badgeId) {
    try {
      const UserBadge = (await import("@/database/models/user-badge.model")).default;
      
      // Check if user already has this badge
      const existingBadge = await UserBadge.findOne({ 
        userId, 
        badgeId: milestone.rewards.badgeId 
      });
      
      if (!existingBadge) {
        // Award the badge
        await UserBadge.create({
          userId,
          badgeId: milestone.rewards.badgeId,
          earnedAt: new Date(),
          progress: 100,
          source: "milestone",
          milestoneId,
        });
        console.log(`🏅 [JOURNEY] Awarded badge ${milestone.rewards.badgeId} for milestone`);

        // Award badge XP (this is separate from milestone XP)
        try {
          const { awardXPForBadge } = await import("@/lib/services/xp-level.service");
          const badgeXpResult = await awardXPForBadge(userId, milestone.rewards.badgeId);
          totalXPAwarded += badgeXpResult.xpGained;
          if (badgeXpResult.leveledUp) leveledUp = true;
          console.log(`⭐ [JOURNEY] Awarded ${badgeXpResult.xpGained} XP for badge`);
        } catch (badgeXpError) {
          console.error(`⚠️ [JOURNEY] Error awarding badge XP:`, badgeXpError);
        }

        // Send badge notification
        try {
          const { notificationService } = await import("@/lib/services/notification.service");
          const BadgeConfig = (await import("@/database/models/badge-config.model")).default;
          const badge = await BadgeConfig.findOne({ id: milestone.rewards.badgeId }).lean();
          if (badge) {
            await notificationService.notifyBadgeEarned(
              userId,
              badge.name,
              badge.description || `You've earned the ${badge.name} badge!`
            );
          }
        } catch (notifError) {
          console.error(`⚠️ [JOURNEY] Error sending badge notification:`, notifError);
        }
      } else {
        console.log(`ℹ️ [JOURNEY] User already has badge ${milestone.rewards.badgeId}`);
      }
    } catch (error) {
      console.error(`⚠️ [JOURNEY] Error awarding badge:`, error);
    }
  }

  // Send notification
  try {
    const { notificationService } = await import("@/lib/services/notification.service");
    await notificationService.sendNotification(
      userId,
      "milestone_completed",
      `🎯 Milestone Complete: ${milestone.name}`,
      milestone.celebrationText || `You've completed "${milestone.name}" and earned ${milestone.rewards.xp} XP!`,
      { milestoneId, rewards: milestone.rewards }
    );
  } catch (error) {
    console.error(`⚠️ [JOURNEY] Error sending notification:`, error);
  }

  console.log(`✅ [JOURNEY] Milestone ${milestoneId} completed for user ${userId}`);

  return {
    success: true,
    message: milestone.celebrationText || `Milestone "${milestone.name}" completed!`,
    rewards: { xp: milestone.rewards.xp, badgeId: milestone.rewards.badgeId },
    newUnlocks,
    leveledUp,
  };
}

/**
 * Check and unlock milestones based on their unlockCondition
 * This evaluates conditions like "level_reached" to unlock milestones
 * OPTIMIZED: Gathers stats once and reuses for all condition checks
 */
export async function checkAndUnlockMilestones(
  userId: string,
  mapId: string = "traders_journey"
): Promise<{
  newlyUnlocked: string[];
}> {
  console.log(`🔓 [JOURNEY] Checking unlock conditions for user ${userId}`);
  await connectToDatabase();

  const newlyUnlocked: string[] = [];

  // Get user's progress
  let progress = await UserJourneyProgress.findOne({ userId, mapId });
  if (!progress) {
    progress = await initializeUserJourney(userId, mapId);
  }

  // Get all milestones for this map
  const allMilestones = await JourneyMilestone.find({ mapId, isActive: true }).lean();
  
  // Get already unlocked and completed milestone IDs
  const unlockedIds = new Set(progress.unlockedMilestones);
  const completedIds = new Set(progress.completedMilestones.map(m => m.milestoneId));

  // Find milestones that need unlock condition checks
  const milestonesToCheck = allMilestones.filter(m => 
    !unlockedIds.has(m.id) && !completedIds.has(m.id) && m.unlockCondition
  );

  // OPTIMIZATION: Only gather stats once if there are conditions to check
  let preloadedStats: Record<string, any> | undefined;
  if (milestonesToCheck.length > 0) {
    const { gatherUserStats } = await import("@/lib/services/badge-evaluation.service");
    preloadedStats = await gatherUserStats(userId);
  }

  // Pre-fetch user's earned badge IDs for badge-gated milestone checks
  let userBadgeIds: Set<string> | null = null;
  const hasBadgeGatedMilestones = allMilestones.some(
    (m: any) => m.requiredBadgeIds && m.requiredBadgeIds.length > 0
  );
  if (hasBadgeGatedMilestones) {
    const UserBadge = (await import("@/database/models/user-badge.model")).default;
    const earnedBadges = await UserBadge.find({ userId }).select("badgeId").lean();
    userBadgeIds = new Set(earnedBadges.map((b: any) => b.badgeId));
  }

  // Check each milestone that is NOT yet unlocked
  for (const milestone of allMilestones) {
    // Skip if already unlocked or completed
    if (unlockedIds.has(milestone.id) || completedIds.has(milestone.id)) {
      continue;
    }

    // Skip seasonal milestones outside their active window
    const ms = milestone as any;
    if (ms.isSeasonal) {
      const now = new Date();
      if (ms.seasonStart && now < new Date(ms.seasonStart)) continue;
      if (ms.seasonEnd && now > new Date(ms.seasonEnd)) continue;
    }

    // Check if this milestone can be unlocked
    let canUnlock = false;

    // Method 1: Check if any prerequisite milestone (connectedFrom) is completed
    if (milestone.connectedFrom && milestone.connectedFrom.length > 0) {
      const hasCompletedPrereq = milestone.connectedFrom.some(prereqId => 
        completedIds.has(prereqId)
      );
      if (hasCompletedPrereq) {
        canUnlock = true;
      }
    }

    // Method 2: Check unlockCondition (e.g., level_reached) - uses preloaded stats
    if (!canUnlock && milestone.unlockCondition) {
      const { met } = await checkConditionMet(userId, milestone.unlockCondition, preloadedStats);
      if (met) {
        canUnlock = true;
      }
    }

    // Method 3: Start nodes with no prerequisites should be unlocked
    if (!canUnlock && milestone.nodeType === "start" && 
        (!milestone.connectedFrom || milestone.connectedFrom.length === 0)) {
      canUnlock = true;
    }

    // Badge-gated check: user must have earned ALL required badges
    if (canUnlock && ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0 && userBadgeIds) {
      const hasAllBadges = ms.requiredBadgeIds.every((bid: string) => userBadgeIds!.has(bid));
      if (!hasAllBadges) {
        canUnlock = false; // Missing required badges -- stay locked
      }
    }

    // Unlock the milestone if conditions are met
    if (canUnlock) {
      progress.unlockedMilestones.push(milestone.id);
      unlockedIds.add(milestone.id);
      newlyUnlocked.push(milestone.id);
      console.log(`🔓 [JOURNEY] Unlocked milestone: ${milestone.id} (${milestone.name})`);
    }
  }

  // Save progress if there were any new unlocks
  if (newlyUnlocked.length > 0) {
    await progress.save();
    console.log(`✅ [JOURNEY] Unlocked ${newlyUnlocked.length} new milestones for user ${userId}`);
  }

  return { newlyUnlocked };
}

/**
 * Check and complete all eligible milestones for a user
 * Call this after significant user actions (deposit, trade, competition)
 * OPTIMIZED: Gathers stats once and reuses for all condition checks
 */
export async function checkAndCompleteMilestones(
  userId: string,
  mapId: string = "traders_journey"
): Promise<{
  completed: string[];
  unlocked: string[];
  totalXPEarned: number;
}> {
  console.log(`🔄 [JOURNEY] Checking milestones for user ${userId}`);
  await connectToDatabase();

  const completed: string[] = [];
  let totalXPEarned = 0;

  // Get user's progress
  let progress = await UserJourneyProgress.findOne({ userId, mapId });
  if (!progress) {
    progress = await initializeUserJourney(userId, mapId);
  }

  // STEP 1: First check if any new milestones can be unlocked
  const { newlyUnlocked } = await checkAndUnlockMilestones(userId, mapId);

  // Refresh progress after unlocks
  progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
  if (!progress) {
    return { completed: [], unlocked: newlyUnlocked, totalXPEarned: 0 };
  }

  // STEP 2: Check ALL milestones (not just unlocked) for completion
  // This allows "out of order" completion - e.g., KYC done before first deposit
  const completedIds = new Set(progress.completedMilestones.map(m => m.milestoneId));
  
  // Get ALL milestones sorted by order
  const allMilestones = await JourneyMilestone.find({ mapId, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  // Filter to milestones not yet completed
  const notCompleted = allMilestones.filter(m => !completedIds.has(m.id));

  // OPTIMIZATION: Gather stats once for all completion checks
  let preloadedStats: Record<string, any> | undefined;
  if (notCompleted.length > 0) {
    const { gatherUserStats } = await import("@/lib/services/badge-evaluation.service");
    preloadedStats = await gatherUserStats(userId);
  }

  // Check ALL non-completed milestones (allows out-of-order completion)
  for (const milestone of notCompleted) {
    // Check if this milestone's condition is met
    if (!milestone.completeCondition) continue;
    
    const { met } = await checkConditionMet(userId, milestone.completeCondition, preloadedStats);
    
    if (met) {
      // Force-unlock this milestone if it's not already unlocked
      // This ensures milestones can be completed even if earlier ones in the chain are skipped
      const freshProgress = await UserJourneyProgress.findOne({ userId, mapId });
      if (freshProgress && !freshProgress.unlockedMilestones.includes(milestone.id)) {
        freshProgress.unlockedMilestones.push(milestone.id);
        await freshProgress.save();
      }

      // Milestone condition is met - complete it
      const result = await completeMilestone(userId, milestone.id, mapId);
      if (result.success && result.rewards) {
        completed.push(milestone.id);
        totalXPEarned += result.rewards.xp;
        console.log(`✅ [JOURNEY] Completed milestone (parallel): ${milestone.name}`);
        
        // Cascade: check for new unlocks
        await checkAndUnlockMilestones(userId, mapId);
      }
    }
  }

  if (completed.length > 0) {
    console.log(`✅ [JOURNEY] Completed ${completed.length} milestones for user ${userId}`);
  }

  return { completed, unlocked: newlyUnlocked, totalXPEarned };
}

/**
 * Select a branch path (for branching milestones)
 */
export async function selectBranchPath(
  userId: string,
  branchMilestoneId: string,
  selectedPath: string
): Promise<{ success: boolean; message: string }> {
  await connectToDatabase();

  const progress = await UserJourneyProgress.findOne({ userId });
  if (!progress) {
    return { success: false, message: "Journey not initialized" };
  }

  // Verify the branch milestone exists and is a branch type
  const branchMilestone = await JourneyMilestone.findOne({
    id: branchMilestoneId,
    nodeType: "branch",
    isActive: true,
  }).lean();

  if (!branchMilestone) {
    return { success: false, message: "Branch milestone not found" };
  }

  // Verify the selected path is one of the connected milestones
  if (!branchMilestone.connectedTo.includes(selectedPath)) {
    return { success: false, message: "Invalid path selection" };
  }

  // Store the selection
  progress.selectedBranches = progress.selectedBranches || {};
  progress.selectedBranches[branchMilestoneId] = selectedPath;
  progress.activePath = selectedPath;

  // Unlock the selected path milestone
  if (!progress.unlockedMilestones.includes(selectedPath)) {
    progress.unlockedMilestones.push(selectedPath);
  }

  await progress.save();

  return { success: true, message: "Path selected successfully" };
}

/**
 * Get journey statistics for a user
 */
export async function getJourneyStats(userId: string): Promise<{
  totalMilestones: number;
  completedMilestones: number;
  completionPercentage: number;
  totalXPEarned: number;
  currentZone: string;
  journeyDays: number;
}> {
  await connectToDatabase();

  const progress = await UserJourneyProgress.findOne({ userId }).lean();
  const totalMilestones = await JourneyMilestone.countDocuments({ 
    mapId: progress?.mapId || "traders_journey",
    isActive: true,
    isRequired: true,
  });

  if (!progress) {
    return {
      totalMilestones,
      completedMilestones: 0,
      completionPercentage: 0,
      totalXPEarned: 0,
      currentZone: "starting_dock",
      journeyDays: 0,
    };
  }

  const completedMilestones = progress.completedMilestones?.length || 0;
  const journeyStart = progress.journeyStartedAt || new Date();
  const journeyDays = Math.floor(
    (Date.now() - new Date(journeyStart).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    totalMilestones,
    completedMilestones,
    completionPercentage: totalMilestones > 0 
      ? Math.round((completedMilestones / totalMilestones) * 100) 
      : 0,
    totalXPEarned: progress.totalXPFromJourney || 0,
    currentZone: progress.currentZone || "starting_dock",
    journeyDays,
  };
}

/**
 * Calculate progress for all non-completed milestones
 * Returns { milestoneId, currentValue, targetValue } for each milestone
 * Used to show progress bars (e.g. "23/50 trades") in the UI
 */
export async function calculateMilestoneProgress(
  userId: string,
  mapId: string = "traders_journey"
): Promise<Array<{ milestoneId: string; currentValue: number; targetValue: number }>> {
  await connectToDatabase();

  const progress = await UserJourneyProgress.findOne({ userId, mapId }).lean();
  if (!progress) return [];

  const completedIds = new Set(
    (progress.completedMilestones || []).map((m: any) => m.milestoneId)
  );

  // Get milestones that are NOT completed
  const allMilestones = await JourneyMilestone.find({ mapId, isActive: true })
    .select("id completeCondition")
    .lean();

  const notCompleted = allMilestones.filter((m) => !completedIds.has(m.id));
  if (notCompleted.length === 0) return [];

  // Gather stats once
  const { gatherUserStats } = await import("@/lib/services/badge-evaluation.service");
  const stats = await gatherUserStats(userId);

  const results: Array<{ milestoneId: string; currentValue: number; targetValue: number }> = [];

  for (const milestone of notCompleted) {
    if (!milestone.completeCondition) continue;

    const { currentValue } = await checkConditionMet(userId, milestone.completeCondition, stats);
    const targetValue = (typeof milestone.completeCondition.value === "number" 
      ? milestone.completeCondition.value 
      : 1);

    results.push({
      milestoneId: milestone.id,
      currentValue: currentValue ?? 0,
      targetValue,
    });
  }

  return results;
}
