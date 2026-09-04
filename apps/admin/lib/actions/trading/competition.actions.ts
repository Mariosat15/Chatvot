/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
// Reason: CreditWallet and WalletTransaction were imported only by the deleted
// enterCompetition. Nothing in this app moves competition entry money any more.
import TradingRiskSettings from "@/database/models/trading-risk-settings.model";
import mongoose from "mongoose";

// Get all competitions with filters
export const getCompetitions = async (filters?: {
  status?: "upcoming" | "active" | "completed" | "cancelled";
  limit?: number;
}) => {
  try {
    await connectToDatabase();

     
    const query: any = {};
    if (filters?.status) {
      query.status = filters.status;
    }

    const competitions = await Competition.find(query)
      .sort({ startTime: -1 })
      .limit(filters?.limit || 50)
      .lean();

    return JSON.parse(JSON.stringify(competitions));
  } catch (error) {
    console.error("Error getting competitions:", error);
    throw new Error("Failed to get competitions");
  }
};

// Get single competition by ID
export const getCompetitionById = async (competitionId: string) => {
  "use no memo"; // CRITICAL: Disable Next.js caching for real-time data

  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      throw new Error("Invalid competition ID format");
    }

    await connectToDatabase();

    let competition = (await Competition.findById(competitionId).lean()) as any;

    if (!competition) {
      throw new Error("Competition not found");
    }

    // Get participant count
    const participantCount = await CompetitionParticipant.countDocuments({
      competitionId: competitionId,
      status: "active",
    });

    const now = new Date();
    const startTime = new Date(competition.startTime);
    const minParticipants = competition.minParticipants || 2;

    // CRITICAL: Check if competition should be cancelled due to insufficient participants
    // This is a backup check in case Inngest cron isn't running
    if (competition.status === "upcoming" && startTime <= now) {
      const actualParticipants =
        competition.currentParticipants || participantCount;

      if (actualParticipants < minParticipants) {
        // Cancel the competition and refund all participants
        console.log(
          `🚫 AUTO-CANCELLING "${competition.name}" - only ${actualParticipants}/${minParticipants} participants`,
        );

        try {
          const { cancelCompetitionAndRefund } =
            await import("@/lib/actions/trading/competition-cancel.actions");
          await cancelCompetitionAndRefund(
            competitionId,
            `Competition cancelled - did not meet minimum ${minParticipants} participants (only ${actualParticipants} joined)`,
          );

          // Refresh the competition data
          competition = (await Competition.findById(
            competitionId,
          ).lean()) as any;
        } catch (cancelError) {
          console.error("Error cancelling competition:", cancelError);
        }
      } else {
        // Start the competition - it has enough participants
        console.log(
          `✅ AUTO-STARTING "${competition.name}" - ${actualParticipants}/${minParticipants} participants`,
        );
        await Competition.findByIdAndUpdate(competitionId, {
          $set: { status: "active" },
        });
        competition = (await Competition.findById(competitionId).lean()) as any;
      }
    }

    // Also check if an 'active' competition should have been cancelled (edge case)
    // This catches competitions that were incorrectly started without meeting min participants
    if (competition.status === "active") {
      const actualParticipants =
        competition.currentParticipants || participantCount;

      // If competition doesn't meet minimum participants, cancel it regardless of how long it's been active
      // This is a safety check - competitions should NEVER start without meeting minimum
      if (actualParticipants < minParticipants) {
        console.log(
          `🚫 CANCELLING ACTIVE "${competition.name}" - only ${actualParticipants}/${minParticipants} participants (should never have started!)`,
        );

        try {
          const { cancelCompetitionAndRefund } =
            await import("@/lib/actions/trading/competition-cancel.actions");
          await cancelCompetitionAndRefund(
            competitionId,
            `Competition cancelled - did not meet minimum ${minParticipants} participants (only ${actualParticipants} joined)`,
          );

          competition = (await Competition.findById(
            competitionId,
          ).lean()) as any;
        } catch (cancelError) {
          console.error("Error cancelling active competition:", cancelError);
        }
      }
    }

    return JSON.parse(JSON.stringify({ ...competition, participantCount }));
  } catch (error) {
    console.error("Error getting competition:", error);
    throw new Error("Failed to get competition");
  }
};

