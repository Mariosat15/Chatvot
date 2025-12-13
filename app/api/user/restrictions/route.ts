import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getUserRestrictions } from '@/lib/services/user-restriction.service';

/**
 * GET /api/user/restrictions
 * Get current user's active restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const restrictions = await getUserRestrictions(session.user.id);

    return NextResponse.json({
      success: true,
      restrictions: restrictions.map(r => ({
        type: r.restrictionType,
        reason: r.reason,
        customReason: r.customReason,
        expiresAt: r.expiresAt,
        canTrade: r.canTrade,
        canEnterCompetitions: r.canEnterCompetitions,
        canDeposit: r.canDeposit,
        canWithdraw: r.canWithdraw
      }))
    });

  } catch (error) {
    console.error('Error fetching user restrictions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}

