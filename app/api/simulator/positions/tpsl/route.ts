import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import TradingPosition from '@/database/models/trading/trading-position.model';

/**
 * POST /api/simulator/positions/tpsl
 * Simulator endpoint to modify TP/SL on positions
 * Can modify by positionId or userId (modifies all user's open positions)
 */
export async function POST(request: NextRequest) {
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const simulatorUserId = request.headers.get('X-Simulator-User-Id');
  const isDev = process.env.NODE_ENV === 'development';

  if ((!isSimulatorMode && !simulatorUserId) || !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { positionId, userId, takeProfit, stopLoss } = body;
    const effectiveUserId = userId || simulatorUserId;

    await connectToDatabase();

    let positions;
    
    if (positionId) {
      // Modify specific position
      const position = await TradingPosition.findById(positionId);
      if (!position) {
        return NextResponse.json(
          { success: false, error: 'Position not found' },
          { status: 404 }
        );
      }
      positions = [position];
    } else if (effectiveUserId) {
      // Modify all open positions for the user
      positions = await TradingPosition.find({ 
        userId: effectiveUserId, 
        status: 'open' 
      });
      
      if (positions.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No open positions found for user',
          modifiedCount: 0,
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'positionId or userId is required' },
        { status: 400 }
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
      positions: positions.map(p => ({
        _id: p._id.toString(),
        symbol: p.symbol,
        takeProfit: p.takeProfit,
        stopLoss: p.stopLoss,
      })),
    });
  } catch (error) {
    console.error('Simulator TP/SL modification error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
