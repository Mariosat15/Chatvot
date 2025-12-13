import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionById } from '@/lib/actions/trading/competition.actions';

/**
 * GET /api/competitions/[id]/status
 * Returns the current status of a competition
 * Used for polling to detect when competition ends
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get competition
    const competition = await getCompetitionById(id);
    
    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    // Return status and relevant info
    return NextResponse.json({
      status: competition.status,
      endTime: competition.endTime,
      currentTime: new Date().toISOString(),
      cancellationReason: competition.cancellationReason || null,
    });
  } catch (error) {
    console.error('Error fetching competition status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competition status' },
      { status: 500 }
    );
  }
}