// Create new competition (admin only)
export const createCompetition = async (competitionData: {
  name: string;
  description: string;
  entryFeeCredits: number;
  startingTradingPoints: number;
  minParticipants?: number;
  maxParticipants: number;
  startTime: Date;
  endTime: Date;
  assetClasses: ("stocks" | "forex" | "crypto")[];
  allowedSymbols?: string[];
  leverageAllowed?: number;
  prizeDistribution: { rank: number; percentage: number }[];
  platformFeePercentage: number;
  rules?: {
    rankingMethod:
      | "pnl"
      | "roi"
      | "total_capital"
      | "win_rate"
      | "total_wins"
      | "profit_factor";
    tieBreaker1:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    tieBreaker2?:
      | "trades_count"
      | "win_rate"
      | "total_capital"
      | "roi"
      | "join_time"
      | "split_prize";
    minimumTrades: number;
    minimumWinRate?: number;
    tiePrizeDistribution: "split_equally" | "split_weighted" | "first_gets_all";
    disqualifyOnLiquidation: boolean;
  };
  levelRequirement?: {
    enabled: boolean;
    minLevel: number;
    maxLevel?: number;
  };
  riskLimits?: {
    enabled: boolean;
    maxDrawdownPercent: number;
    dailyLossLimitPercent: number;
    equityCheckEnabled: boolean;
    equityDrawdownPercent: number;
  };
  difficulty?: {
    mode: "auto" | "manual";
    manualLevel?:
      | "beginner"
      | "intermediate"
      | "advanced"
      | "expert"
      | "extreme";
  };
}) => {
  try {
    const admin = await getAdminSession();
    if (!admin) redirect("/sign-in");

    await connectToDatabase();

    // Reason: there is deliberately NO market-hours check here. Creating a competition is
    // scheduling one, not playing it - an operator setting up Monday's contest on a Sunday
    // is doing something entirely legitimate, and this action used to refuse it. Removed
    // by owner decision, 4 September 2026, extending the 1 September decision that joining
    // a contest outside market hours is allowed and only trading itself is gated.
    //
    // Nothing is weakened by removing it. The gate that matters is on order placement in
    // `order.actions.ts`, which is untouched: a competition created at the weekend simply
    // cannot be traded in until the market opens. The main app's equivalent action never
    // had this check, so the two apps now agree rather than differing by accident.
    //
    // The market-HOLIDAY overlap warning further down is a different thing and stays. It
    // informs the operator; it does not refuse them.

    // Validate prize distribution totals 100%
    const totalPrizePercentage = competitionData.prizeDistribution.reduce(
      (sum, prize) => sum + prize.percentage,
      0,
    );

    if (Math.abs(totalPrizePercentage - 100) > 0.01) {
      throw new Error("Prize distribution must total 100%");
    }

    // ⏰ CHECK MARKET HOLIDAYS - Warn if competition overlaps with market closures
    try {
      const startDate = new Date(competitionData.startTime);
      const endDate = new Date(competitionData.endTime);

      // Fetch upcoming holidays from Massive.com API
      const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
      if (MASSIVE_API_KEY) {
        const holidaysRes = await fetch(
          `https://api.massive.com/v1/marketstatus/upcoming?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`,
          { headers: { Accept: "application/json" } },
        );

        if (holidaysRes.ok) {
          const holidaysData = await holidaysRes.json();
          const holidays = holidaysData?.response || [];

          // Check for forex market closures during competition period
          for (const holiday of holidays) {
            if (holiday.status === "closed") {
              const holidayDate = new Date(holiday.date);
              if (holidayDate >= startDate && holidayDate <= endDate) {
                console.warn(
                  `⚠️ Competition "${competitionData.name}" overlaps with market holiday: ${holiday.name} on ${holiday.date}`,
                );
                // Note: We warn but don't block - admin can decide to proceed
              }
            }
          }
        }
      }
    } catch (holidayError) {
      console.warn("⚠️ Could not check market holidays:", holidayError);
      // Non-blocking - continue with competition creation
    }

    // Validate dates
    if (new Date(competitionData.startTime) <= new Date()) {
      throw new Error("Start time must be in the future");
    }

    if (
      new Date(competitionData.endTime) <= new Date(competitionData.startTime)
    ) {
      throw new Error("End time must be after start time");
    }

    // Generate slug from name with auto-increment for duplicates
    const baseSlug = competitionData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let counter = 1;

    // Check for existing slugs and increment if needed
    while (await Competition.findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // Reason: Registration stays open until the competition starts.
    // Setting deadline = startTime prevents the old bug where -1hr made
    // near-future competitions immediately show "Registration Closed".
    const registrationDeadline = new Date(competitionData.startTime);

    // Fetch current trading risk settings to save with competition
    // Use getSingleton() which uses the correct ID 'global-trading-risk-settings'
    const riskSettings = await TradingRiskSettings.getSingleton();
    const tradingRiskDefaults = {
      maxLeverage: riskSettings.maxLeverage,
      minLeverage: riskSettings.minLeverage,
      defaultLeverage: riskSettings.defaultLeverage,
      marginLiquidation: riskSettings.marginLiquidation,
      marginCall: riskSettings.marginCall,
      marginWarning: riskSettings.marginWarning,
      marginSafe: riskSettings.marginSafe,
      maxOpenPositions: riskSettings.maxOpenPositions,
      maxPositionSize: riskSettings.maxPositionSize,
    };

    console.log(
      "📊 Using trading risk settings for competition:",
      tradingRiskDefaults,
    );

    const competition = await Competition.create({
      name: competitionData.name,
      description: competitionData.description,
      slug,
      entryFee: competitionData.entryFeeCredits, // Map to correct field name
      startingCapital: competitionData.startingTradingPoints, // Map to correct field name
      minParticipants: competitionData.minParticipants || 2,
      maxParticipants: competitionData.maxParticipants,
      currentParticipants: 0,
      startTime: competitionData.startTime,
      endTime: competitionData.endTime,
      registrationDeadline,
      status: "upcoming",
      assetClasses: competitionData.assetClasses,
      allowedSymbols: competitionData.allowedSymbols || [],
      blockedSymbols: [],
      leverage: {
        enabled: true,
        min: tradingRiskDefaults.minLeverage,
        max: tradingRiskDefaults.maxLeverage,
        default: tradingRiskDefaults.defaultLeverage,
      },
      competitionType: "time_based",
      prizePool: 0,
      platformFeePercentage: competitionData.platformFeePercentage,
      prizeDistribution: competitionData.prizeDistribution,
      rules: competitionData.rules || {
        rankingMethod: "pnl",
        tieBreaker1: "trades_count",
        minimumTrades: 0,
        tiePrizeDistribution: "split_equally",
        disqualifyOnLiquidation: true,
      },
      levelRequirement: competitionData.levelRequirement || {
        enabled: false,
        minLevel: 1,
      },
      maxPositionSize: tradingRiskDefaults.maxPositionSize,
      maxOpenPositions: tradingRiskDefaults.maxOpenPositions,
      allowShortSelling: true,
      // Save margin settings from risk settings
      marginSettings: {
        liquidation: tradingRiskDefaults.marginLiquidation,
        call: tradingRiskDefaults.marginCall,
        warning: tradingRiskDefaults.marginWarning,
        safe: tradingRiskDefaults.marginSafe,
      },
      marginCallThreshold: tradingRiskDefaults.marginCall,
      riskLimits: competitionData.riskLimits || {
        maxDrawdownPercent: 50,
        dailyLossLimitPercent: 20,
        equityDrawdownPercent: 30,
        equityCheckEnabled: false,
        enabled: false,
      },
      difficulty: competitionData.difficulty || {
        mode: "auto",
      },
      createdBy: admin.id,
    });

    revalidatePath("/competitions");
    revalidatePath("/competitions");

    console.log(
      `✅ Competition created: ${competition.name} (ID: ${competition._id})`,
    );

    return JSON.parse(JSON.stringify(competition));
  } catch (error) {
    console.error("Error creating competition:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to create competition",
    );
  }
};

// Reason: the admin copy of enterCompetition was DELETED on 1 September 2026.
//
// It was dead code - nothing in this app imported it - and it had drifted from the copy
// in the main app: no email-verification check and no fraud gate, and it threw instead of
// returning { success: false, error }, which crashes a server-component render. Keeping a
// weaker duplicate around invites a future admin feature to use it by accident.
//
// If admin ever needs to enter a user into a competition, call the unified entry service
// rather than reinstating this. Do not copy the main app version back here.

// Get competition leaderboard
export const getCompetitionLeaderboard = async (
  competitionId: string,
  limit: number = 100,
) => {
  "use no memo"; // CRITICAL: Disable Next.js caching for real-time data

  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      throw new Error("Invalid competition ID format");
    }

    await connectToDatabase();

    // Get competition to access rules
    const competition = (await Competition.findById(
      competitionId,
    ).lean()) as any;
    if (!competition) {
      throw new Error("Competition not found");
    }

    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    }).lean();

    // Import ranking service and level service
    const { calculateRankings } =
      await import("@/lib/services/competition-ranking.service");
    const { getUsersWithTitles } =
      await import("@/lib/services/xp-level.service");
    const { getTitleByXP } = await import("@/lib/constants/levels");

    // Prepare participant data
     
    const participantData = participants.map((p: any) => ({
      userId: p.userId,
      username: p.username || "Anonymous",
      currentCapital: p.currentCapital,
      pnl: p.pnl,
      pnlPercentage: p.pnlPercentage,
      totalTrades: p.totalTrades,
      winningTrades: p.winningTrades,
      losingTrades: p.losingTrades,
      winRate: p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0,
      status: p.status,
      enteredAt: p.enteredAt,
      startingCapital: p.startingCapital,
    }));

    // Use competition rules or defaults
    const rules = competition.rules || {
      rankingMethod: "pnl" as const,
      tieBreaker1: "trades_count" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: true,
    };

    // Calculate rankings with tie-breaking
    // Only check minimum trades when competition is completed
    const rankedParticipants = calculateRankings(participantData, rules, {
      competitionStatus: competition.status as
        | "upcoming"
        | "active"
        | "completed"
        | "cancelled",
      // Reason: this is a READ path and is deliberately not gated on game type - a
      // leaderboard must render for any contest. But it must rank by the right metric.
      // Without the label it would rank a provider contest by trading PnL, which every
      // participant has as zero: no error, no empty state, just a leaderboard that is
      // quietly wrong. Same failure shape as the trading-shaped services in R/X13.
      gameType: competition.gameType as string | undefined,
    });

    // Limit results
    const limitedParticipants = rankedParticipants.slice(0, limit);

    // Get user titles for all participants
    const userIds = limitedParticipants.map((p) => p.userId);
    const userLevels = await getUsersWithTitles(userIds);

    // Map to include tie information and titles
    const result = limitedParticipants.map((p) => {
      const originalParticipant = participants.find(
        (orig) => orig.userId === p.userId,
      );
      const userLevel = userLevels.get(p.userId);

      // Get title info - always show at least default level
      let titleLevel;
      if (userLevel) {
        titleLevel = getTitleByXP(userLevel.currentXP);
      } else {
        // Default to Novice Trader for users without levels
        titleLevel = getTitleByXP(0);
      }

      return {
        ...originalParticipant,
        currentRank: p.rank,
        isTied: p.isTied,
        tiedWith: p.tiedWith,
        qualificationStatus: p.qualificationStatus,
        disqualificationReason: p.disqualificationReason,
        userTitle: titleLevel.title,
        userTitleIcon: titleLevel.icon,
        userTitleColor: titleLevel.color,
      };
    });

    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    throw new Error("Failed to get leaderboard");
  }
};

