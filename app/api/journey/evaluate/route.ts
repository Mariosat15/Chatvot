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
 * POST /api/journey/evaluate
 * Evaluate user's progress and auto-complete milestones they've already achieved
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Gather user's actual stats (this also validates the user exists via wallet/trades)
    const userStats = await getUserStats(userId);
    console.log(`[Journey Evaluate] User ${userId} stats:`, userStats);

    // Get all maps and milestones
    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
      .lean();

    if (maps.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No journey maps found",
        completedMilestones: [],
        unlockedMilestones: [],
      });
    }

    // Get first milestone from first map for default
    const firstMapMilestones = await JourneyMilestone.find({ 
      mapId: (maps[0] as any).mapId, 
      isActive: true 
    }).sort({ order: 1 }).limit(1).lean();
    const firstMilestoneId = (firstMapMilestones[0] as any)?.id || "account_created";

    // Get or create user progress
    let progress = await UserJourneyProgress.findOne({ userId });
    if (!progress) {
      progress = await UserJourneyProgress.create({
        userId,
        mapId: (maps[0] as any).mapId,
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

    const newlyCompleted: string[] = [];
    const newlyUnlocked: string[] = [];
    let totalXPEarned = 0;
    
    // Track completed maps for map_completed conditions
    const completedMaps = new Set<string>();

    // First pass: collect all milestones per map to check full completion
    const mapMilestones: Record<string, any[]> = {};
    for (const map of maps as any[]) {
      const milestones = await JourneyMilestone.find({ 
        mapId: map.mapId, 
        isActive: true 
      }).sort({ order: 1 }).lean();
      mapMilestones[map.mapId] = milestones;
    }

    // Process each map in sequence
    for (const map of maps as any[]) {
      const milestones = mapMilestones[map.mapId] || [];
      const completedIds = progress.completedMilestones?.map((m: any) => m.milestoneId) || [];

      for (const milestone of milestones as any[]) {
        // Skip if already completed
        if (completedIds.includes(milestone.id)) continue;

        // Check if milestone condition is met
        let isMet = false;
        const condition = milestone.completeCondition;
        
        // Special handling for map_completed conditions
        if (condition?.type === "map_completed") {
          const requiredMapId = condition.value;
          // Check if all milestones in the required map are completed
          const requiredMapMilestones = mapMilestones[requiredMapId] || [];
          const allRequiredCompleted = requiredMapMilestones.every(
            (m: any) => completedIds.includes(m.id)
          );
          isMet = allRequiredCompleted || completedMaps.has(requiredMapId);
        } else {
          isMet = evaluateCondition(condition, userStats);
        }
        
        if (isMet) {
          // Check prerequisites
          const prerequisitesMet = checkPrerequisites(milestone, completedIds, milestones as any[]);
          
          if (prerequisitesMet || milestone.order === 1 || !milestone.connectedFrom?.length) {
            // Mark as completed
            progress.completedMilestones.push({
              milestoneId: milestone.id,
              completedAt: new Date(),
              rewards: milestone.rewards || { xp: 0 },
            });
            
            newlyCompleted.push(milestone.id);
            totalXPEarned += milestone.rewards?.xp || 0;
            completedIds.push(milestone.id);
            
            console.log(`[Journey Evaluate] Auto-completed: "${milestone.name}" (${condition?.type})`);
          }
        }

        // Unlock milestone if it's the first or previous is completed
        const isUnlocked = progress.unlockedMilestones?.includes(milestone.id);
        if (!isUnlocked) {
          const shouldUnlock = 
            milestone.order === 1 || 
            !milestone.connectedFrom?.length ||
            milestone.connectedFrom?.some((prevId: string) => completedIds.includes(prevId));
          
          if (shouldUnlock) {
            progress.unlockedMilestones.push(milestone.id);
            newlyUnlocked.push(milestone.id);
          }
        }
      }
      
      // Check if this map is now fully completed
      const mapCompleted = milestones.every((m: any) => completedIds.includes(m.id));
      if (mapCompleted && milestones.length > 0) {
        completedMaps.add(map.mapId);
        console.log(`[Journey Evaluate] Map fully completed: ${map.mapId}`);
      }
    }

    // Update progress stats
    progress.totalMilestonesCompleted = progress.completedMilestones.length;
    progress.totalXPFromJourney = (progress.totalXPFromJourney || 0) + totalXPEarned;
    progress.lastProgressAt = new Date();
    
    await progress.save();

    // Debug info for troubleshooting
    const debugInfo = {
      mapsProcessed: maps.length,
      totalMilestonesChecked: Object.values(mapMilestones).flat().length,
      statsChecked: Object.keys(userStats).filter(k => userStats[k] === true || (typeof userStats[k] === "number" && userStats[k] > 0)),
    };

    console.log("[Journey Evaluate] Summary:", {
      userId,
      newlyCompleted: newlyCompleted.length,
      newlyUnlocked: newlyUnlocked.length,
      totalXPEarned,
      ...debugInfo,
    });

    return NextResponse.json({
      success: true,
      newlyCompleted,
      newlyUnlocked,
      totalXPEarned,
      totalMilestonesCompleted: progress.totalMilestonesCompleted,
      userStats,
      debug: debugInfo,
    });
  } catch (error) {
    console.error("Error evaluating journey progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to evaluate journey progress" },
      { status: 500 }
    );
  }
}

