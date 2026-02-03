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
  const mapConfig = await JourneyMapConfig.findOne({ mapId, isActive: true });
  const startNode = mapConfig?.defaultStartNode || "account_created";

  // Get the start milestone to auto-complete it
  const startMilestone = await JourneyMilestone.findOne({ 
    id: startNode, 
    mapId, 
    isActive: true 
  });

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
 * Get user's journey progress with full milestone details
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
 */
export async function checkConditionMet(
  userId: string,
  condition: IMilestoneCondition
): Promise<{ met: boolean; currentValue?: number }> {
  await connectToDatabase();

  const { type, value, comparison = "gte" } = condition;

  // Import stats gatherer from badge evaluation
  const { gatherUserStats } = await import("@/lib/services/badge-evaluation.service");
  const stats = await gatherUserStats(userId);

  let currentValue: number | undefined;

  // Map condition types to user stats
  switch (type) {
    case "account_created":
      return { met: true, currentValue: 1 };

    case "first_deposit":
    case "has_deposit":
      currentValue = stats.totalDeposits || 0;
      break;

    case "total_deposits":
      currentValue = stats.totalDeposits || 0;
      break;

    case "first_trade":
    case "total_trades":
      currentValue = stats.totalTrades || 0;
      break;

    case "winning_trades":
      currentValue = stats.winningTrades || 0;
      break;

    case "competitions_entered":
      currentValue = stats.competitionsEntered || 0;
      break;

    case "competitions_completed":
      currentValue = stats.competitionsCompleted || 0;
      break;

    case "first_place_finishes":
      currentValue = stats.firstPlaceFinishes || 0;
      break;

    case "podium_finishes":
      currentValue = stats.podiumFinishes || 0;
      break;

    case "total_pnl":
      currentValue = stats.totalPnl || 0;
      break;

    case "total_pnl_positive":
      return { met: (stats.totalPnl || 0) > 0, currentValue: stats.totalPnl || 0 };

    case "win_rate":
      currentValue = stats.winRate || 0;
      break;

    case "win_streak":
      currentValue = stats.maxWinStreak || 0;
      break;

    case "badge_earned":
      // Check if user has earned a specific badge
      if (condition.badgeId) {
        const UserBadge = (await import("@/database/models/user-badge.model")).default;
        const badge = await UserBadge.findOne({ userId, badgeId: condition.badgeId });
        return { met: !!badge, currentValue: badge ? 1 : 0 };
      }
      return { met: false };

    case "xp_threshold":
      const UserLevel = (await import("@/database/models/user-level.model")).default;
      const userLevel = await UserLevel.findOne({ userId }).lean();
      currentValue = (userLevel as any)?.currentXP || 0;
      break;

    case "level_reached":
      const UserLevelModel = (await import("@/database/models/user-level.model")).default;
      const level = await UserLevelModel.findOne({ userId }).lean();
      currentValue = (level as any)?.currentLevel || 1;
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
 */
export async function checkMilestoneCompletion(
  userId: string,
  milestoneId: string
): Promise<{
  canComplete: boolean;
  isCompleted: boolean;
  isUnlocked: boolean;
  currentValue?: number;
  targetValue?: number;
}> {
  await connectToDatabase();

  // Get user's progress
  const progress = await UserJourneyProgress.findOne({ userId }).lean();
  
  // Check if already completed
  const isCompleted = progress?.completedMilestones?.some(m => m.milestoneId === milestoneId) || false;
  if (isCompleted) {
    return { canComplete: false, isCompleted: true, isUnlocked: true };
  }

  // Check if unlocked
  const isUnlocked = progress?.unlockedMilestones?.includes(milestoneId) || false;
  if (!isUnlocked) {
    return { canComplete: false, isCompleted: false, isUnlocked: false };
  }

  // Get milestone
  const milestone = await JourneyMilestone.findOne({ id: milestoneId, isActive: true });
  if (!milestone) {
    return { canComplete: false, isCompleted: false, isUnlocked: false };
  }

  // Check completion condition
  const { met, currentValue } = await checkConditionMet(userId, milestone.completeCondition);

  return {
    canComplete: met,
    isCompleted: false,
    isUnlocked: true,
    currentValue,
    targetValue: milestone.completeCondition.value,
  };
}

/**
 * Complete a milestone and award rewards
 */
export async function completeMilestone(
  userId: string,
  milestoneId: string
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
  const { canComplete, isCompleted } = await checkMilestoneCompletion(userId, milestoneId);

  if (isCompleted) {
    return { success: false, message: "Milestone already completed" };
  }

  if (!canComplete) {
    return { success: false, message: "Milestone requirements not met" };
  }

  // Get milestone details
  const milestone = await JourneyMilestone.findOne({ id: milestoneId, isActive: true });
  if (!milestone) {
    return { success: false, message: "Milestone not found" };
  }

  // Update user progress
  const progress = await UserJourneyProgress.findOne({ userId });
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

  // Unlock connected milestones
  const newUnlocks: string[] = [];
  for (const nextId of milestone.connectedTo) {
    if (!progress.unlockedMilestones.includes(nextId)) {
      progress.unlockedMilestones.push(nextId);
      newUnlocks.push(nextId);
    }
  }

  // Update stats
  progress.totalXPFromJourney += milestone.rewards.xp;
  progress.totalMilestonesCompleted += 1;
  progress.currentMilestone = milestoneId;
  progress.currentZone = milestone.zoneId;
  progress.lastProgressAt = new Date();

  await progress.save();

  // Award XP if there's a badge reward
  let leveledUp = false;
  if (milestone.rewards.badgeId) {
    try {
      const result = await awardXPForBadge(userId, milestone.rewards.badgeId);
      leveledUp = result.leveledUp;
    } catch (error) {
      console.error(`⚠️ [JOURNEY] Error awarding badge XP:`, error);
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
 * Check and complete all eligible milestones for a user
 * Call this after significant user actions (deposit, trade, competition)
 */
export async function checkAndCompleteMilestones(
  userId: string
): Promise<{
  completed: string[];
  totalXPEarned: number;
}> {
  console.log(`🔄 [JOURNEY] Checking milestones for user ${userId}`);
  await connectToDatabase();

  const completed: string[] = [];
  let totalXPEarned = 0;

  // Get user's progress
  let progress = await UserJourneyProgress.findOne({ userId });
  if (!progress) {
    progress = await initializeUserJourney(userId);
  }

  // Get all unlocked but not completed milestones
  const completedIds = progress.completedMilestones.map(m => m.milestoneId);
  const unlockedNotCompleted = progress.unlockedMilestones.filter(
    id => !completedIds.includes(id)
  );

  // Check each unlocked milestone
  for (const milestoneId of unlockedNotCompleted) {
    const { canComplete } = await checkMilestoneCompletion(userId, milestoneId);
    
    if (canComplete) {
      const result = await completeMilestone(userId, milestoneId);
      if (result.success && result.rewards) {
        completed.push(milestoneId);
        totalXPEarned += result.rewards.xp;
      }
    }
  }

  if (completed.length > 0) {
    console.log(`✅ [JOURNEY] Completed ${completed.length} milestones for user ${userId}`);
  }

  return { completed, totalXPEarned };
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
  });

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
