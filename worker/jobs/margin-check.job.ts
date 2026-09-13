/**
 * Margin Check Job
 *
 * Runs every 1 minute to check all users' margins and liquidate if needed.
 * This is a BACKUP to the client-side real-time checks.
 *
 * Handles BOTH competitions AND challenges.
 *
 * Benefits:
 * - Catches users who disconnect before liquidation
 * - Ensures no one escapes margin call
 * - Runs independently of user actions
 */

import { connectToDatabase } from "../config/database";

// Import models directly
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import ChallengeParticipant from "../../database/models/trading/challenge-participant.model";
import TradingPosition from "../../database/models/trading/trading-position.model";
import Competition from "../../database/models/trading/competition.model";
import Challenge from "../../database/models/trading/challenge.model";

// Import services directly
import { fetchRealForexPrices } from "../../lib/services/real-forex-prices.service";
import {
  calculateUnrealizedPnL,
  ForexSymbol,
} from "../../lib/services/pnl-calculator.service";
import { getMarginStatus } from "../../lib/services/risk-manager.service";
import { closePositionAutomatic } from "../../lib/actions/trading/position.actions";

// Get risk settings dynamically (might not exist)
async function getRiskSettings() {
  try {
    const TradingRiskSettings = (
      await import("../../database/models/trading-risk-settings.model")
    ).default;
    return await TradingRiskSettings.findOne();
  } catch {
    return null;
  }
}

export interface MarginCheckResult {
  checkedParticipants: number;
  liquidatedUsers: number;
  liquidatedPositions: number;
  errors: string[];
}

/**
 * Helper: check a batch of participants (competition OR challenge) for margin calls.
 * Reusable for both competition and challenge participants.
 */
async function checkParticipantBatch(
  participants: any[],
  pricesMap: Map<ForexSymbol, any>,
  thresholds: { liquidation: number; marginCall: number; warning: number },
  contestMap: Map<string, any>,
  ParticipantModel: typeof CompetitionParticipant | typeof ChallengeParticipant,
  contestIdField: "competitionId" | "challengeId",
  result: MarginCheckResult,
): Promise<void> {
  if (participants.length === 0) return;

  // Load ALL open positions in a single query
  const allParticipantIds = participants.map((p) => p._id);
  const allPositions = await TradingPosition.find({
    participantId: { $in: allParticipantIds },
    status: "open",
  })
    .select("_id participantId symbol side entryPrice quantity")
    .lean();

  // Group positions by participant and collect unique symbols
  const participantPositions = new Map<string, any[]>();
  const newSymbols = new Set<ForexSymbol>();

  for (const position of allPositions) {
    const participantId = position.participantId.toString();
    if (!participantPositions.has(participantId)) {
      participantPositions.set(participantId, []);
    }
    participantPositions.get(participantId)!.push(position);

    const sym = position.symbol as ForexSymbol;
    if (!pricesMap.has(sym)) {
      newSymbols.add(sym);
    }
  }

  // Fetch any new prices not already in the map
  if (newSymbols.size > 0) {
    const fetched = await fetchRealForexPrices(Array.from(newSymbols));
    for (const [k, v] of fetched) {
      pricesMap.set(k, v);
    }
  }

  // Check each participant
  for (const participant of participants) {
    result.checkedParticipants++;

    const positions = participantPositions.get(participant._id.toString());
    if (!positions || positions.length === 0) continue;

    try {
      // Calculate total unrealized P&L
      let totalUnrealizedPnl = 0;

      for (const position of positions) {
        const currentPrice = pricesMap.get(position.symbol);
        if (!currentPrice) continue;

        const marketPrice =
          position.side === "long" ? currentPrice.bid : currentPrice.ask;
        const unrealizedPnl = calculateUnrealizedPnL(
          position.side,
          position.entryPrice,
          marketPrice,
          position.quantity,
          position.symbol,
        );

        totalUnrealizedPnl += unrealizedPnl;
      }

      // Check margin status
      const marginStatus = getMarginStatus(
        participant.currentCapital,
        totalUnrealizedPnl,
        participant.usedMargin,
        thresholds,
      );

      // Liquidate if needed
      if (marginStatus.status === "liquidation") {
        result.liquidatedUsers++;

        // Close all positions for this user
        for (const position of positions) {
          try {
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice) continue;

            const marketPrice =
              position.side === "long" ? currentPrice.bid : currentPrice.ask;
            await closePositionAutomatic(
              position._id.toString(),
              marketPrice,
              "margin_call",
            );
            result.liquidatedPositions++;
          } catch (posError) {
            result.errors.push(
              `Failed to close position ${position._id}: ${posError}`,
            );
          }
        }

        // Mark participant as liquidated using correct model
        await ParticipantModel.findByIdAndUpdate(participant._id, {
          $set: {
            status: "liquidated",
            liquidationReason: `Margin call at ${marginStatus.marginLevel.toFixed(2)}%`,
            currentOpenPositions: 0,
          },
        });

        // Send liquidation notification
        try {
          const { sendNotification } =
            await import("../../lib/services/notification.service");
          await sendNotification({
            userId: participant.userId,
            type: "liquidation",
            metadata: { symbol: "All positions" },
          });
        } catch {
          // Notification failure is not critical
        }

        // Send disqualification notification if contest has disqualifyOnLiquidation
        try {
          const contestId = participant[contestIdField]?.toString();
          const contest = contestMap.get(contestId);
          if ((contest as any)?.rules?.disqualifyOnLiquidation) {
            const { sendNotification } =
              await import("../../lib/services/notification.service");
            await sendNotification({
              userId: participant.userId,
              type: "competition_disqualified",
              metadata: {
                competitionId: contestId,
                competitionName: (contest as any).name,
                reason: `Liquidated (margin level dropped to ${marginStatus.marginLevel.toFixed(2)}%)`,
              },
            });
          }
        } catch (notifError) {
          console.error(
            `   ❌ Failed to send disqualification notification:`,
            notifError,
          );
        }
      }
    } catch (participantError) {
      result.errors.push(
        `Error processing participant ${participant._id}: ${participantError}`,
      );
    }
  }
}

