import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { customerAuditService } from '@/lib/services/customer-audit.service';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/customer-audit/stats
 * Get audit statistics for a customer
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const stats = await customerAuditService.getCustomerAuditStats(customerId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit stats' },
      { status: 500 }
    );
  }
}

