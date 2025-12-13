import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import { PlatformFinancialsService } from '@/lib/services/platform-financials.service';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';

/**
 * GET /api/admin/platform-financials
 * Get comprehensive platform financial statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const stats = await PlatformFinancialsService.getFinancialStats();
    const unclaimedSummary = await PlatformFinancialsService.getUnclaimedPoolsSummary();
    
    // Get recent platform transactions
    const { transactions: recentTransactions } = await PlatformFinancialsService.getTransactionHistory({
      limit: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats,
        unclaimedSummary,
        recentTransactions,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching platform financials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform financials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-financials
 * Record admin withdrawal (converting platform credits to real money)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    const { amount, amountEUR, bankName, accountLastFour, reference, notes } = body;

    // Validate required fields
    if (!amount || !amountEUR || amount <= 0 || amountEUR <= 0) {
      return NextResponse.json(
        { error: 'Valid amount and EUR amount are required' },
        { status: 400 }
      );
    }

    // Get current platform earnings to validate withdrawal doesn't exceed available funds
    const stats = await PlatformFinancialsService.getFinancialStats();
    
    if (amount > stats.platformNetCredits) {
      return NextResponse.json(
        { 
          error: `Withdrawal amount (${amount}) exceeds available platform credits (${stats.platformNetCredits.toFixed(2)})`,
          availableCredits: stats.platformNetCredits,
        },
        { status: 400 }
      );
    }

    const result = await PlatformFinancialsService.recordAdminWithdrawal({
      amount,
      amountEUR,
      bankName,
      accountLastFour,
      reference,
      adminId: admin.id,
      adminEmail: admin.email,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to record withdrawal' },
        { status: 500 }
      );
    }

    // Return updated stats
    const updatedStats = await PlatformFinancialsService.getFinancialStats();

    return NextResponse.json({
      success: true,
      message: `Successfully recorded withdrawal of €${amountEUR.toFixed(2)}`,
      transaction: result.transaction,
      updatedStats,
    });
  } catch (error) {
    console.error('Error recording admin withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to record withdrawal' },
      { status: 500 }
    );
  }
}