/**
 * Get user's actual stats from the database - COMPREHENSIVE VERSION
 */
async function getUserStats(userId: string): Promise<Record<string, number | boolean>> {
  const stats: Record<string, number | boolean> = {
    account_created: true, // If we got here, account exists
    first_trade: false,
    first_deposit: false,
    first_withdrawal: false,
    kyc_verified: false,
  };

  try {
    // Get wallet for KYC status and deposit info
    const wallet = await CreditWallet.findOne({ userId }).lean() as any;
    if (wallet) {
      stats.kyc_verified = wallet.kycVerified === true || wallet.kycStatus === "approved" || wallet.kycStatus === "verified";
      stats.first_deposit = (wallet.totalDeposited || 0) > 0;
      stats.has_deposit = (wallet.totalDeposited || 0) > 0;
      stats.total_deposits = wallet.totalDeposited || 0;
      stats.total_deposited = wallet.totalDeposited || 0;
      stats.first_withdrawal = (wallet.totalWithdrawn || 0) > 0;
      stats.withdrawal_made = (wallet.totalWithdrawn || 0) > 0;
    }

    // Get wallet transactions for more detailed deposit tracking
    const deposits = await WalletTransaction.find({ 
      userId, 
      type: "deposit",
      status: "completed"
    }).lean();
    if (deposits.length > 0) {
      stats.first_deposit = true;
      stats.has_deposit = true;
      stats.deposit_amount = deposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    }

    // Get trades from trade history
    const trades = await TradeHistory.find({ userId }).lean() as any[];
    stats.total_trades = trades.length;
    stats.first_trade = trades.length > 0;
    
    // Winning and losing trades
    const winningTrades = trades.filter(t => t.pnl > 0 || t.result === "win" || t.isWin === true);
    const losingTrades = trades.filter(t => t.pnl < 0 || t.result === "loss" || t.isWin === false);
    stats.winning_trades = winningTrades.length;
    stats.losing_trades = losingTrades.length;
    stats.first_winning_trade = winningTrades.length > 0;
    stats.first_losing_trade = losingTrades.length > 0;
    
    // Calculate win streak (current and max)
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
    stats.max_win_streak = maxStreak;
    
    // Unique pairs traded
    const uniquePairs = new Set(trades.map(t => t.symbol || t.pair || t.asset));
    stats.unique_pairs_traded = uniquePairs.size;
    stats.different_assets_traded = uniquePairs.size;
    
    // Risk management - check for SL and TP usage
    const tradesWithSL = trades.filter(t => t.stopLoss !== undefined && t.stopLoss !== null);
    const tradesWithTP = trades.filter(t => t.takeProfit !== undefined && t.takeProfit !== null);
    stats.first_stop_loss = tradesWithSL.length > 0;
    stats.first_take_profit = tradesWithTP.length > 0;
    stats.always_uses_sl = trades.length > 0 && tradesWithSL.length === trades.length ? 1 : tradesWithSL.length;
    stats.always_uses_tp = trades.length > 0 && tradesWithTP.length === trades.length ? 1 : tradesWithTP.length;
    
    // Total PnL
    const totalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    stats.total_pnl = totalPnl;
    stats.total_pnl_positive = totalPnl > 0;
    stats.net_profit_lifetime = totalPnl;

    // Daily trading streak calculation
    const tradeDates = new Set(
      trades.map(t => {
        const date = new Date(t.closedAt || t.createdAt);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      })
    );
    
    let dailyStreak = 0;
    let maxDailyStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      
      if (tradeDates.has(dateKey)) {
        dailyStreak++;
        maxDailyStreak = Math.max(maxDailyStreak, dailyStreak);
      } else if (i > 0) {
        break; // Stop counting streak when we hit a day without trades
      }
    }
    stats.daily_trading_streak = maxDailyStreak;
    
    // Consecutive profitable days
    const profitByDate = new Map<string, number>();
    for (const trade of trades) {
      const date = new Date(trade.closedAt || trade.createdAt);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      profitByDate.set(dateKey, (profitByDate.get(dateKey) || 0) + (trade.pnl || 0));
    }
    
    let profitStreak = 0;
    let maxProfitStreak = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      const dayProfit = profitByDate.get(dateKey);
      
      if (dayProfit !== undefined && dayProfit > 0) {
        profitStreak++;
        maxProfitStreak = Math.max(maxProfitStreak, profitStreak);
      } else if (dayProfit !== undefined) {
        profitStreak = 0;
      }
    }
    stats.consecutive_profitable_days = maxProfitStreak;

    // Get competition participants for this user
    const competitionParticipants = await CompetitionParticipant.find({ userId }).lean() as any[];
    stats.competitions_entered = competitionParticipants.length;
    
    // Completed competitions (has a final rank or status is completed)
    const completedComps = competitionParticipants.filter(p => 
      p.status === "completed" || p.finalRank !== undefined || p.rank !== undefined
    );
    stats.competitions_completed = completedComps.length;
    
    // Podium finishes (top 3)
    const podiumFinishes = competitionParticipants.filter(p => 
      (p.finalRank && p.finalRank <= 3) || (p.rank && p.rank <= 3)
    );
    stats.podium_finishes = podiumFinishes.length;
    
    // First place finishes
    const firstPlaceFinishes = competitionParticipants.filter(p => 
      p.finalRank === 1 || p.rank === 1
    );
    stats.first_place_finishes = firstPlaceFinishes.length;
    
    // Comeback victories
    const comebackVictories = competitionParticipants.filter(p => 
      (p.finalRank === 1 || p.rank === 1) && p.comebackWin === true
    );
    stats.comeback_victory = comebackVictories.length;
    
    // Underdog wins
    const underdogWins = competitionParticipants.filter(p => 
      (p.finalRank === 1 || p.rank === 1) && p.underdogWin === true
    );
    stats.underdog_win = underdogWins.length;

    console.log(`[getUserStats] User ${userId} comprehensive stats:`, {
      trades: stats.total_trades,
      wins: stats.winning_trades,
      streak: stats.win_streak,
      comps_entered: stats.competitions_entered,
      comps_completed: stats.competitions_completed,
      podiums: stats.podium_finishes,
      first_places: stats.first_place_finishes,
    });

  } catch (err) {
    console.error("Error getting user stats:", err);
  }

  return stats;
}

