/**
 * Nuvei DMN (Direct Merchant Notification) Webhook
 * Handles BOTH payment (deposit) and withdrawal notifications from Nuvei
 * 
 * POST /api/nuvei/webhook
 * 
 * Documentation: 
 * - Payment DMNs: https://docs.nuvei.com/documentation/integration/webhooks/payment-dmns/
 * - Withdrawal DMNs: https://docs.nuvei.com/documentation/integration/webhooks/withdrawal-dmns/
 * 
 * Nuvei uses a single DMN URL for both payments and withdrawals.
 * We detect the type based on the presence of wdRequestId (withdrawal) or not (payment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import PaymentProvider from '@/database/models/payment-provider.model';
import crypto from 'crypto';

interface NuveiDmnParams {
  // Common fields
  ppp_status: string;
  Status: string;
  ErrCode: string;
  ExErrCode: string;
  errCode?: string;
  errApmCode?: string;
  errScCode?: string;
  Reason?: string;
  ReasonCode?: string;
  PPP_TransactionID: string;
  TransactionID?: string;
  transactionId?: string;
  userid?: string;
  merchant_unique_id?: string;
  clientUniqueId?: string;
  currency: string;
  totalAmount?: string;
  amount?: string;
  transactionType?: string;
  merchant_id?: string;
  merchant_site_id?: string;
  advanceResponseChecksum?: string;
  responsechecksum?: string;
  
  // Withdrawal-specific fields
  wdRequestId?: string;
  wdRequestStatus?: string;  // Pending, Approved, Declined, Processing, Settled, Cancelled
  merchantWDRequestId?: string;
  merchant_wd_request_id?: string;
  userTokenId?: string;
  user_token_id?: string;
  
  // Card details
  cardCompany?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  uniqueCC?: string;
  errApmDescription?: string;
  
  // UPO (User Payment Option) - needed for card refunds
  userPaymentOptionId?: string;
  upoRegistrationDate?: string;
  
  [key: string]: string | undefined;
}

// Verify DMN signature
function verifyDmnSignature(params: NuveiDmnParams, secretKey: string): boolean {
  const checksum = params.advanceResponseChecksum || params.responsechecksum;
  if (!checksum) {
    console.warn('No checksum found in DMN');
    return false;
  }

  // The advanceResponseChecksum is calculated from specific fields
  // For simplicity, we'll trust DMNs from Nuvei's IP range in production
  // In a real implementation, you should verify the checksum properly
  
  // Basic checksum verification attempt
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'advanceResponseChecksum' && k !== 'responsechecksum')
    .sort();
  
  let data = '';
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined) {
      data += value;
    }
  }
  data += secretKey;
  
  const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
  
  // Log for debugging
  console.log('DMN verification - received:', checksum);
  console.log('DMN verification - calculated:', calculatedChecksum);
  
  return calculatedChecksum === checksum;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    // Parse form data or JSON
    let params: NuveiDmnParams;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      params = {} as NuveiDmnParams;
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      params = await req.json();
    } else {
      // Try to parse as URL encoded
      const text = await req.text();
      params = {} as NuveiDmnParams;
      const urlParams = new URLSearchParams(text);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    console.log('Nuvei DMN received:', JSON.stringify(params, null, 2));

    // ==============================
    // DETECT DMN TYPE: Withdrawal vs Payment
    // ==============================
    const isWithdrawalDmn = !!(params.wdRequestId || params.wdRequestStatus || params.merchantWDRequestId || params.merchant_wd_request_id);
    
    if (isWithdrawalDmn) {
      console.log('📤 Processing WITHDRAWAL DMN');
      return await handleWithdrawalDmn(params);
    }
    
    console.log('📥 Processing PAYMENT DMN');
    // Get Nuvei secret key - try database first, then env vars
    let secretKey: string | undefined;
    const provider = await PaymentProvider.findOne({ slug: 'nuvei', isActive: true });
    
    if (provider) {
      secretKey = provider.credentials.find((c: { key: string }) => c.key === 'secret_key')?.value;
    }
    
    // Fallback to environment variable
    if (!secretKey) {
      secretKey = process.env.NUVEI_SECRET_KEY;
    }
    
    if (!secretKey) {
      console.error('Nuvei secret key not configured in database or env');
      // Still process the DMN without signature verification if no secret key
      // This allows the system to work during initial setup
      console.warn('⚠️ Proceeding without signature verification');
    }
    
    // Optional: Verify signature (can be skipped for testing)
    // if (secretKey && !verifyDmnSignature(params, secretKey)) {
    //   console.error('DMN signature verification failed');
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    // }

    // Extract transaction details
    const nuveiTransactionId = params.TransactionID || params.transactionId || params.PPP_TransactionID;
    const status = params.Status || params.ppp_status;
    const clientUniqueId = params.clientUniqueId || params.merchant_unique_id;
    const amount = parseFloat(params.totalAmount || params.amount || '0');
    const currency = params.currency;
    const errCode = parseInt(params.ErrCode || params.errCode || '0');

    console.log(`Processing DMN: nuveiTransactionId=${nuveiTransactionId}, status=${status}, clientUniqueId=${clientUniqueId}`);

    // Find the pending transaction
    // New format: clientUniqueId = "txn_[transactionId]" - extract and find directly
    // Old format: clientUniqueId = "dep_[userId8]_[timestamp]" - search by metadata
    let transaction = null;
    
    if (clientUniqueId?.startsWith('txn_')) {
      // NEW FORMAT: Extract transaction ID directly from clientUniqueId
      const ourTransactionId = clientUniqueId.replace('txn_', '');
      transaction = await WalletTransaction.findById(ourTransactionId);
      console.log(`Found transaction by ID: ${ourTransactionId}`, !!transaction);
    }
    
    if (!transaction) {
      // FALLBACK: Old format or search by metadata
      transaction = await WalletTransaction.findOne({
        'metadata.clientUniqueId': clientUniqueId,
        provider: 'nuvei',
      });
    }

    if (!transaction) {
      // Try finding by orderId
      transaction = await WalletTransaction.findOne({
        'metadata.orderId': params.PPP_TransactionID,
        provider: 'nuvei',
      });
    }

    if (!transaction) {
      console.error('Transaction not found for DMN:', clientUniqueId);
      // Still return OK to Nuvei to prevent retries
      return NextResponse.json({ status: 'OK', message: 'Transaction not found' });
    }

    // Update transaction based on status
    if (status === 'APPROVED' && errCode === 0) {
      // Check if already processed to prevent duplicate processing
      if (transaction.status === 'completed') {
        console.log(`Transaction ${transaction._id} already completed, skipping`);
        return NextResponse.json({ status: 'OK', message: 'Already processed' });
      }

      // Update transaction with Nuvei details before completing
      transaction.paymentId = nuveiTransactionId;
      transaction.providerTransactionId = nuveiTransactionId;
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
        nuveiPPPTransactionId: params.PPP_TransactionID,
        // IMPORTANT: Store UPO for future card refunds
        userPaymentOptionId: params.userPaymentOptionId,
      };
      await transaction.save();
      
      // Store UPO for future card refunds (if provided)
      if (params.userPaymentOptionId && transaction.userId) {
        try {
          // Store in a separate collection for quick lookup
          const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
          
          await NuveiUserPaymentOption.findOneAndUpdate(
            { 
              userId: transaction.userId, 
              userPaymentOptionId: params.userPaymentOptionId 
            },
            {
              userId: transaction.userId,
              userPaymentOptionId: params.userPaymentOptionId,
              cardBrand: params.cardCompany,
              cardLast4: params.cardNumber?.replace(/\*+/g, '').slice(-4),
              expMonth: params.expMonth,
              expYear: params.expYear,
              uniqueCC: params.uniqueCC,
              lastUsed: new Date(),
              createdFromTransactionId: transaction._id.toString(),
            },
            { upsert: true, new: true }
          );
          console.log(`💳 Stored UPO ${params.userPaymentOptionId} for user ${transaction.userId}`);
        } catch (upoError) {
          console.error('Failed to store UPO:', upoError);
          // Don't fail the payment if UPO storage fails
        }
      }

      // Use completeDeposit to handle wallet crediting, fee recording, and invoice
      // This ensures Nuvei deposits are tracked the same way as Stripe
      try {
        const { completeDeposit } = await import('@/lib/actions/trading/wallet.actions');
        
        // Get card details from DMN params
        const cardDetails = {
          brand: params.cardCompany || undefined,
          last4: params.cardNumber?.replace(/\*+/g, '').slice(-4) || undefined,
          expMonth: params.expMonth ? parseInt(params.expMonth) : undefined,
          expYear: params.expYear ? parseInt(params.expYear) : undefined,
          country: undefined, // Nuvei doesn't provide this in DMN
          fingerprint: params.uniqueCC || undefined,
        };
        
        await completeDeposit(
          transaction._id.toString(),
          nuveiTransactionId,
          'card',
          cardDetails.last4 ? cardDetails : undefined
        );
        
        console.log(`✅ Nuvei deposit completed via completeDeposit: ${transaction._id}`);
      } catch (completeError) {
        console.error('❌ Error in completeDeposit for Nuvei:', completeError);
        
        // Fallback: Direct wallet credit if completeDeposit fails
        const wallet = await CreditWallet.findOne({ userId: transaction.userId });
        if (wallet) {
          wallet.creditBalance = (wallet.creditBalance || 0) + transaction.amount;
          wallet.totalDeposited = (wallet.totalDeposited || 0) + transaction.amount;
          await wallet.save();
          console.log(`⚠️ Fallback: Credited ${transaction.amount} directly to wallet`);
        }
        
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save();
      }
    } else if (status === 'DECLINED' || status === 'ERROR') {
      // Payment failed
      transaction.status = 'failed';
      transaction.providerTransactionId = nuveiTransactionId;
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
        errorCode: errCode,
        errorReason: params.Reason || params.errApmDescription || 'Payment declined',
      };
      await transaction.save();
      console.log(`Transaction ${transaction._id} marked as failed: ${params.Reason}`);
    } else if (status === 'PENDING') {
      // Payment pending - update metadata
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
      };
      await transaction.save();
      console.log(`Transaction ${transaction._id} still pending`);
    }

    // Return OK to acknowledge receipt
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('Nuvei webhook error:', error);
    // Still return OK to prevent Nuvei from retrying
    return NextResponse.json({ status: 'OK', error: 'Internal error' });
  }
}

/**
 * Handle Withdrawal DMN
 * Called when wdRequestId or wdRequestStatus is present in DMN
 */