// Get user's competitions
export const getUserCompetitions = async (status?: "active" | "completed") => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    await connectToDatabase();

     
    const query: any = { userId: session.user.id };
    if (status) {
      query.status = status;
    }

    const participants = await CompetitionParticipant.find(query)
      .sort({ enteredAt: -1 })
      .lean();

    // Get competition details for each
    const competitionIds = participants.map((p) => p.competitionId);
    const competitions = await Competition.find({
      _id: { $in: competitionIds },
    }).lean();

    // Merge data
    const userCompetitions = participants.map((participant) => {
      const competition = competitions.find(
         
        (c: any) => c._id.toString() === participant.competitionId,
      );
      return {
        ...participant,
        competition: competition,
      };
    });

    return JSON.parse(JSON.stringify(userCompetitions));
  } catch (error) {
    console.error("Error getting user competitions:", error);
    throw new Error("Failed to get user competitions");
  }
};

// Check if user is in competition
export const isUserInCompetition = async (competitionId: string) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return false;
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return false;

    await connectToDatabase();

    const participant = await CompetitionParticipant.findOne({
      competitionId: competitionId,
      userId: session.user.id,
    });

    return !!participant;
  } catch (error) {
    console.error("Error checking user in competition:", error);
    return false;
  }
};

// Get user's participant data for a competition
export const getUserParticipant = async (competitionId: string) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return null;
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    await connectToDatabase();

    const participant = await CompetitionParticipant.findOne({
      competitionId: competitionId,
      userId: session.user.id,
    }).lean();

    if (!participant) {
      return null;
    }

    return JSON.parse(JSON.stringify(participant));
  } catch (error) {
    console.error("Error getting user participant:", error);
    throw new Error("Failed to get participant data");
  }
};

