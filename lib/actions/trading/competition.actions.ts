/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
// Reason: CreditWallet and WalletTransaction were used only by enterCompetition's inline
// money movement, which now lives in lib/services/contest-entry.service.ts. Entry money is
// moved in exactly one place; nothing in this file should touch a wallet again.
import mongoose from "mongoose";
// Static imports for better performance (no dynamic import overhead)
import { calculateRankings } from "@/lib/services/competition-ranking.service";
import { resolveScoreDirection } from "@/lib/services/games/score-direction.service";
import { getUsersWithTitles } from "@/lib/services/xp-level.service";
import { getTitleByXP } from "@/lib/constants/levels";

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
          // Reason: skipRevalidation=true because this runs inside getCompetitionById
          // which executes during SSR render — revalidatePath is forbidden during render.
          await cancelCompetitionAndRefund(
            competitionId,
            `Competition cancelled - did not meet minimum ${minParticipants} participants (only ${actualParticipants} joined)`,
            true, // skipRevalidation — called during render
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
          // Reason: skipRevalidation=true — same as above, called during render.
          await cancelCompetitionAndRefund(
            competitionId,
            `Competition cancelled - did not meet minimum ${minParticipants} participants (only ${actualParticipants} joined)`,
            true, // skipRevalidation — called during render
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

    // Reason: Registration stays open until the competition starts.
    // Setting deadline = startTime prevents the old bug where -1hr made
    // near-future competitions immediately show "Registration Closed".
    const registrationDeadline = new Date(competitionData.startTime);

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

/**
 * Enter a competition. The entrance the production UI uses.
 *
 * Stage 0, Defect 1: the guards and the money movement that used to live inline here now
 * live in `lib/services/contest-entry.service.ts`, shared with the API route so that the two
 * entrances cannot diverge again. What stays here is the part that is genuinely a server
 * action's job: reading the session, taking the client IP off the request, and revalidating
 * the paths whose cached output just went stale.
 *
 * Two behaviour changes came out of unifying, both deliberate and both recorded in the
 * service's header:
 *
 *   - Entering a competition you are already in now returns success instead of the error
 *     "You are already in this competition". No fee is taken either way.
 *   - The entry-fee ledger row is attributed with `competitionId`. This action used to write
 *     `referenceId`, which the schema does not declare, so strict mode discarded it.
 */
export const enterCompetition = async (competitionId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      requestHeaders.get("cf-connecting-ip") ||
      undefined;

    const { enterContest } = await import("@/lib/services/contest-entry.service");
    const result = await enterContest(competitionId, {
      userId: session.user.id,
      email: session.user.email || "",
      username: session.user.name || session.user.email || "",
      emailVerified:
        (session.user as { emailVerified?: boolean }).emailVerified === true,
      ip,
    });

    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    revalidatePath("/competitions");
    revalidatePath(`/competitions/${competitionId}`);
    revalidatePath("/wallet");

    return {
      success: true as const,
      message: result.alreadyEntered
        ? "You are already entered in this competition"
        : "Successfully entered competition",
      participantId: result.participantId,
      alreadyEntered: result.alreadyEntered,
    };
  } catch (error) {
    // Reason: `redirect()` works by throwing, and Next.js identifies its own control-flow
    // errors by a `digest` beginning with "NEXT_". Swallowing one turns a redirect into a
    // silent no-op, so they must be re-thrown before the generic handler runs.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    console.error("Error entering competition:", error);
    return {
      success: false as const,
      error: "Something went wrong. Please contact support.",
    };
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
      .select("rules status gameType gameKey")
      .lean()) as {
      rules?: Record<string, unknown>;
      status: string;
      gameType?: string;
      gameKey?: string;
    } | null;
    if (!competition) {
      throw new Error("Competition not found");
    }

    // OPTIMIZATION: Only select needed fields
    //
    // `score` is here because a provider contest ranks on it and nothing else. Its absence was
    // a live defect: the projection listed only trading metrics, so every provider participant
    // arrived at the ranking engine with `score` undefined, the engine read `score ?? 0`, and
    // the whole field tied on zero. The leaderboard still rendered, in an order decided by
    // whatever the tie-breakers or the document order happened to be. No error, no empty state.
    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    })
      .select(
        "userId username currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades status enteredAt startingCapital score",
      )
      .lean();

    // Which way this contest's scores rank, read once from the catalogue rather than per row.
    //
    // Reason it is resolved here and threaded onto every participant: direction is a property
    // of the TITLE, not of a player, so storing it per row would let two rows in one
    // leaderboard disagree - half the board negating and half not, which is incoherent rather
    // than merely wrong. `05` s2 rules that out, and settlement resolves it the same way
    // through the same function, so the live board and the payout cannot rank differently.
    const scoreDirection =
      competition.gameType === "provider"
        ? await resolveScoreDirection(competition.gameKey)
        : undefined;

    // OPTIMIZATION: Create Map for O(1) lookups instead of O(n) .find()
    const participantMap = new Map(participants.map((p) => [p.userId, p]));

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
      // The two fields a provider game ranks on. Raw, never pre-negated: the engine negates at
      // the moment of comparison so a race time shows as 92.4 seconds and not as -92.4.
      score: p.score,
      scoreDirection,
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
     
    const rankedParticipants = calculateRankings(
      participantData,
      rules as any,
      {
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
