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

    // Get or create user progress
    let progress = await UserJourneyProgress.findOne({ userId });
    if (!progress) {
      progress = await UserJourneyProgress.create({
        userId,
        mapId: maps[0].mapId,
        currentMapIndex: 1,
        currentZone: "zone_1",
        currentMilestone: "",
        completedMilestones: [],
        unlockedMilestones: [],
        totalXPFromJourney: 0,
        totalMilestonesCompleted: 0,
        journeyStartedAt: new Date(),
        lastProgressAt: new Date(),
      });
    }

    const newlyCompleted: string[] = [];
    const newlyUnlocked: string[] = [];
    let totalXPEarned = 0;

    // Process each map in sequence
    for (const map of maps) {
      const milestones = await JourneyMilestone.find({ 
        mapId: map.mapId, 
        isActive: true 
      }).sort({ order: 1 }).lean();

      const completedIds = progress.completedMilestones?.map((m: any) => m.milestoneId) || [];

      for (const milestone of milestones as any[]) {
        // Skip if already completed
        if (completedIds.includes(milestone.id)) continue;

        // Check if milestone condition is met
        const isMet = evaluateCondition(milestone.completeCondition, userStats);
        
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
            
            console.log(`[Journey Evaluate] Auto-completed: "${milestone.name}" (${milestone.completeCondition?.type})`);
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
    }

    // Update progress stats
    progress.totalMilestonesCompleted = progress.completedMilestones.length;
    progress.totalXPFromJourney = (progress.totalXPFromJourney || 0) + totalXPEarned;
    progress.lastProgressAt = new Date();
    
    await progress.save();

    return NextResponse.json({
      success: true,
      newlyCompleted,
      newlyUnlocked,
      totalXPEarned,
      totalMilestonesCompleted: progress.totalMilestonesCompleted,
      userStats,
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
 * Get user's actual stats from the database
 */
async function getUserStats(userId: string): Promise<Record<string, number | boolean>> {
  const stats: Record<string, number | boolean> = {
    account_created: true, // If we got here, account exists
  };

  try {
    // Get wallet for KYC status and deposit info
    const wallet = await CreditWallet.findOne({ userId }).lean() as any;
    if (wallet) {
      stats.kyc_verified = wallet.kycVerified === true || wallet.kycStatus === "approved" || wallet.kycStatus === "verified";
      stats.first_deposit = (wallet.totalDeposited || 0) > 0;
      stats.total_deposits = wallet.totalDeposited || 0;
      stats.first_withdrawal = (wallet.totalWithdrawn || 0) > 0;
    }

    // Get wallet transactions for more detailed deposit tracking
    const deposits = await WalletTransaction.find({ 
      userId, 
      type: "deposit",
      status: "completed"
    }).lean();
    if (deposits.length > 0) {
      stats.first_deposit = true;
      stats.deposit_amount = deposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    }

    // Get trades from trade history
    const trades = await TradeHistory.find({ userId }).lean() as any[];
    stats.total_trades = trades.length;
    stats.winning_trades = trades.filter(t => t.pnl > 0 || t.result === "win" || t.isWin === true).length;
    stats.losing_trades = trades.filter(t => t.pnl < 0 || t.result === "loss" || t.isWin === false).length;
    
    // Calculate win streak
    let currentStreak = 0;
    let maxStreak = 0;
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(b.closedAt || b.createdAt).getTime() - new Date(a.closedAt || a.createdAt).getTime()
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

    // Get competition participants for this user
    const competitionParticipants = await CompetitionParticipant.find({ userId }).lean() as any[];
    stats.competitions_entered = competitionParticipants.length;
    stats.competitions_completed = competitionParticipants.filter(p => 
      p.status === "completed" || p.finalRank !== undefined || p.rank !== undefined
    ).length;
    
    // Podium finishes (top 3)
    stats.podium_finishes = competitionParticipants.filter(p => 
      (p.finalRank && p.finalRank <= 3) || (p.rank && p.rank <= 3)
    ).length;
    
    // First place finishes
    stats.first_place_finishes = competitionParticipants.filter(p => 
      p.finalRank === 1 || p.rank === 1
    ).length;

    // Total PnL
    stats.total_pnl = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);

  } catch (err) {
    console.error("Error getting user stats:", err);
  }

  return stats;
}

/**
 * Evaluate if a milestone condition is met
 */
function evaluateCondition(
  condition: { type: string; value?: number | string; comparison?: string } | undefined,
  userStats: Record<string, number | boolean>
): boolean {
  if (!condition) return false;

  const { type, value, comparison = "gte" } = condition;
  const userValue = userStats[type];

  // Boolean conditions
  if (type === "account_created") return userStats.account_created === true;
  if (type === "kyc_verified") return userStats.kyc_verified === true;
  if (type === "first_deposit") return userStats.first_deposit === true;

  // Numeric conditions
  if (typeof userValue === "number" && typeof value === "number") {
    switch (comparison) {
      case "gte":
      case ">=":
        return userValue >= value;
      case "gt":
      case ">":
        return userValue > value;
      case "lte":
      case "<=":
        return userValue <= value;
      case "lt":
      case "<":
        return userValue < value;
      case "eq":
      case "=":
      case "==":
        return userValue === value;
      default:
        return userValue >= value;
    }
  }

  return false;
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