/**
 * Evaluate if a milestone condition is met - COMPREHENSIVE VERSION
 */
function evaluateCondition(
  condition: { type: string; value?: number | string; comparison?: string } | undefined,
  userStats: Record<string, number | boolean>
): boolean {
  if (!condition) return false;

  const { type, value, comparison = "gte" } = condition;
  const userValue = userStats[type];

  // === BOOLEAN CONDITIONS (value of 1 means "true") ===
  const booleanConditions = [
    "account_created",
    "kyc_verified", 
    "first_deposit",
    "has_deposit",
    "first_trade",
    "first_withdrawal",
    "withdrawal_made",
    "first_winning_trade",
    "first_losing_trade",
    "first_stop_loss",
    "first_take_profit",
    "total_pnl_positive",
  ];
  
  if (booleanConditions.includes(type)) {
    // If value is 1, we're checking for true
    if (value === 1 || value === "1") {
      return userStats[type] === true;
    }
    return userStats[type] === true;
  }

  // === MAP COMPLETED CONDITIONS (special string comparison) ===
  if (type === "map_completed") {
    // For map_completed, we'd need to check user's progress
    // This will be checked separately in the progression logic
    // For now, return false as this needs map progression check
    return false;
  }

  // === NUMERIC CONDITIONS ===
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const numericUserValue = typeof userValue === "number" ? userValue : 0;

  // If value is not provided or user value is not numeric, return false
  if (numericValue === undefined || numericValue === null || isNaN(numericValue as number)) {
    return false;
  }

  switch (comparison) {
    case "gte":
    case ">=":
      return numericUserValue >= (numericValue as number);
    case "gt":
    case ">":
      return numericUserValue > (numericValue as number);
    case "lte":
    case "<=":
      return numericUserValue <= (numericValue as number);
    case "lt":
    case "<":
      return numericUserValue < (numericValue as number);
    case "eq":
    case "=":
    case "==":
      return numericUserValue === numericValue;
    default:
      // Default to >= comparison
      return numericUserValue >= (numericValue as number);
  }
}

/**
 * Check if prerequisite milestones are completed
 */
function checkPrerequisites(
  milestone: any,
  completedIds: string[],
  allMilestones: any[]
): boolean {
  // No prerequisites = always unlocked
  if (!milestone.connectedFrom || milestone.connectedFrom.length === 0) {
    return true;
  }

  // Check if all prerequisites are completed
  return milestone.connectedFrom.every((prevId: string) => 
    completedIds.includes(prevId)
  );
}
