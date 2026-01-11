/**
 * Nuvei Cancel/Fail Order API
 * Server-side endpoint to mark a payment as failed or cancelled
 * 
 * POST /api/nuvei/cancel-order
 * Body: { clientUniqueId: string, reason: string, status: 'failed' | 'cancelled' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { clientUniqueId, reason, status = 'cancelled', errorCode, errorDescription } = body;

    // SECURITY: Validate required fields
    if (!clientUniqueId) {
      return NextResponse.json(
        { error: 'Missing clientUniqueId' },
        { status: 400 }
      );
    }
    
    // SECURITY: Validate clientUniqueId format to prevent injection
    if (typeof clientUniqueId !== 'string' || clientUniqueId.length > 100) {
      return NextResponse.json(
        { error: 'Invalid clientUniqueId format' },
        { status: 400 }
      );
    }
    
    // SECURITY: Sanitize reason to prevent XSS/injection
    const sanitizedReason = typeof reason === 'string' 
      ? reason.substring(0, 500).replace(/[<>]/g, '') 
      : undefined;
    const sanitizedErrorDesc = typeof errorDescription === 'string'
      ? errorDescription.substring(0, 500).replace(/[<>]/g, '')
      : undefined;

    await connectToDatabase();

    // Find the transaction
    let transaction = null;
    
    if (clientUniqueId.startsWith('txn_')) {
      // New format: txn_[transactionId]
      const txnId = clientUniqueId.replace('txn_', '');
      transaction = await WalletTransaction.findById(txnId);
    }
    
    if (!transaction) {
      // Fallback: search by metadata
      transaction = await WalletTransaction.findOne({
        'metadata.clientUniqueId': clientUniqueId,
        provider: 'nuvei',
      });
    }

    if (!transaction) {
      console.log(`Transaction not found for clientUniqueId: ${clientUniqueId}`);
      return NextResponse.json({ success: true, message: 'Transaction not found or already processed' });
    }

    // Security: Only allow the owner to cancel their own transaction
    if (transaction.userId !== userId) {
      console.error(`User ${userId} tried to cancel transaction belonging to ${transaction.userId}`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only update if still pending
    if (transaction.status !== 'pending') {
      console.log(`Transaction ${transaction._id} is already ${transaction.status}, not updating`);
      return NextResponse.json({ 
        success: true, 
        message: `Transaction already ${transaction.status}`,
        currentStatus: transaction.status 
      });
    }

    // Mark as failed or cancelled
    const newStatus = status === 'failed' ? 'failed' : 'cancelled';
    transaction.status = newStatus;
    transaction.failureReason = sanitizedReason || sanitizedErrorDesc || (newStatus === 'cancelled' ? 'User cancelled' : 'Payment failed');
    transaction.processedAt = new Date();
    transaction.metadata = {
      ...transaction.metadata,
      clientErrorCode: typeof errorCode === 'string' ? errorCode.substring(0, 50) : errorCode,
      clientErrorDescription: sanitizedErrorDesc,
      cancelledAt: new Date().toISOString(),
      cancelReason: sanitizedReason,
    };
    
    await transaction.save();
    console.log(`Transaction ${transaction._id} marked as ${newStatus}: ${reason || errorDescription || 'No reason provided'}`);

    return NextResponse.json({
      success: true,
      transactionId: transaction._id.toString(),
      status: newStatus,
    });
  } catch (error) {
    console.error('Nuvei cancel order error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}

