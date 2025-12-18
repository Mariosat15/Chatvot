import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import VATPayment from '@/database/models/vat-payment.model';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/admin/vat
 * Get VAT summary and payment history
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default to current month if no dates provided
    const now = new Date();
    const periodStart = startDate 
      ? new Date(startDate) 
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate 
      ? new Date(endDate) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all completed deposits with VAT in the period
    const vatTransactions = await WalletTransaction.find({
      transactionType: 'deposit',
      status: 'completed',
      'metadata.vatAmount': { $gt: 0 },
      createdAt: { $gte: periodStart, $lte: periodEnd },
    }).lean();

    // Calculate total VAT collected
    let totalVATCollected = 0;
    let transactionCount = 0;

    for (const tx of vatTransactions) {
      const vatAmount = tx.metadata?.vatAmount || 0;
      totalVATCollected += vatAmount;
      transactionCount++;
    }

    // Get unpaid VAT from previous periods (not yet marked as paid)
    const unpaidVATPeriods = await VATPayment.find({ status: 'pending' }).lean();
    let unpaidVATFromPreviousPeriods = 0;
    for (const period of unpaidVATPeriods) {
      unpaidVATFromPreviousPeriods += period.vatAmountEUR;
    }

    // Get all-time VAT collected (for total liability calculation)
    const allTimeVATAggregation = await WalletTransaction.aggregate([
      {
        $match: {
          transactionType: 'deposit',
          status: 'completed',
          'metadata.vatAmount': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalVAT: { $sum: '$metadata.vatAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const allTimeVATCollected = allTimeVATAggregation[0]?.totalVAT || 0;

    // Get total VAT already paid
    const paidVATAggregation = await VATPayment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$vatAmountEUR' },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalVATPaid = paidVATAggregation[0]?.totalPaid || 0;

    // Outstanding VAT = All collected - All paid
    const outstandingVAT = allTimeVATCollected - totalVATPaid;

    // Get VAT payment history
    const vatPaymentHistory = await VATPayment.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        // Current period
        currentPeriod: {
          start: periodStart,
          end: periodEnd,
          vatCollected: totalVATCollected,
          transactionCount,
        },
        // Outstanding (what we owe)
        outstanding: {
          total: outstandingVAT,
          fromPreviousPeriods: unpaidVATFromPreviousPeriods,
          currentPeriod: totalVATCollected,
        },
        // All time stats
        allTime: {
          collected: allTimeVATCollected,
          paid: totalVATPaid,
          outstanding: outstandingVAT,
        },
        // Payment history
        paymentHistory: vatPaymentHistory,
      },
    });
  } catch (error) {
    console.error('Error fetching VAT data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch VAT data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/vat/pay
 * Record a VAT payment
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();
    const { periodStart, periodEnd, amount, reference, notes } = body;

    if (!periodStart || !periodEnd || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Count transactions in this period
    const txCount = await WalletTransaction.countDocuments({
      transactionType: 'deposit',
      status: 'completed',
      'metadata.vatAmount': { $gt: 0 },
      createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) },
    });

    // Create VAT payment record
    const vatPayment = await VATPayment.create({
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      vatAmount: amount,
      vatAmountEUR: amount,
      transactionCount: txCount,
      status: 'paid',
      paidAt: new Date(),
      paidBy: admin.adminId || 'admin',
      paidByEmail: admin.email,
      reference,
      notes,
    });

    console.log(`💶 VAT Payment recorded: €${amount} for period ${periodStart} to ${periodEnd} by ${admin.email}`);

    // Log audit action
    try {
      await auditLogService.logVATPayment(
        {
          id: admin.adminId || 'admin',
          email: admin.email || 'admin',
          name: (admin.email || 'admin').split('@')[0],
          role: 'admin',
        },
        amount,
        reference || `VAT-${periodStart}-${periodEnd}`
      );
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      payment: vatPayment,
    });
  } catch (error) {
    console.error('Error recording VAT payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record VAT payment' },
      { status: 500 }
    );
  }
}

