import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

/**
 * POST /api/journey/sync-all-users
 * Admin endpoint to sync all users' journey progress
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get all maps and milestones
    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
      .lean();

    if (maps.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No journey maps found. Generate maps first.",
      });
    }

    // Collect all milestones per map
    const mapMilestones: Record<string, any[]> = {};
    for (const map of maps as any[]) {
      const milestones = await JourneyMilestone.find({ 
        mapId: map.mapId, 
        isActive: true 
      }).sort({ order: 1 }).lean();
      mapMilestones[map.mapId] = milestones;
    }

    // Get first milestone for defaults
    const firstMapId = (maps[0] as any).mapId;
    const firstMilestoneId = mapMilestones[firstMapId]?.[0]?.id || "account_created";

    // Get all users who have wallets (indicating they're active users)
    const wallets = await CreditWallet.find({}).select("userId").lean();
    const userIds = wallets.map((w: any) => w.userId).filter(Boolean);

    console.log(`[Sync All] Found ${userIds.length} users to sync`);

    let usersProcessed = 0;
    let totalMilestonesCompleted = 0;
    let totalXPAwarded = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // Get user stats
        const userStats = await getUserStats(userId);
        
        // Get or create user progress
        let progress = await UserJourneyProgress.findOne({ userId });
        if (!progress) {
          progress = await UserJourneyProgress.create({
            userId,
            mapId: firstMapId,
            currentMapIndex: 1,
            currentZone: "zone_1",
            currentMilestone: firstMilestoneId,
            completedMilestones: [],
            unlockedMilestones: [firstMilestoneId],
            totalXPFromJourney: 0,
            totalMilestonesCompleted: 0,
            journeyStartedAt: new Date(),
            lastProgressAt: new Date(),
          });
        }

        const completedMaps = new Set<string>();
        let userMilestonesCompleted = 0;
        let userXPEarned = 0;

        // Process each map
        for (const map of maps as any[]) {
          const milestones = mapMilestones[map.mapId] || [];
          const completedIds = progress.completedMilestones?.map((m: any) => 
            typeof m === "string" ? m : m.milestoneId
          ) || [];

          for (const milestone of milestones as any[]) {
            if (completedIds.includes(milestone.id)) continue;

            // Check condition
            let isMet = false;
            const condition = milestone.completeCondition;
            
            if (condition?.type === "map_completed") {
              const requiredMapId = condition.value;
              const requiredMilestones = mapMilestones[requiredMapId] || [];
              const allCompleted = requiredMilestones.every((m: any) => completedIds.includes(m.id));
              isMet = allCompleted || completedMaps.has(requiredMapId);
            } else {
              isMet = evaluateCondition(condition, userStats);
            }

            if (isMet) {
              // Check prerequisites
              const prerequisitesMet = 
                milestone.order === 1 || 
                !milestone.connectedFrom?.length ||
                milestone.connectedFrom?.every((prevId: string) => completedIds.includes(prevId));

              if (prerequisitesMet) {
                progress.completedMilestones.push({
                  milestoneId: milestone.id,
                  completedAt: new Date(),
                  rewards: milestone.rewards || { xp: 0 },
                });
                
                userMilestonesCompleted++;
                userXPEarned += milestone.rewards?.xp || 0;
                completedIds.push(milestone.id);
              }
            }

            // Unlock milestone
            if (!progress.unlockedMilestones?.includes(milestone.id)) {
              const shouldUnlock = 
                milestone.order === 1 || 
                !milestone.connectedFrom?.length ||
                milestone.connectedFrom?.some((prevId: string) => completedIds.includes(prevId));
              
              if (shouldUnlock) {
                progress.unlockedMilestones.push(milestone.id);
              }
            }
          }

          // Check if map is complete
          const mapCompleted = milestones.every((m: any) => completedIds.includes(m.id));
          if (mapCompleted && milestones.length > 0) {
            completedMaps.add(map.mapId);
          }
        }

        // Update progress
        if (userMilestonesCompleted > 0) {
          progress.totalMilestonesCompleted = progress.completedMilestones.length;
          progress.totalXPFromJourney = (progress.totalXPFromJourney || 0) + userXPEarned;
          progress.lastProgressAt = new Date();
          await progress.save();

          totalMilestonesCompleted += userMilestonesCompleted;
          totalXPAwarded += userXPEarned;
        }

        usersProcessed++;
      } catch (err: any) {
        errors.push(`User ${userId}: ${err.message}`);
      }
    }

    console.log(`[Sync All] Completed: ${usersProcessed} users, ${totalMilestonesCompleted} milestones, ${totalXPAwarded} XP`);

    return NextResponse.json({
      success: true,
      usersProcessed,
      totalMilestonesCompleted,
      totalXPAwarded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error syncing all users:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync users" },
      { status: 500 }
    );
  }
}

/**
 * Get user's stats from database
 */
