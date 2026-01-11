import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { approveWithdrawal } from '@/lib/services/withdrawal.service';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * POST /api/withdrawals/[id]/approve
 * Approve a withdrawal request for manual processing
 * 
 * After approval, admin must:
 * 1. Log into company bank
 * 2. Transfer money to user's IBAN
 * 3. Mark as "completed" in admin panel
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

    await connectToDatabase();

    const result = await approveWithdrawal(id, admin.adminId!, admin.email!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal approved - Ready for manual bank transfer',
      payoutId: result.payoutId,
      status: result.status,
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve withdrawal' },
      { status: 500 }
    );
  }
}