// Get user's current winning streak
export const getUserStreak = async (competitionId: string) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return 0;
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return 0;

    await connectToDatabase();

    const participant = await CompetitionParticipant.findOne({
      competitionId: competitionId,
      userId: session.user.id,
    }).lean();

    if (!participant) return 0;

    // Get recent closed trades (most recent first)
    const TradeHistory = (
      await import("@/database/models/trading/trade-history.model")
    ).default;
    const participantId = String((participant as any)._id);
    const recentTrades = await TradeHistory.find({
      participantId,
    })
      .sort({ closedAt: -1 })
      .limit(20)
      .lean();

    if (recentTrades.length === 0) return 0;

    // Count consecutive winning trades from the most recent
    let streak = 0;
    for (const trade of recentTrades) {
      if (trade.isWinner) {
        streak++;
      } else {
        break; // Streak broken
      }
    }

    return streak;
  } catch (error) {
    console.error("Error getting user streak:", error);
    return 0;
  }
};

// Update competition status (admin/system)
export const updateCompetitionStatus = async (
  competitionId: string,
  status: "upcoming" | "active" | "completed" | "cancelled",
) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      throw new Error("Invalid competition ID format");
    }

    await connectToDatabase();

    await Competition.findByIdAndUpdate(competitionId, { status });

    revalidatePath("/competitions");
    revalidatePath(`/competitions/${competitionId}`);

    console.log(`✅ Competition ${competitionId} status updated to ${status}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating competition status:", error);
    throw new Error("Failed to update competition status");
  }
};
