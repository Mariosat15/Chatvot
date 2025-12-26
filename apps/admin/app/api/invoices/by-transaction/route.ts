import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { requireAdminAuth } from '@/lib/admin/auth';
import Invoice from '@/database/models/invoice.model';

/**
 * GET /api/admin/invoices/by-transaction
 * Find invoice associated with a transaction
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const userId = searchParams.get('userId');
    const paymentId = searchParams.get('paymentId');

    if (!transactionId && !userId && !paymentId) {
      return NextResponse.json(
        { error: 'At least one search parameter is required' },
        { status: 400 }
      );
    }

    // Build query - try multiple ways to find the invoice
    let invoice = null;

    // Try by payment intent ID first (most accurate)
    if (paymentId) {
      invoice = await Invoice.findOne({
        $or: [
          { 'metadata.paymentIntentId': paymentId },
          { 'metadata.transactionId': transactionId },
        ]
      }).lean();
    }

    // If not found, try by transaction ID in metadata
    if (!invoice && transactionId) {
      invoice = await Invoice.findOne({
        'metadata.transactionId': transactionId,
      }).lean();
    }

    // If still not found, try by user ID and approximate date
    // This is a fallback for invoices that might not have the transaction ID stored
    if (!invoice && userId) {
      // Get the most recent invoice for this user
      invoice = await Invoice.findOne({
        $or: [
          { userId: userId },
          { 'metadata.userId': userId },
        ]
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    return NextResponse.json({
      success: true,
      invoice: invoice || null,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching invoice by transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

