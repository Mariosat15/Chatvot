import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TradingPosition from "@/database/models/trading/trading-position.model";
import {
  guardSimulatorRoute,
  getSimulatorUserId,
} from "@/lib/services/simulator/simulator-mode";

/**
 * POST /api/simulator/positions/tpsl
 * Simulator endpoint to modify TP/SL on positions
 * Can modify by positionId or userId (modifies all user's open positions)
 */
export async function POST(request: NextRequest) {
  // Reason: this route rewrites take-profit and stop-loss on arbitrary
  // accounts' positions, so it requires the internal secret. Note the previous
  // guard also accepted X-Simulator-User-Id on its own.
  const guard = guardSimulatorRoute(request);
  if (guard) return guard;

  try {
    const body = await request.json();
    const { positionId, userId, takeProfit, stopLoss } = body;
    const effectiveUserId = userId || getSimulatorUserId(request);

    await connectToDatabase();

    let positions;

    if (positionId) {
      // Modify specific position
      const position = await TradingPosition.findById(positionId);
      if (!position) {
        return NextResponse.json(
          { success: false, error: "Position not found" },
          { status: 404 },
        );
      }
      positions = [position];
    } else if (effectiveUserId) {
      // Modify all open positions for the user
      positions = await TradingPosition.find({
        userId: effectiveUserId,
        status: "open",
      });

      if (positions.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No open positions found for user",
          modifiedCount: 0,
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: "positionId or userId is required" },
        { status: 400 },
      );
    }

    // Update TP/SL on all found positions
    let modifiedCount = 0;
    for (const position of positions) {
      let modified = false;

      if (takeProfit !== undefined) {
        position.takeProfit = takeProfit;
        modified = true;
      }
      if (stopLoss !== undefined) {
        position.stopLoss = stopLoss;
        modified = true;
      }

      if (modified) {
        await position.save();
        modifiedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      modifiedCount,
      positions: positions.map((p) => ({
        _id: p._id.toString(),
        symbol: p.symbol,
        takeProfit: p.takeProfit,
        stopLoss: p.stopLoss,
      })),
    });
  } catch (error) {
    console.error("Simulator TP/SL modification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
