import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { finalizeEndedChallenges, expirePendingChallenges } from '@/lib/actions/trading/challenge-finalize.actions';

// POST - Manually trigger challenge finalization (for testing/debugging)
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    console.log('🔧 Manually triggering challenge finalization...');

    // First expire pending challenges
    const expireResult = await expirePendingChallenges();
    console.log(`⏰ Expired ${expireResult.expired} pending challenges`);

    // Then finalize ended challenges
    const finalizeResult = await finalizeEndedChallenges();
    console.log(`✅ Finalized ${finalizeResult.finalized} challenges`);

    return NextResponse.json({
      success: true,
      expired: expireResult.expired,
      finalized: finalizeResult.finalized,
      results: finalizeResult.results,
    });
  } catch (error) {
    console.error('Error manually finalizing challenges:', error);
    return NextResponse.json(
      { error: 'Failed to finalize challenges', details: (error as Error).message },
      { status: 500 }
    );
  }
}

