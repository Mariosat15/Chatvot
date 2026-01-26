import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { emergencyCancelActiveCompetition } from '@/lib/actions/trading/competition-cancel.actions';

/**
 * POST /api/competitions/[id]/emergency-cancel
 * Emergency cancel an active competition
 * 
 * Body: { reason: string, useSnapshotId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, useSnapshotId } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'A detailed reason (at least 10 characters) is required for emergency cancellation' },
        { status: 400 }
      );
    }

    console.log(`🚨 [API] Emergency cancel request for competition ${id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Admin: ${auth.adminId}`);
    console.log(`   Snapshot ID: ${useSnapshotId || 'none (using current prices)'}`);

    // Get snapshot prices if specified
    let snapshotPrices: Map<string, { bid: number; ask: number }> | undefined;
    
    if (useSnapshotId) {
      // TODO: Fetch prices from snapshot when price snapshot system is implemented
      // For now, we'll use current prices
      console.log(`   ⚠️ Snapshot ID provided but snapshot system not yet implemented - using current prices`);
    }

    // Perform emergency cancellation
    const result = await emergencyCancelActiveCompetition(
      id,
      reason.trim(),
      auth.adminId || 'admin',
      snapshotPrices
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        details: {
          closedPositions: result.closedPositions,
          refundedCount: result.refundedCount,
          totalRefunded: result.totalRefunded,
        },
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in emergency cancel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
