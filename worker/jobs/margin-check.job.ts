/**
 * Margin Check Job
 *
 * Runs periodically to check all users' margins and liquidate if needed.
 * This is a BACKUP to the client-side real-time checks.
 *
 * Benefits:
 * - Catches users who disconnect before liquidation
 * - Ensures no one escapes margin call
 * - Runs independently of user actions
 */

import { connectToDatabase } from "../config/database";

// Import models directly
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";
import TradingPosition from "../../database/models/trading/trading-position.model";
import Competition from "../../database/models/trading/competition.model";

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

    // Get all active competitions
    const activeCompetitions = await Competition.find({ status: "active" });
    const activeCompetitionIds = activeCompetitions.map((c) => c._id);

    // Get all participants with open positions in active competitions
    const participantsWithPositions = await CompetitionParticipant.find({
      competitionId: { $in: activeCompetitionIds },
      status: "active",
      currentOpenPositions: { $gt: 0 },
    });

    if (participantsWithPositions.length === 0) {
      return result;
    }

    // Load ALL open positions in a single query (much faster than N queries)
    const allParticipantIds = participantsWithPositions.map((p) => p._id);
    const allPositions = await TradingPosition.find({
      participantId: { $in: allParticipantIds },
      status: "open",
    });

    // Group positions by participant and collect unique symbols
    const allSymbols = new Set<ForexSymbol>();
    const participantPositions = new Map<string, any[]>();

    for (const position of allPositions) {
      const participantId = position.participantId.toString();
      if (!participantPositions.has(participantId)) {
        participantPositions.set(participantId, []);
      }
      participantPositions.get(participantId)!.push(position);
      allSymbols.add(position.symbol as ForexSymbol);
    }

    // Fetch current prices for all symbols at once (efficient)
    const pricesMap = await fetchRealForexPrices(Array.from(allSymbols));

    // PERF: Pre-fetch all active competitions once to avoid N+1 Competition.findById in the loop
    const competitionMap = new Map<string, any>();
    for (const comp of activeCompetitions) {
      competitionMap.set(comp._id.toString(), comp);
    }

    // Check each participant
    for (const participant of participantsWithPositions) {
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
          {
            liquidation: liquidationThreshold,
            marginCall: marginCallThreshold,
            warning: warningThreshold,
          },
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

          // CRITICAL: After ALL positions are liquidated, mark participant as 'liquidated'
          // This is needed for disqualifyOnLiquidation rule to work correctly at competition end
          await CompetitionParticipant.findByIdAndUpdate(participant._id, {
            $set: {
              status: "liquidated",
              liquidationReason: `Margin call at ${marginStatus.marginLevel.toFixed(2)}%`,
              currentOpenPositions: 0,
            },
          });
          // Participant marked as liquidated

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

          // Send disqualification notification if competition has disqualifyOnLiquidation enabled
          try {
            // PERF: Use pre-fetched map instead of N+1 Competition.findById
            const competition = competitionMap.get(participant.competitionId?.toString());
            if ((competition as any)?.rules?.disqualifyOnLiquidation) {
              const { sendNotification } =
                await import("../../lib/services/notification.service");
              await sendNotification({
                userId: participant.userId,
                type: "competition_disqualified",
                metadata: {
                  competitionId: participant.competitionId,
                  competitionName: (competition as any).name,
                  reason: `Liquidated (margin level dropped to ${marginStatus.marginLevel.toFixed(2)}%)`,
                },
              });
              // Disqualification notification sent
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

    return result;
  } catch (error) {
    result.errors.push(`Critical error in margin check: ${error}`);
    return result;
  }
}

export default runMarginCheck;
