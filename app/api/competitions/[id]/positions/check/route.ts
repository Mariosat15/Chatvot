import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import TradingPosition from '@/database/models/trading/trading-position.model';

/**
 * GET /api/competitions/[id]/positions/check
 * 
 * Lightweight endpoint to check current position IDs
 * Used by usePositionSync hook to detect when positions are closed
 * (e.g., by TP/SL triggers on the server)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: competitionId } = await params;

    await connectToDatabase();

    // Get only position IDs (lightweight query)
    // Using competitionId and userId - same query pattern as getUserPositions
    const positions = await TradingPosition.find(
      { 
        competitionId,
        userId: session.user.id,
        status: 'open'
      },
      { _id: 1 }
    ).lean();

    const positionIds = positions.map(p => p._id.toString());

    return NextResponse.json({
      positionIds,
      count: positionIds.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error checking positions:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