async function getUserStats(userId: string): Promise<Record<string, number | boolean>> {
  const stats: Record<string, number | boolean> = {
    account_created: true,
    first_trade: false,
    first_deposit: false,
    kyc_verified: false,
  };

  try {
    const wallet = await CreditWallet.findOne({ userId }).lean() as any;
    if (wallet) {
      stats.kyc_verified = wallet.kycVerified === true || wallet.kycStatus === "approved";
      stats.first_deposit = (wallet.totalDeposited || 0) > 0;
      stats.has_deposit = (wallet.totalDeposited || 0) > 0;
      stats.first_withdrawal = (wallet.totalWithdrawn || 0) > 0;
    }

    const deposits = await WalletTransaction.find({ userId, type: "deposit", status: "completed" }).lean();
    if (deposits.length > 0) {
      stats.first_deposit = true;
      stats.has_deposit = true;
    }

    const trades = await TradeHistory.find({ userId }).lean() as any[];
    stats.total_trades = trades.length;
    stats.first_trade = trades.length > 0;
    
    const winningTrades = trades.filter(t => t.pnl > 0 || t.result === "win" || t.isWin === true);
    const losingTrades = trades.filter(t => t.pnl < 0 || t.result === "loss" || t.isWin === false);
    stats.winning_trades = winningTrades.length;
    stats.losing_trades = losingTrades.length;
    stats.first_winning_trade = winningTrades.length > 0;
    stats.first_losing_trade = losingTrades.length > 0;
    
    // Win streak
    let currentStreak = 0;
    let maxStreak = 0;
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.closedAt || a.createdAt).getTime() - new Date(b.closedAt || b.createdAt).getTime()
    );
    for (const trade of sortedTrades) {
      if (trade.pnl > 0 || trade.result === "win" || trade.isWin === true) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    stats.win_streak = maxStreak;
    
    // Unique pairs
    const uniquePairs = new Set(trades.map(t => t.symbol || t.pair || t.asset));
    stats.unique_pairs_traded = uniquePairs.size;
    
    // Risk management
    const tradesWithSL = trades.filter(t => t.stopLoss !== undefined && t.stopLoss !== null);
    const tradesWithTP = trades.filter(t => t.takeProfit !== undefined && t.takeProfit !== null);
    stats.first_stop_loss = tradesWithSL.length > 0;
    stats.first_take_profit = tradesWithTP.length > 0;
    stats.always_uses_sl = tradesWithSL.length;
    stats.always_uses_tp = tradesWithTP.length;

    // Competitions
    const participants = await CompetitionParticipant.find({ userId }).lean() as any[];
    stats.competitions_entered = participants.length;
    stats.competitions_completed = participants.filter(p => 
      p.status === "completed" || p.finalRank !== undefined || p.rank !== undefined
    ).length;
    stats.podium_finishes = participants.filter(p => 
      (p.finalRank && p.finalRank <= 3) || (p.rank && p.rank <= 3)
    ).length;
    stats.first_place_finishes = participants.filter(p => 
      p.finalRank === 1 || p.rank === 1
    ).length;

  } catch (err) {
    console.error(`Error getting stats for user ${userId}:`, err);
  }

  return stats;
}

/**
 * Evaluate condition against user stats
 */
function evaluateCondition(
  condition: { type: string; value?: number | string; comparison?: string } | undefined,
  userStats: Record<string, number | boolean>
): boolean {
  if (!condition) return false;

  const { type, value, comparison = "gte" } = condition;

  const booleanConditions = [
    "account_created", "kyc_verified", "first_deposit", "has_deposit",
    "first_trade", "first_withdrawal", "first_winning_trade", "first_losing_trade",
    "first_stop_loss", "first_take_profit",
  ];
  
  if (booleanConditions.includes(type)) {
    return userStats[type] === true;
  }

  if (type === "map_completed") {
    return false; // Handled separately
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const userValue = typeof userStats[type] === "number" ? userStats[type] as number : 0;

  if (numericValue === undefined || numericValue === null || isNaN(numericValue as number)) {
    return false;
  }

  switch (comparison) {
    case "gte": case ">=": return userValue >= (numericValue as number);
    case "gt": case ">": return userValue > (numericValue as number);
    case "lte": case "<=": return userValue <= (numericValue as number);
    case "lt": case "<": return userValue < (numericValue as number);
    case "eq": case "=": case "==": return userValue === numericValue;
    default: return userValue >= (numericValue as number);
  }
}