export async function runMarginCheck(): Promise<MarginCheckResult> {
  const result: MarginCheckResult = {
    checkedParticipants: 0,
    liquidatedUsers: 0,
    liquidatedPositions: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Get admin thresholds
    let liquidationThreshold = 50;
    let marginCallThreshold = 100;
    let warningThreshold = 150;

    try {
      const riskSettings = await getRiskSettings();
      if (riskSettings) {
        liquidationThreshold = riskSettings.marginLiquidation ?? 50;
        marginCallThreshold = riskSettings.marginCall ?? 100;
        warningThreshold = riskSettings.marginWarning ?? 150;
      }
    } catch {
      // Use defaults
    }

    const thresholds = {
      liquidation: liquidationThreshold,
      marginCall: marginCallThreshold,
      warning: warningThreshold,
    };

    // Shared price map across competitions and challenges (avoids duplicate fetches)
    const pricesMap = new Map<ForexSymbol, any>();

    // ============================================
    // 1. CHECK COMPETITIONS FOR MARGIN
    // ============================================
    const activeCompetitions = await Competition.find({ status: "active" })
      .select("_id name rules")
      .lean();

    if (activeCompetitions.length > 0) {
      const activeCompetitionIds = activeCompetitions.map((c) => c._id);

      const compParticipants = await CompetitionParticipant.find({
        competitionId: { $in: activeCompetitionIds },
        status: "active",
        currentOpenPositions: { $gt: 0 },
      })
        .select("_id userId competitionId currentCapital usedMargin currentOpenPositions")
        .lean();

      const competitionMap = new Map<string, any>();
      for (const comp of activeCompetitions) {
        competitionMap.set((comp._id as any).toString(), comp);
      }

      await checkParticipantBatch(
        compParticipants,
        pricesMap,
        thresholds,
        competitionMap,
        CompetitionParticipant as any,
        "competitionId",
        result,
      );
    }

    // ============================================
    // 2. CHECK CHALLENGES FOR MARGIN
    // ============================================
    const activeChallenges = await Challenge.find({ status: "active" })
      .select("_id name rules")
      .lean();

    if (activeChallenges.length > 0) {
      const activeChallengeIds = activeChallenges.map((c) => c._id);

      const challengeParticipants = await ChallengeParticipant.find({
        challengeId: { $in: activeChallengeIds },
        status: "active",
        currentOpenPositions: { $gt: 0 },
      })
        .select("_id userId challengeId currentCapital usedMargin currentOpenPositions")
        .lean();

      const challengeMap = new Map<string, any>();
      for (const ch of activeChallenges) {
        challengeMap.set((ch._id as any).toString(), ch);
      }

      await checkParticipantBatch(
        challengeParticipants,
        pricesMap,
        thresholds,
        challengeMap,
        ChallengeParticipant as any,
        "challengeId",
        result,
      );
    }

    return result;
  } catch (error) {
    result.errors.push(`Critical error in margin check: ${error}`);
    return result;
  }
}

export default runMarginCheck;
