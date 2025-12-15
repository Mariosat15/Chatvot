import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { 
  getRankedMatches, 
  findBestMatch,
  getMatchableTraders 
} from '@/lib/services/matchmaking.service';

// GET - Get ranked matches for card swiping or find best match
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'ranked';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (action === 'best') {
      // Find single best match
      const bestMatch = await findBestMatch(session.user.id);
      
      if (!bestMatch) {
        return NextResponse.json({
          success: false,
          message: 'No suitable matches found',
          match: null,
        });
      }

      return NextResponse.json({
        success: true,
        match: bestMatch,
      });
    }

    if (action === 'all') {
      // Get all matchable traders
      const traders = await getMatchableTraders(session.user.id);
      
      return NextResponse.json({
        success: true,
        traders,
        total: traders.length,
      });
    }

    // Default: Get ranked matches for card swiping
    const matches = await getRankedMatches(session.user.id, limit);

    return NextResponse.json({
      success: true,
      matches,
      total: matches.length,
    });
  } catch (error) {
    console.error('Error in matchmaking:', error);
    return NextResponse.json(
      { error: 'Failed to get matches' },
      { status: 500 }
    );
  }
}

