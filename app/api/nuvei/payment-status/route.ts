/**
 * Nuvei Payment Status API
 * Verify payment status after createPayment() completes
 * 
 * POST /api/nuvei/payment-status
 * Body: { sessionToken: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';

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
    const { sessionToken, clientUniqueId } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get payment status from Nuvei
    const result = await nuveiService.getPaymentStatus({ sessionToken });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Find the transaction
    // New format: clientUniqueId = "txn_[transactionId]" - extract and find directly
    let transaction = null;
    
    if (clientUniqueId?.startsWith('txn_')) {
      // NEW FORMAT: Extract transaction ID directly
      const ourTransactionId = clientUniqueId.replace('txn_', '');
      transaction = await WalletTransaction.findOne({
        _id: ourTransactionId,
        userId, // Ensure it belongs to this user
      });
    }
    
    if (!transaction) {
      // FALLBACK: Search by sessionToken
      transaction = await WalletTransaction.findOne({
        userId,
        'metadata.sessionToken': sessionToken,
        provider: 'nuvei',
      });
    }

    if (!transaction && clientUniqueId) {
      // FALLBACK: Old format - search by metadata
      transaction = await WalletTransaction.findOne({
        userId,
        'metadata.clientUniqueId': clientUniqueId,
        provider: 'nuvei',
      });
    }

    // Process based on transaction status
    if (result.transactionStatus === 'APPROVED' && result.errCode === 0) {
      // Payment approved
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.providerTransactionId = result.transactionId;
        transaction.completedAt = new Date();
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          authCode: result.authCode,
        };
        await transaction.save();

        // Credit wallet if not already credited (DMN might have done this)
        const wallet = await CreditWallet.findOne({ userId });
        if (wallet) {
          // Check if this transaction was already credited
          const alreadyCredited = await WalletTransaction.findOne({
            userId,
            providerTransactionId: result.transactionId,
            status: 'completed',
            _id: { $ne: transaction._id },
          });

          if (!alreadyCredited) {
            wallet.creditBalance += transaction.amount;
            wallet.totalDeposited += transaction.amount;
            await wallet.save();
          }
        }
      }

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        transactionId: result.transactionId,
        amount: result.amount,
        currency: result.currency,
      });
    } else if (result.transactionStatus === 'DECLINED') {
      // Payment declined
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'failed';
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          errorCode: result.errCode,
          errorReason: result.reason,
        };
        await transaction.save();
      }

      return NextResponse.json({
        success: false,
        status: 'DECLINED',
        reason: result.reason || 'Payment declined',
        errorCode: result.errCode,
      });
    } else if (result.transactionStatus === 'PENDING') {
      // Payment still pending
      return NextResponse.json({
        success: false,
        status: 'PENDING',
        message: 'Payment is still processing',
      });
    } else if (result.transactionStatus === 'ERROR' || result.status === 'ERROR') {
      // Error
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'failed';
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          errorCode: result.errCode,
          errorReason: result.reason,
        };
        await transaction.save();
      }

      return NextResponse.json({
        success: false,
        status: 'ERROR',
        reason: result.reason || 'Payment error',
        errorCode: result.errCode,
      });
    }

    // Unknown status
    return NextResponse.json({
      success: false,
      status: result.transactionStatus || 'UNKNOWN',
      raw: result,
    });
  } catch (error) {
    console.error('Nuvei payment status error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment status' },
      { status: 500 }
    );
  }
}

