import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import TradingPosition from '@/database/models/trading/trading-position.model';
import { Types } from 'mongoose';

/**
 * POST /api/simulator/orders
 * Simulator endpoint to create trading positions
 */
export async function POST(request: NextRequest) {
  // Only allow in development or with simulator mode header
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { 
      userId,
      competitionId,
      symbol = 'EUR/USD',
      side = 'long',
      quantity = 1,
      entryPrice,
      takeProfit,
      stopLoss,
      leverage = 50,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Generate a realistic entry price if not provided
    const price = entryPrice || (symbol.includes('EUR/USD') ? 1.0850 + (Math.random() * 0.01 - 0.005) : 100 + Math.random() * 10);
    const marginUsed = (quantity * price * 100000) / leverage; // Standard forex lot size
    const orderId = new Types.ObjectId().toString();

    // Create position
    const position = new TradingPosition({
      userId,
      competitionId: competitionId || 'simulator-sandbox',
      participantId: `sim-participant-${userId}`,
      symbol: symbol.toUpperCase(),
      side,
      quantity,
      orderType: 'market',
      entryPrice: price,
      currentPrice: price,
      unrealizedPnl: 0,
      unrealizedPnlPercentage: 0,
      stopLoss: stopLoss || (side === 'long' ? price * 0.98 : price * 1.02),
      takeProfit: takeProfit || (side === 'long' ? price * 1.02 : price * 0.98),
      leverage,
      marginUsed,
      maintenanceMargin: marginUsed * 0.5,
      status: 'open',
      openedAt: new Date(),
      openOrderId: orderId,
      lastPriceUpdate: new Date(),
      priceUpdateCount: 1,
      metadata: {
        simulatorMode: true,
      },
    });

    await position.save();

    return NextResponse.json({
      success: true,
      position: {
        _id: position._id.toString(),
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
      },
    });
  } catch (error) {
    console.error('Simulator order creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