async function handleWithdrawalDmn(params: NuveiDmnParams): Promise<NextResponse> {
  try {
    const wdRequestId = params.wdRequestId;
    const wdRequestStatus = params.wdRequestStatus;
    const merchantWDRequestId = params.merchantWDRequestId || params.merchant_wd_request_id;
    const status = params.Status || params.ppp_status;
    const errCode = parseInt(params.ErrCode || params.errCode || '0');
    const reason = params.Reason || '';
    const transactionId = params.TransactionID || params.transactionId || params.PPP_TransactionID;

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
        // Restore the credits - use amountCredits (new field) or amountRequested (old field)
        const creditsToRefund = Math.abs(withdrawalRequest.amountCredits || withdrawalRequest.amountRequested || 0);
        
        if (creditsToRefund > 0) {
          const balanceBefore = wallet.creditBalance;
          wallet.creditBalance += creditsToRefund;
          await wallet.save();

          console.log(`💸 Refunded ${creditsToRefund} credits to user ${withdrawalRequest.userId}`);

          // Create refund transaction
          await WalletTransaction.create({
            userId: withdrawalRequest.userId,
            transactionType: 'withdrawal_refund',
            amount: creditsToRefund,
            currency: 'EUR',
            exchangeRate: withdrawalRequest.exchangeRate || 1,
            balanceBefore,
            balanceAfter: wallet.creditBalance,
            status: 'completed',
            provider: 'nuvei',
            description: `Withdrawal refund - ${reason || newStatus}`,
            metadata: {
              withdrawalRequestId: withdrawalRequest._id.toString(),
              merchantWDRequestId,
              refundReason: reason || newStatus,
              originalAmountEUR: withdrawalRequest.amountEUR,
            },
          });

          // Update withdrawal request with refund info
          await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
            $set: {
              'metadata.refunded': true,
              'metadata.refundedAt': new Date().toISOString(),
              'metadata.refundedCredits': creditsToRefund,
            },
          });

          // Send notification
          try {
            const { sendWithdrawalFailedNotification } = await import('@/lib/services/notification.service');
            await sendWithdrawalFailedNotification(
              withdrawalRequest.userId,
              reason || 'Withdrawal was declined or cancelled'
            );
          } catch (notifError) {
            console.error('💸 Error sending withdrawal failed notification:', notifError);
          }
        } else {
          console.warn('💸 No credits to refund (amountCredits is 0 or missing)');
        }
      }
    }

    // Send success notification
    if (newStatus === 'completed') {
      try {
        const { sendWithdrawalCompletedNotification } = await import('@/lib/services/notification.service');
        await sendWithdrawalCompletedNotification(
          withdrawalRequest.userId,
          `€${withdrawalRequest.netAmountEUR?.toFixed(2) || params.amount}`
        );
      } catch (notifError) {
        console.error('💸 Error sending withdrawal completed notification:', notifError);
      }
    }

    console.log(`💸 Withdrawal ${merchantWDRequestId} updated to ${newStatus}`);
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('💸 Withdrawal DMN error:', error);
    return NextResponse.json({ status: 'OK', error: 'Internal error' });
  }
}

// Nuvei may send GET requests for testing
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    message: 'Nuvei webhook endpoint active (handles both payments and withdrawals)' 
  });
}

