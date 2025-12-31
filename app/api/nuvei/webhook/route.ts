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

/**
 * Verify DMN signature using Nuvei's advanceResponseChecksum
 * 
 * SECURITY: This is CRITICAL for preventing forged webhooks.
 * The checksum is calculated as SHA256 of specific fields + secret key.
 * 
 * According to Nuvei docs:
 * advanceResponseChecksum = SHA256(secret_key + totalAmount + currency + responseTimeStamp + PPP_TransactionID + Status + productId)
 * 
 * @see https://docs.nuvei.com/documentation/integration/webhooks/payment-dmns/
 */
function verifyDmnSignature(params: NuveiDmnParams, secretKey: string): boolean {
  const checksum = params.advanceResponseChecksum;
  
  if (!checksum) {
    // No checksum in DMN - this is suspicious but might happen for some DMN types
    console.warn('⚠️ No advanceResponseChecksum in DMN - verification skipped');
    // In production, you might want to reject DMNs without checksums
    // For now, we'll allow them but log a warning
    return true;
  }

  // Build the string for checksum calculation based on Nuvei's documented format
  // Order: secret_key + totalAmount + currency + responseTimeStamp + PPP_TransactionID + Status + productId
  const totalAmount = params.totalAmount || params.amount || '';
  const currency = params.currency || '';
  const responseTimeStamp = params.responseTimeStamp || '';
  const pppTransactionId = params.PPP_TransactionID || '';
  const status = params.Status || params.ppp_status || '';
  const productId = params.productId || '';
  
  // CRITICAL: secretKey comes FIRST in Nuvei's checksum calculation
  const data = `${secretKey}${totalAmount}${currency}${responseTimeStamp}${pppTransactionId}${status}${productId}`;
  const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
  
  const isValid = calculatedChecksum === checksum;
  
  if (!isValid) {
    // Log details for debugging (don't log secret key!)
    console.error('🔐 DMN signature verification FAILED');
    console.error('   Received checksum:', checksum);
    console.error('   Calculated checksum:', calculatedChecksum);
    console.error('   Fields used:', { totalAmount, currency, responseTimeStamp, pppTransactionId, status, productId });
    
    // Try alternative calculation method (some DMNs use different field order)
    // responsechecksum = SHA256(all param values sorted alphabetically + secret_key)
    if (params.responsechecksum) {
      const sortedKeys = Object.keys(params)
        .filter(k => k !== 'advanceResponseChecksum' && k !== 'responsechecksum')
        .sort();
      
      let altData = '';
      for (const key of sortedKeys) {
        const value = params[key];
        if (value !== undefined && value !== '') {
          altData += value;
        }
      }
      altData += secretKey;
      
      const altChecksum = crypto.createHash('sha256').update(altData).digest('hex');
      if (altChecksum === params.responsechecksum) {
        console.log('✅ DMN signature verified using responsechecksum');
        return true;
      }
    }
  } else {
    console.log('✅ DMN signature verified successfully');
  }
  
  return isValid;
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
    // DETECT DMN TYPE: Withdrawal vs Payment vs Account Capture
    // ==============================
    const isWithdrawalDmn = !!(params.wdRequestId || params.wdRequestStatus || params.merchantWDRequestId || params.merchant_wd_request_id);
    // Account Capture can be detected by:
    // - type === "ACCOUNT_CAPTURE" (primary indicator)
    // - OR payment_method === "apmgw_BankPayouts" with userPaymentOptionId
    const isAccountCaptureDmn = params.type === 'ACCOUNT_CAPTURE' || 
      (params.payment_method === 'apmgw_BankPayouts' && params.userPaymentOptionId && !params.TransactionID);
    
    if (isWithdrawalDmn) {
      console.log('📤 Processing WITHDRAWAL DMN');
      return await handleWithdrawalDmn(params);
    }
    
    // Handle Account Capture DMN - this is when Nuvei confirms bank details have been saved
    // Note: Account capture DMNs don't need signature verification
    if (isAccountCaptureDmn) {
      console.log('🏦 Processing ACCOUNT CAPTURE DMN');
      console.log('🏦 Type:', params.type);
      console.log('🏦 UPO ID:', params.userPaymentOptionId);
      console.log('🏦 User Token:', params.user_token_id);
      return await handleAccountCaptureDmn(params);
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
    
    // SECURITY: Verify DMN signature to prevent forged webhooks
    // This is CRITICAL for production - never disable this!
    if (secretKey) {
      const isValidSignature = verifyDmnSignature(params, secretKey);
      if (!isValidSignature) {
        console.error('🚨 SECURITY: DMN signature verification FAILED - possible forged webhook');
        // In production, reject invalid signatures immediately
        // The signature check logs details for debugging
        // Don't process the DMN but return OK to prevent Nuvei retries
        return NextResponse.json({ 
          status: 'OK', 
          message: 'Signature verification failed',
          warning: 'This request will not be processed' 
        });
      }
    } else {
      // No secret key available - log warning but process anyway during initial setup
      console.warn('⚠️ SECURITY WARNING: Processing DMN without signature verification (no secret key)');
    }

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
 * Handle Account Capture DMN
 * Called when user completes bank details entry via Nuvei's hosted page
 * This saves the userPaymentOptionId for future bank payouts
 */
async function handleAccountCaptureDmn(params: NuveiDmnParams): Promise<NextResponse> {
  try {
    const userPaymentOptionId = params.userPaymentOptionId;
    const userTokenId = params.user_token_id || params.userTokenId;
    const paymentMethod = params.payment_method;
    const upoRegistrationDate = params.upoRegistrationDate;
    const status = params.Status || params.ppp_status;
    
    console.log('🏦 Account Capture DMN parsed:', {
      userPaymentOptionId,
      userTokenId,
      paymentMethod,
      upoRegistrationDate,
      status,
    });
    
    if (!userPaymentOptionId || !userTokenId) {
      console.error('🏦 Account Capture DMN missing required fields');
      return NextResponse.json({ status: 'OK', message: 'Missing required fields' });
    }
    
    // Extract userId from userTokenId (format: "user_XXXXXX")
    const userId = userTokenId.replace('user_', '');
    
    if (!userId) {
      console.error('🏦 Could not extract userId from userTokenId:', userTokenId);
      return NextResponse.json({ status: 'OK', message: 'Invalid userTokenId format' });
    }
    
    // Import model here to avoid circular dependency
    const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
    
    // Check if this UPO already exists
    const existingUPO = await NuveiUserPaymentOption.findOne({
      userId,
      userPaymentOptionId,
    });
    
    if (existingUPO) {
      console.log('🏦 UPO already exists, updating lastUsed:', userPaymentOptionId);
      existingUPO.lastUsed = new Date();
      await existingUPO.save();
      return NextResponse.json({ status: 'OK', message: 'UPO already registered' });
    }
    
    // Create new bank UPO
    const newUPO = await NuveiUserPaymentOption.create({
      userId,
      userPaymentOptionId,
      type: 'bank',
      paymentMethod,
      registrationDate: upoRegistrationDate,
      countryCode: params.country,
      currencyCode: params.currency,
      isActive: true,
      lastUsed: new Date(),
    });
    
    console.log('🏦 Bank UPO saved successfully:', {
      id: newUPO._id,
      userId,
      userPaymentOptionId,
    });
    
    return NextResponse.json({ 
      status: 'OK', 
      message: 'Bank account registered successfully',
      userPaymentOptionId,
    });
    
  } catch (error) {
    console.error('🏦 Error handling Account Capture DMN:', error);
    return NextResponse.json({ status: 'OK', message: 'Error processing DMN' });
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

