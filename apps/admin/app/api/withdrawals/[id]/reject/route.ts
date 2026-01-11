import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { rejectWithdrawal } from '@/lib/services/withdrawal.service';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * POST /api/withdrawals/[id]/reject
 * Reject a withdrawal request and refund credits to user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required (min 3 characters)' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const result = await rejectWithdrawal(id, admin.adminId!, admin.email!, reason.trim());

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal rejected - Credits refunded to user',
      status: result.status,
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject withdrawal' },
      { status: 500 }
    );
  }
}

