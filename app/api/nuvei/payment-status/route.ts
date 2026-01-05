/**
 * Nuvei Payment Status API
 * Verify payment status after createPayment() completes
 * 
 * POST /api/nuvei/payment-status
 * Body: { sessionToken: string }
 * 
 * Uses completeDeposit from wallet.actions to handle wallet crediting, 
 * fee recording, and invoice generation - same as Stripe.
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
      let invoiceGenerated = false;
      
      if (transaction && transaction.status === 'pending') {
        // Update transaction with Nuvei details before completing
        transaction.paymentId = result.transactionId;
        transaction.providerTransactionId = result.transactionId;
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          authCode: result.authCode,
        };
        await transaction.save();

        // Use completeDeposit to handle wallet crediting, fee recording, and invoice
        // This ensures Nuvei deposits are tracked the same way as Stripe
        try {
          const { completeDeposit } = await import('@/lib/actions/trading/wallet.actions');
          
          await completeDeposit(
            transaction._id.toString(),
            result.transactionId,
            'card',
            undefined // Card details will be fetched from webhook DMN
          );
          
          console.log(`✅ Nuvei deposit completed via completeDeposit: ${transaction._id}`);
          invoiceGenerated = true; // completeDeposit handles invoice
        } catch (completeError) {
          console.error('❌ Error in completeDeposit for Nuvei:', completeError);
          
          // Fallback: Direct wallet credit if completeDeposit fails
          const wallet = await CreditWallet.findOne({ userId });
          if (wallet) {
            wallet.creditBalance = (wallet.creditBalance || 0) + transaction.amount;
            wallet.totalDeposited = (wallet.totalDeposited || 0) + transaction.amount;
            await wallet.save();
            console.log(`⚠️ Fallback: Credited ${transaction.amount} directly to wallet`);
          }
          
          transaction.status = 'completed';
          transaction.processedAt = new Date();
          await transaction.save();
          
          // IMPORTANT: Still trigger badge evaluation in fallback path
          console.log(`🏅 Triggering badge evaluation for user ${userId} (payment-status fallback)...`);
          try {
            const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
            const result = await evaluateUserBadges(userId);
            if (result.newBadges.length > 0) {
              console.log(`🏅 User earned ${result.newBadges.length} new badges after deposit`);
            }
          } catch (badgeError) {
            console.error('❌ Error evaluating badges (fallback):', badgeError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        transactionId: result.transactionId,
        amount: result.amount,
        currency: result.currency,
        invoiceGenerated,
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

