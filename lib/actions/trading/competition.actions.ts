"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import mongoose from "mongoose";
// Static imports for better performance (no dynamic import overhead)
import { calculateRankings } from "@/lib/services/competition-ranking.service";
import { getUsersWithTitles } from "@/lib/services/xp-level.service";
import { getTitleByXP } from "@/lib/constants/levels";

// Get all competitions with filters
export const getCompetitions = async (filters?: {
  status?: "upcoming" | "active" | "completed" | "cancelled";
  limit?: number;
}) => {
  try {
    await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // AUTO-FINALIZE: If competition is active but end time has passed, finalize it immediately
      // This provides instant finalization when user accesses the page - no waiting for worker
      const endTime = new Date(competition.endTime);
      if (endTime <= now) {
        console.log(
          `🏁 AUTO-FINALIZING "${competition.name}" on access - end time passed`,
        );

        try {
          const { finalizeCompetition } =
            await import("@/lib/actions/trading/competition-end.actions");
          await finalizeCompetition(competitionId);

          // Refresh the competition data
          competition = (await Competition.findById(
            competitionId,
          ).lean()) as any;
          console.log(
            `✅ Competition "${competition.name}" auto-finalized successfully`,
          );
        } catch (finalizeError) {
          console.error("Error auto-finalizing competition:", finalizeError);
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
}) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    // TODO: Add admin check here
    // if (!session.user.isAdmin) throw new Error('Unauthorized');

    await connectToDatabase();

    // Validate prize distribution totals 100%
    const totalPrizePercentage = competitionData.prizeDistribution.reduce(
      (sum, prize) => sum + prize.percentage,
      0,
    );

    if (Math.abs(totalPrizePercentage - 100) > 0.01) {
      throw new Error("Prize distribution must total 100%");
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

    // Set registration deadline to 1 hour before start time
    const registrationDeadline = new Date(competitionData.startTime);
    registrationDeadline.setHours(registrationDeadline.getHours() - 1);

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
        min: 1,
        max: competitionData.leverageAllowed || 100,
        default: competitionData.leverageAllowed || 100,
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
      maxPositionSize: 100,
      maxOpenPositions: 10,
      allowShortSelling: true,
      marginCallThreshold: 50,
      riskLimits: competitionData.riskLimits || {
        maxDrawdownPercent: 50,
        dailyLossLimitPercent: 20,
        equityDrawdownPercent: 30,
        equityCheckEnabled: false,
        enabled: false,
      },
      createdBy: session.user.id,
    });

    revalidatePath("/competitions");
    revalidatePath("/admin/competitions");

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

// Enter competition (deduct credits, create participant)
export const enterCompetition = async (competitionId: string) => {
  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      throw new Error("Invalid competition ID format");
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    await connectToDatabase();

    // ✅ CHECK USER RESTRICTIONS
    console.log(
      `🔐 Checking competition entry restrictions for user ${session.user.id}`,
    );
    const { canUserPerformAction } =
      await import("@/lib/services/user-restriction.service");
    const restrictionCheck = await canUserPerformAction(
      session.user.id,
      "enterCompetition",
    );

    console.log(`   Restriction check result:`, restrictionCheck);

    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Entry blocked due to restrictions`);
      throw new Error(
        restrictionCheck.reason || "You are not allowed to enter competitions",
      );
    }

    console.log(`   ✅ User allowed to enter competition`);

    // Start MongoDB transaction
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    let committed = false;

    try {
      // Get competition
      const competition =
        await Competition.findById(competitionId).session(mongoSession);

      if (!competition) {
        throw new Error("Competition not found");
      }

      // Validate competition status
      if (
        competition.status !== "upcoming" &&
        competition.status !== "active"
      ) {
        throw new Error(
          competition.status === "cancelled"
            ? "This competition has been cancelled"
            : competition.status === "completed"
              ? "This competition has already ended"
              : "Competition is not open for entries"
        );
      }

      // Check if competition is full
      if (competition.currentParticipants >= competition.maxParticipants) {
        throw new Error("Competition is full");
      }

      // Check if user already entered
      const existingParticipant = await CompetitionParticipant.findOne({
        competitionId: competitionId,
        userId: session.user.id,
      }).session(mongoSession);

      if (existingParticipant) {
        throw new Error("You are already in this competition");
      }

      // Check level requirement
      if (
        competition.levelRequirement &&
        competition.levelRequirement.enabled
      ) {
        const { getUserLevel } =
          await import("@/lib/services/xp-level.service");
        const { getTitleByXP, TITLE_LEVELS } =
          await import("@/lib/constants/levels");

        const userLevel = await getUserLevel(session.user.id);
        const userTitleLevel = getTitleByXP((userLevel as any).currentXP || 0);

        // Check if user meets minimum level
        if (userTitleLevel.level < competition.levelRequirement.minLevel) {
          const requiredTitle =
            TITLE_LEVELS[competition.levelRequirement.minLevel - 1];
          throw new Error(
            `This competition requires ${requiredTitle.title} (Level ${requiredTitle.level}) or higher. You are currently ${userTitleLevel.title} (Level ${userTitleLevel.level}).`,
          );
        }

        // Check if user is below maximum level (if set)
        if (
          competition.levelRequirement.maxLevel &&
          userTitleLevel.level > competition.levelRequirement.maxLevel
        ) {
          const maxTitle =
            TITLE_LEVELS[competition.levelRequirement.maxLevel - 1];
          throw new Error(
            `This competition is only for traders up to ${maxTitle.title} (Level ${maxTitle.level}). You are ${userTitleLevel.title} (Level ${userTitleLevel.level}).`,
          );
        }
      }

      // Get user wallet
      const wallet = await CreditWallet.findOne({
        userId: session.user.id,
      }).session(mongoSession);

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      // Check balance
      if (wallet.creditBalance < competition.entryFee) {
        throw new Error(
          `Insufficient balance. Need €${competition.entryFee}, have €${wallet.creditBalance}`,
        );
      }

      // Deduct entry fee from wallet
      await CreditWallet.findOneAndUpdate(
        { userId: session.user.id },
        {
          $inc: {
            creditBalance: -competition.entryFee,
            totalSpentOnCompetitions: competition.entryFee,
          },
        },
        { session: mongoSession },
      );

      // Create transaction record
      await WalletTransaction.create(
        [
          {
            userId: session.user.id,
            transactionType: "competition_entry",
            amount: -competition.entryFee,
            balanceBefore: wallet.creditBalance,
            balanceAfter: wallet.creditBalance - competition.entryFee,
            currency: "CREDITS",
            status: "completed",
            referenceId: competitionId,
            description: `Entry fee for ${competition.name}`,
          },
        ],
        { session: mongoSession },
      );

      // Create competition participant
      const participant = await CompetitionParticipant.create(
        [
          {
            competitionId: competitionId,
            userId: session.user.id,
            username: session.user.name || session.user.email,
            email: session.user.email,
            startingCapital: competition.startingCapital,
            currentCapital: competition.startingCapital,
            availableCapital: competition.startingCapital,
            usedMargin: 0,
            pnl: 0,
            pnlPercentage: 0,
            realizedPnl: 0,
            unrealizedPnl: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            currentOpenPositions: 0,
            currentRank: 0,
            status: "active",
          },
        ],
        { session: mongoSession },
      );

      // Update competition (increment participants and prize pool)
      await Competition.findByIdAndUpdate(
        competitionId,
        {
          $inc: {
            currentParticipants: 1,
            prizePool: competition.entryFee,
          },
        },
        { session: mongoSession },
      );

      // Commit transaction
      await mongoSession.commitTransaction();
      committed = true;

      console.log(
        `✅ User ${session.user.id} entered competition ${competition.name}`,
      );
      console.log(`   Entry fee: €${competition.entryFee}`);
      console.log(`   Starting capital: $${competition.startingCapital}`);

      // Evaluate badges for the user (fire and forget - don't wait)
      try {
        const { evaluateUserBadges } =
          await import("@/lib/services/badge-evaluation.service");
        evaluateUserBadges(session.user.id)
          .then((result) => {
            if (result.newBadges.length > 0) {
              console.log(
                `🏅 User earned ${result.newBadges.length} new badges after entering competition`,
              );
            }
          })
          .catch((err) => console.error("Error evaluating badges:", err));
      } catch (error) {
        console.error("Error importing badge service:", error);
      }

      // Send notification about competition entry (fire and forget)
      try {
        const { notificationService } =
          await import("@/lib/services/notification.service");
        await notificationService.notifyCompetitionJoined(
          session.user.id,
          competition.name,
        );
        console.log(
          `🔔 Competition joined notification sent to user ${session.user.id}`,
        );
      } catch (error) {
        console.error("Error sending competition joined notification:", error);
      }

      // Track competition entry for coordination detection (fire and forget)
      try {
        const { CoordinationDetectionService } =
          await import("@/lib/services/fraud/coordination-detection.service");
        const { BehavioralAnalysisService } =
          await import("@/lib/services/fraud/behavioral-analysis.service");

        const entryTime = new Date();

        // Track entry in user's profile
        BehavioralAnalysisService.recordCompetitionEntry(session.user.id)
          .then(() => console.log("📝 Competition entry recorded in profile"))
          .catch((err) =>
            console.error("Error recording competition entry:", err),
          );

        // Get recent entries for this competition (use createdAt, not joinedAt)
        CompetitionParticipant.find({
          competitionId: competitionId,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        })
          .select("userId createdAt")
          .lean()
          .then(async (recentEntries) => {
            console.log(
              `🎯 Found ${recentEntries.length} entries in last 5 minutes for competition ${competitionId}`,
            );

            // Include current user in the entries
            const entries = recentEntries.map((e) => ({
              userId: e.userId.toString(),
              entryTime: new Date(e.createdAt),
            }));

            // Add current entry if not already in list
            if (!entries.some((e) => e.userId === session.user.id)) {
              entries.push({ userId: session.user.id, entryTime });
            }

            console.log(`🎯 Total entries to check: ${entries.length}`);

            // Need at least 2 entries for coordination detection
            if (entries.length >= 2) {
              console.log(
                `🎯 Running coordination detection for ${entries.length} entries`,
              );
              await CoordinationDetectionService.detectCoordinatedEntry(
                competitionId,
                entries,
              );
            }
          })
          .catch((err) =>
            console.error("Error checking coordinated entries:", err),
          );
      } catch (error) {
        console.error("Error in coordination detection:", error);
      }

      revalidatePath("/competitions");
      revalidatePath(`/competitions/${competitionId}`);
      revalidatePath("/wallet");

      return {
        success: true,
        message: "Successfully entered competition",
        // Reason: Mongoose create() returns array; guard for safety
        participant: JSON.parse(JSON.stringify(participant[0] ?? {})),
      };
    } catch (error) {
      if (!committed) {
        await mongoSession.abortTransaction();
      }
      throw error;
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    const msg =
      error instanceof Error ? error.message : "Failed to enter competition";
    console.error("Error entering competition:", msg);
    return { success: false as const, error: msg };
  }
};

// Get competition leaderboard
// OPTIMIZED: Static imports, O(n) lookups with Map, selective field loading
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
    const competition = (await Competition.findById(competitionId)
      .select("rules status")
      .lean()) as { rules?: Record<string, unknown>; status: string } | null;
    if (!competition) {
      throw new Error("Competition not found");
    }

    // OPTIMIZATION: Only select needed fields
    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    })
      .select(
        "userId username currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades status enteredAt startingCapital",
      )
      .lean();

    // OPTIMIZATION: Create Map for O(1) lookups instead of O(n) .find()
    const participantMap = new Map(participants.map((p) => [p.userId, p]));

    // Prepare participant data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const rules = (competition.rules as Record<string, unknown>) || {
      rankingMethod: "pnl" as const,
      tieBreaker1: "trades_count" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: true,
    };

    // Calculate rankings with tie-breaking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rankedParticipants = calculateRankings(
      participantData,
      rules as any,
      {
        competitionStatus: competition.status as
          | "upcoming"
          | "active"
          | "completed"
          | "cancelled",
      },
    );

    // Limit results
    const limitedParticipants = rankedParticipants.slice(0, limit);

    // Get user titles for all participants
    const userIds = limitedParticipants.map((p) => p.userId);
    const userLevels = await getUsersWithTitles(userIds);

    // OPTIMIZATION: O(n) mapping with Map lookup instead of O(n²) with .find()
    const result = limitedParticipants.map((p) => {
      const originalParticipant = participantMap.get(p.userId); // O(1) instead of O(n)
      const userLevel = userLevels.get(p.userId);
      const titleLevel = userLevel
        ? getTitleByXP(userLevel.currentXP)
        : getTitleByXP(0);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/** Batch: get competition IDs the user is in (avoids N+1 when listing many competitions). */
export const getCompetitionIdsUserIsIn = async (
  userId: string,
  competitionIds: string[],
): Promise<string[]> => {
  if (!userId || competitionIds.length === 0) return [];
  try {
    await connectToDatabase();
    const validIds = competitionIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
    if (validIds.length === 0) return [];
    const participants = await CompetitionParticipant.find({
      userId,
      competitionId: { $in: validIds },
    })
      .select("competitionId")
      .lean();
    return participants.map((p: any) => p.competitionId?.toString()).filter(Boolean);
  } catch (error) {
    console.error("Error getCompetitionIdsUserIsIn:", error);
    return [];
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
