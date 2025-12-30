/**
 * Nuvei Withdrawal DMN (Direct Merchant Notification) Webhook
 * Handles withdrawal status notifications from Nuvei
 * 
 * POST /api/nuvei/withdrawal-webhook
 * 
 * Documentation: https://docs.nuvei.com/documentation/integration/webhooks/withdrawal-dmns/
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { sendWithdrawalCompletedNotification, sendWithdrawalFailedNotification } from '@/lib/services/notification.service';

interface NuveiWithdrawalDmnParams {
  ppp_status: string;
  Status: string;
  ErrCode?: string;
  errCode?: string;
  Reason?: string;
  reason?: string;
  wdRequestId?: string;
  wdRequestStatus?: string; // Pending, Approved, Declined, Processing, Settled, Cancelled
  merchantWDRequestId?: string;
  merchant_wd_request_id?: string;
  userTokenId?: string;
  user_token_id?: string;
  amount?: string;
  currency?: string;
  transactionId?: string;
  TransactionID?: string;
  PPP_TransactionID?: string;
  merchant_id?: string;
  merchant_site_id?: string;
  advanceResponseChecksum?: string;
  responsechecksum?: string;
  [key: string]: string | undefined;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    // Parse form data or JSON
    let params: NuveiWithdrawalDmnParams;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      params = {} as NuveiWithdrawalDmnParams;
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      params = await req.json();
    } else {
      // Try to parse as URL encoded
      const text = await req.text();
      params = {} as NuveiWithdrawalDmnParams;
      const urlParams = new URLSearchParams(text);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    console.log('💸 Nuvei Withdrawal DMN received:', JSON.stringify(params, null, 2));

    // Extract relevant fields
    const wdRequestId = params.wdRequestId;
    const wdRequestStatus = params.wdRequestStatus;
    const merchantWDRequestId = params.merchantWDRequestId || params.merchant_wd_request_id;
    const status = params.Status || params.ppp_status;
    const errCode = params.ErrCode || params.errCode || '0';
    const reason = params.Reason || params.reason || '';
    const transactionId = params.transactionId || params.TransactionID || params.PPP_TransactionID;
    const amount = params.amount;

    console.log('💸 Withdrawal DMN parsed:', {
      wdRequestId,
      wdRequestStatus,
      merchantWDRequestId,
      status,
      errCode,
      transactionId,
    });

    if (!merchantWDRequestId) {
      console.error('💸 Withdrawal DMN missing merchantWDRequestId');
      return NextResponse.json({ status: 'OK', message: 'Missing merchantWDRequestId' });
    }

    // Find the withdrawal request
    const withdrawalRequest = await WithdrawalRequest.findOne({
      'metadata.merchantWDRequestId': merchantWDRequestId,
    });

    if (!withdrawalRequest) {
      console.error('💸 Withdrawal request not found:', merchantWDRequestId);
      return NextResponse.json({ status: 'OK', message: 'Withdrawal request not found' });
    }

    // Find associated wallet transaction
    const walletTx = await WalletTransaction.findOne({
      'metadata.merchantWDRequestId': merchantWDRequestId,
    });

    // Map Nuvei status to our status
    let newStatus: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
    let shouldRefund = false;

    switch (wdRequestStatus?.toLowerCase()) {
      case 'approved':
        newStatus = 'approved';
        break;
      case 'processing':
        newStatus = 'processing';
        break;
      case 'settled':
        newStatus = 'completed';
        break;
      case 'declined':
      case 'error':
        newStatus = 'failed';
        shouldRefund = true;
        break;
      case 'cancelled':
        newStatus = 'cancelled';
        shouldRefund = true;
        break;
      case 'pending':
      default:
        newStatus = 'pending';
        break;
    }

    console.log(`💸 Updating withdrawal ${merchantWDRequestId}: ${withdrawalRequest.status} -> ${newStatus}`);

    // Update withdrawal request
    const updateData: Record<string, unknown> = {
      status: newStatus,
      'metadata.nuveiWdRequestId': wdRequestId,
      'metadata.nuveiWdStatus': wdRequestStatus,
      'metadata.nuveiTransactionId': transactionId,
      'metadata.lastDmnAt': new Date().toISOString(),
    };

    if (newStatus === 'completed') {
      updateData.processedAt = new Date();
      updateData.completedAt = new Date();
    } else if (newStatus === 'failed') {
      updateData.failedAt = new Date();
      updateData.failedReason = reason || 'Withdrawal declined by payment provider';
    } else if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = reason || 'Withdrawal cancelled';
    }

    await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, updateData);

    // Update wallet transaction
    if (walletTx) {
      const txUpdate: Record<string, unknown> = {
        status: newStatus === 'completed' ? 'completed' : 
                newStatus === 'failed' ? 'failed' :
                newStatus === 'cancelled' ? 'cancelled' : 'pending',
        processedAt: new Date(),
        providerTransactionId: transactionId || wdRequestId,
        'metadata.nuveiWdStatus': wdRequestStatus,
      };

      if (newStatus === 'failed' || newStatus === 'cancelled') {
        txUpdate.failureReason = reason || `Withdrawal ${newStatus}`;
      }

      await WalletTransaction.findByIdAndUpdate(walletTx._id, txUpdate);
    }

    // Handle refund if needed (failed/cancelled)
    if (shouldRefund) {
      console.log('💸 Refunding credits for failed/cancelled withdrawal');
      
      const wallet = await CreditWallet.findOne({ userId: withdrawalRequest.userId });
      if (wallet) {
        // Restore the credits
        const creditsToRefund = Math.abs(withdrawalRequest.amountRequested);
        wallet.creditBalance += creditsToRefund;
        await wallet.save();

        console.log(`💸 Refunded ${creditsToRefund} credits to user ${withdrawalRequest.userId}`);

        // Create refund transaction
        await WalletTransaction.create({
          userId: withdrawalRequest.userId,
          transactionType: 'withdrawal_refund',
          amount: creditsToRefund,
          currency: 'EUR',
          balanceBefore: wallet.creditBalance - creditsToRefund,
          balanceAfter: wallet.creditBalance,
          status: 'completed',
          provider: 'nuvei',
          description: `Withdrawal refund - ${reason || newStatus}`,
          metadata: {
            withdrawalRequestId: withdrawalRequest._id.toString(),
            merchantWDRequestId,
            refundReason: reason || newStatus,
          },
        });

        // Send notification
        try {
          await sendWithdrawalFailedNotification(
            withdrawalRequest.userId,
            reason || 'Withdrawal was declined or cancelled'
          );
        } catch (notifError) {
          console.error('💸 Error sending withdrawal failed notification:', notifError);
        }
      }
    }

    // Send success notification
    if (newStatus === 'completed') {
      try {
        await sendWithdrawalCompletedNotification(
          withdrawalRequest.userId,
          `€${withdrawalRequest.netAmountEUR?.toFixed(2) || amount}`
        );
      } catch (notifError) {
        console.error('💸 Error sending withdrawal completed notification:', notifError);
      }
    }

    console.log(`💸 Withdrawal ${merchantWDRequestId} updated to ${newStatus}`);

    // Return OK to acknowledge receipt
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('💸 Nuvei withdrawal webhook error:', error);
    // Still return OK to prevent Nuvei from retrying
    return NextResponse.json({ status: 'OK', error: 'Internal error' });
  }
}

// Nuvei may send GET requests for testing
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    message: 'Nuvei withdrawal webhook endpoint active' 
  });
}

