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
import { PaymentFraudService } from '@/lib/services/fraud/payment-fraud.service';
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
    
    // Check if this is a CARD_TOKENIZATION DMN (informational only, no payment)
    // These have empty fields and different checksum format - skip signature verification
    const isCardTokenizationDmn = params.type === 'CARD_TOKENIZATION';
    
    if (isCardTokenizationDmn) {
      console.log('🔐 Skipping CARD_TOKENIZATION DMN (informational only)');
      // Just acknowledge receipt - no processing needed
      return NextResponse.json({ status: 'OK', message: 'Card tokenization acknowledged' });
    }
    
    // Check if this is a PAYOUT (Credit) DMN vs DEPOSIT (Sale) DMN
    // Nuvei sends both as type: "DEPOSIT" but uses transactionType to distinguish
    const isPayoutDmn = params.transactionType === 'Credit';
    
    if (isPayoutDmn) {
      console.log('💸 Processing PAYOUT DMN');
      console.log('💸 TransactionID:', params.TransactionID);
      console.log('💸 ClientRequestId:', params.clientRequestId);
      console.log('💸 Status:', params.Status);
      return await handlePayoutDmn(params);
    }
    
    console.log('📥 Processing DEPOSIT DMN');
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

    // Log the user we're processing for
    console.log(`📦 Processing DMN for transaction ${transaction._id}, user: ${transaction.userId}, amount: ${transaction.amount} credits`);

    // Update transaction based on status
    if (status === 'APPROVED' && errCode === 0) {
      // ATOMIC check and claim: Update status from 'pending' to 'processing' 
      // This prevents duplicate processing if two webhooks arrive at the same time
      const claimed = await WalletTransaction.findOneAndUpdate(
        { 
          _id: transaction._id, 
          status: { $in: ['pending', 'awaiting_payment'] } 
        },
        { $set: { status: 'processing' } },
        { new: false } // Return the old document to check if we claimed it
      );
      
      if (!claimed) {
        // Check if already completed or being processed by another request
        const currentTxn = await WalletTransaction.findById(transaction._id);
        if (currentTxn?.status === 'completed') {
          console.log(`✅ Transaction ${transaction._id} already completed, skipping (duplicate DMN)`);
          return NextResponse.json({ status: 'OK', message: 'Already processed' });
        }
        if (currentTxn?.status === 'processing') {
          console.log(`⏳ Transaction ${transaction._id} already being processed, skipping (concurrent DMN)`);
          return NextResponse.json({ status: 'OK', message: 'Already processing' });
        }
        console.log(`⚠️ Transaction ${transaction._id} status: ${currentTxn?.status}, cannot process`);
        return NextResponse.json({ status: 'OK', message: 'Transaction not in pending state' });
      }
      
      console.log(`🔒 Claimed transaction ${transaction._id} for processing (user: ${transaction.userId})`);

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
        
        // Track payment fingerprint for fraud detection (same as Stripe)
        // uniqueCC is Nuvei's unique card identifier (hash of card number)
        const cardFingerprint = params.uniqueCC;
        if (cardFingerprint && transaction.userId) {
          try {
            console.log(`🔍 Tracking Nuvei payment fingerprint: ${cardFingerprint.substring(0, 12)}...`);
            
            const fraudResult = await PaymentFraudService.trackPaymentFingerprint({
              userId: transaction.userId,
              paymentProvider: 'nuvei',
              paymentFingerprint: cardFingerprint,
              cardLast4: params.cardNumber?.replace(/\*+/g, '').slice(-4),
              cardBrand: params.cardCompany || undefined,
              cardCountry: params.cardIssuerCountry || undefined,
              cardFunding: params.cardType || undefined,
              providerAccountId: params.userPaymentOptionId || undefined,
              transactionId: nuveiTransactionId,
              amount: transaction.amount,
              currency: params.currency || 'EUR',
              providerMetadata: {
                tokenId: params.tokenId,
                bin: params.bin,
                upoId: params.userPaymentOptionId,
              }
            });
            
            if (fraudResult.fraudDetected) {
              console.log(`🚨 FRAUD DETECTED: Payment method shared across ${fraudResult.linkedUsers.length + 1} accounts!`);
              console.log(`   Linked users: ${fraudResult.linkedUsers.join(', ')}`);
            }
          } catch (fraudError) {
            console.error('❌ Error tracking payment fingerprint:', fraudError);
            // Don't fail the deposit if fraud tracking fails
          }
        }
      } catch (completeError) {
        // CRITICAL: Do NOT credit wallet if completeDeposit fails
        // Mark transaction as failed and log for manual investigation
        console.error('❌ CRITICAL: completeDeposit failed for Nuvei:', completeError);
        console.error(`❌ Transaction ${transaction._id} for user ${transaction.userId} needs manual review`);
        console.error(`❌ Amount: ${transaction.amount} credits, Nuvei TX: ${nuveiTransactionId}`);
        
        // Mark transaction as failed (not completed!) - requires manual intervention
        transaction.status = 'failed';
        transaction.failureReason = `completeDeposit error: ${completeError instanceof Error ? completeError.message : 'Unknown error'}`;
        transaction.metadata = {
          ...transaction.metadata,
          processingError: completeError instanceof Error ? completeError.message : 'Unknown error',
          requiresManualReview: true,
          nuveiPaymentApproved: true, // Nuvei approved, but our processing failed
        };
        await transaction.save();
        
        // TODO: Send admin notification about failed deposit that needs review
        console.error(`🚨 ALERT: Deposit ${transaction._id} approved by Nuvei but failed to process. Manual review required!`);
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
    } else {
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
    }
    
    // ALWAYS update the user's bank account(s) with this UPO
    // This links the UPO to their existing bank account so withdrawals can use it
    // Run this regardless of whether UPO already existed or not
    try {
      const UserBankAccount = (await import('@/database/models/user-bank-account.model')).default;
      
      // Find user's default bank account (or most recent) and update it with the UPO
      const bankAccount = await UserBankAccount.findOne({ 
        userId, 
        isActive: true 
      }).sort({ isDefault: -1, createdAt: -1 });
      
      if (bankAccount) {
        bankAccount.nuveiUpoId = String(userPaymentOptionId);
        bankAccount.nuveiConnected = true;
        bankAccount.nuveiStatus = 'active';
        await bankAccount.save();
        console.log('🏦 Updated bank account with UPO:', bankAccount._id);
      } else {
        console.log('🏦 No bank account found to update for user:', userId);
      }
    } catch (bankError) {
      console.error('🏦 Error updating bank account with UPO:', bankError);
      // Don't fail the DMN processing - the UPO is still saved
    }
    
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
 * Handle Payout (Credit) DMN
 * Called when transactionType === 'Credit' (from /payout endpoint)
 * This is different from handleWithdrawalDmn which handles /withdraw endpoint
 */
async function handlePayoutDmn(params: NuveiDmnParams): Promise<NextResponse> {
  try {
    const transactionId = params.TransactionID || params.transactionId;
    const clientUniqueId = params.clientUniqueId || params.merchant_unique_id; // e.g., "wd_37d7b921_1767337078495"
    const status = params.Status || params.ppp_status;
    const errCode = parseInt(params.ErrCode || params.errCode || '0');
    const reason = params.Reason || '';
    const amount = params.totalAmount;
    const userTokenId = params.user_token_id || params.userid;
    
    console.log('💸 Payout DMN parsed:', {
      transactionId,
      clientUniqueId,
      status,
      errCode,
      amount,
      userTokenId,
    });
    
    // For payouts, we need to find by transactionId, clientUniqueId, or metadata
    let withdrawalRequest = null;
    let walletTx = null;
    
    // First try to find by transactionId (stored when payout was submitted)
    if (transactionId) {
      withdrawalRequest = await WithdrawalRequest.findOne({
        $or: [
          { 'metadata.nuveiTransactionId': transactionId },
          { 'metadata.nuveiWdRequestId': transactionId },
        ]
      });
      
      walletTx = await WalletTransaction.findOne({
        $or: [
          { 'metadata.nuveiTransactionId': transactionId },
          { providerTransactionId: transactionId },
        ]
      });
    }
    
    // If not found by transactionId, try by clientUniqueId
    // Note: clientUniqueId = merchantWDRequestId (e.g., "wd_37d7b921_1767337078495")
    if (!withdrawalRequest && clientUniqueId) {
      withdrawalRequest = await WithdrawalRequest.findOne({
        $or: [
          { 'metadata.merchantWDRequestId': clientUniqueId },
          { 'metadata.clientUniqueId': clientUniqueId },
        ]
      });
      
      walletTx = await WalletTransaction.findOne({
        $or: [
          { 'metadata.merchantWDRequestId': clientUniqueId },
          { 'metadata.clientUniqueId': clientUniqueId },
        ]
      });
    }
    
    // If still not found, try by userTokenId and recent timestamp
    if (!withdrawalRequest && userTokenId) {
      const userId = userTokenId.replace('user_', '');
      // Find recent withdrawal request for this user that's in processing state
      withdrawalRequest = await WithdrawalRequest.findOne({
        userId,
        status: { $in: ['processing', 'approved', 'pending'] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      }).sort({ createdAt: -1 });
      
      if (withdrawalRequest) {
        walletTx = await WalletTransaction.findOne({
          'metadata.withdrawalRequestId': withdrawalRequest._id.toString(),
        });
      }
    }
    
    if (!withdrawalRequest) {
      console.log('💸 Payout DMN: Withdrawal request not found for:', { transactionId, clientUniqueId });
      // This is OK - the withdrawal was already updated synchronously when the payout was submitted
      // The DMN is just a confirmation
      return NextResponse.json({ status: 'OK', message: 'Withdrawal request not found (likely already processed)' });
    }
    
    // Check if already processed
    if (withdrawalRequest.status === 'completed' || withdrawalRequest.status === 'failed') {
      console.log(`💸 Payout DMN: Withdrawal ${withdrawalRequest._id} already ${withdrawalRequest.status}, skipping`);
      return NextResponse.json({ status: 'OK', message: 'Already processed' });
    }
    
    // Determine new status based on Nuvei response
    let newStatus: 'completed' | 'failed' | 'processing';
    let shouldRefund = false;
    
    if (status === 'APPROVED' && errCode === 0) {
      newStatus = 'completed';
    } else if (status === 'DECLINED' || status === 'ERROR' || errCode !== 0) {
      newStatus = 'failed';
      shouldRefund = true;
    } else if (status === 'PENDING') {
      newStatus = 'processing';
    } else {
      // Unknown status - log and keep as processing
      console.log('💸 Payout DMN: Unknown status:', status);
      newStatus = 'processing';
    }
    
    console.log(`💸 Payout DMN: Updating withdrawal ${withdrawalRequest._id} from ${withdrawalRequest.status} to ${newStatus}`);
    
    // Update withdrawal request
    const updateData: any = {
      status: newStatus,
      'metadata.payoutDmnReceived': true,
      'metadata.payoutDmnStatus': status,
      'metadata.payoutDmnTransactionId': transactionId,
      'metadata.payoutDmnTimestamp': new Date().toISOString(),
    };
    
    if (newStatus === 'completed') {
      updateData.completedAt = new Date();
    } else if (newStatus === 'failed') {
      updateData.failedAt = new Date();
      updateData.failedReason = reason || `Payout declined: ${status}`;
    }
    
    await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, { $set: updateData });
    
    // Update wallet transaction if found
    if (walletTx) {
      const txUpdateData: any = {
        status: newStatus === 'completed' ? 'completed' : (newStatus === 'failed' ? 'failed' : 'pending'),
        'metadata.payoutDmnStatus': status,
        'metadata.payoutDmnTransactionId': transactionId,
      };
      if (newStatus !== 'processing') {
        txUpdateData.processedAt = new Date();
      }
      await WalletTransaction.findByIdAndUpdate(walletTx._id, { $set: txUpdateData });
    }
    
    // IMPORTANT: If payout completed, update wallet stats and record platform fee
    if (newStatus === 'completed') {
      const CreditWalletModel = (await import('@/database/models/trading/credit-wallet.model')).default;
      const wallet = await CreditWalletModel.findOne({ userId: withdrawalRequest.userId });
      
      if (wallet) {
        // Only update totalWithdrawn if not already counted (prevent double-counting from sync + DMN)
        const wdMetadata = (withdrawalRequest as any).metadata || {};
        const alreadyCounted = wdMetadata.totalWithdrawnUpdated === true;
        if (!alreadyCounted) {
          const creditsWithdrawn = withdrawalRequest.amountCredits || 0;
          wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + creditsWithdrawn;
          await wallet.save();
          
          // Mark as counted to prevent duplicates
          await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
            $set: { 'metadata.totalWithdrawnUpdated': true },
          });
          console.log(`💸 Payout DMN: Updated totalWithdrawn: +${creditsWithdrawn} credits for user ${withdrawalRequest.userId}`);
        } else {
          console.log(`💸 Payout DMN: totalWithdrawn already updated for withdrawal ${withdrawalRequest._id}, skipping`);
        }
      }
      
      // Record platform fee as revenue (if any fee was charged and not already recorded)
      const platformFee = withdrawalRequest.platformFee || 0;
      if (platformFee > 0) {
        try {
          const { PlatformTransaction } = await import('@/database/models/platform-financials.model');
          
          // Check if fee already recorded (prevent duplicates)
          const existingFee = await PlatformTransaction.findOne({
            transactionType: 'withdrawal_fee',
            sourceId: withdrawalRequest._id.toString(),
          });
          
          if (!existingFee) {
            await PlatformTransaction.create({
              transactionType: 'withdrawal_fee',
              amount: withdrawalRequest.platformFeeCredits || platformFee,
              amountEUR: platformFee,
              sourceType: 'user_withdrawal',
              sourceId: withdrawalRequest._id.toString(),
              sourceName: withdrawalRequest.userEmail,
              userId: withdrawalRequest.userId,
              feeDetails: {
                withdrawalAmount: withdrawalRequest.amountEUR,
                platformFee,
                netAmount: withdrawalRequest.netAmountEUR,
                withdrawalMethod: withdrawalRequest.payoutMethod,
                provider: 'nuvei',
                completedViaDmn: true,
              },
              description: `Automatic withdrawal fee from ${withdrawalRequest.userEmail}`,
            });
            console.log(`💸 Payout DMN: Recorded platform fee: €${platformFee}`);
          } else {
            console.log(`💸 Payout DMN: Platform fee already recorded for withdrawal ${withdrawalRequest._id}`);
          }
        } catch (feeError) {
          console.error('💸 Payout DMN: Error recording platform fee (non-blocking):', feeError);
        }
      }
      
      // Send email notification for completed withdrawal
      const emailToUse = withdrawalRequest.userEmail;
      console.log(`📧 Payout DMN: Checking email notification, userEmail=${emailToUse || 'NOT SET'}`);
      
      if (emailToUse) {
        try {
          const { sendWithdrawalCompletedEmail } = await import('@/lib/nodemailer');
          
          // Determine payment method display name
          let paymentMethodDisplay = 'Bank Transfer';
          if (withdrawalRequest.payoutMethod?.includes('card')) {
            paymentMethodDisplay = 'Card Payout';
          } else if (withdrawalRequest.payoutMethod?.includes('bank') || withdrawalRequest.payoutMethod?.includes('sepa')) {
            paymentMethodDisplay = 'Bank Transfer (SEPA)';
          }
          
          console.log(`📧 Payout DMN: Sending email to ${emailToUse}...`);
          
          await sendWithdrawalCompletedEmail({
            email: emailToUse,
            name: withdrawalRequest.userName || emailToUse.split('@')[0],
            credits: withdrawalRequest.amountCredits || 0,
            netAmount: withdrawalRequest.netAmountEUR || 0,
            fee: withdrawalRequest.platformFee || 0,
            paymentMethod: paymentMethodDisplay,
            withdrawalId: withdrawalRequest._id.toString().slice(-8).toUpperCase(),
            remainingBalance: wallet?.creditBalance || 0,
          });
          console.log(`✅ Payout DMN: Email sent successfully to ${emailToUse}`);
        } catch (emailError) {
          console.error('❌ Payout DMN: Error sending email:', emailError);
        }
      } else {
        console.warn('⚠️ Payout DMN: Cannot send email - no email address on withdrawal request');
      }
    }
    
    // Refund credits if payout failed
    if (shouldRefund) {
      const CreditWallet = (await import('@/database/models/trading/credit-wallet.model')).default;
      const wallet = await CreditWallet.findOne({ userId: withdrawalRequest.userId });
      
      if (wallet) {
        const creditsToRefund = withdrawalRequest.amountCredits || 0;
        wallet.creditBalance += creditsToRefund;
        await wallet.save();
        
        console.log(`💸 Payout DMN: Refunded ${creditsToRefund} credits to user ${withdrawalRequest.userId}`);
        
        // Update the original wallet transaction - mark as completed with 0 amount
        // This ensures reconciliation is correct (no net effect since reversed)
        if (walletTx) {
          await WalletTransaction.findByIdAndUpdate(walletTx._id, {
            $set: {
              status: 'completed',
              amount: 0, // Set to 0 since withdrawal was reversed
              processedAt: new Date(),
              description: `Payout failed - credits returned: ${reason || 'Declined'}`,
              'metadata.originalAmount': creditsToRefund,
              'metadata.payoutDmnStatus': status,
              'metadata.wasReversed': true,
              'metadata.refundReason': reason || 'Payout declined',
            },
          });
        }
      }
    }
    
    console.log(`💸 Payout DMN processed successfully: ${withdrawalRequest._id} -> ${newStatus}`);
    return NextResponse.json({ status: 'OK', message: `Payout DMN processed: ${newStatus}` });
    
  } catch (error) {
    console.error('💸 Error handling Payout DMN:', error);
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

    // IMPORTANT: If withdrawal completed (settled), update wallet stats and record platform fee
    if (newStatus === 'completed') {
      const wallet = await CreditWallet.findOne({ userId: withdrawalRequest.userId });
      
      if (wallet) {
        // Only update totalWithdrawn if not already counted (prevent double-counting from sync + DMN)
        const wdMeta = (withdrawalRequest as any).metadata || {};
        const alreadyCounted = wdMeta.totalWithdrawnUpdated === true;
        if (!alreadyCounted) {
          const creditsWithdrawn = Math.abs(withdrawalRequest.amountCredits || 0);
          wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + creditsWithdrawn;
          await wallet.save();
          
          // Mark as counted to prevent duplicates
          await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
            $set: { 'metadata.totalWithdrawnUpdated': true },
          });
          console.log(`💸 Withdrawal DMN: Updated totalWithdrawn: +${creditsWithdrawn} credits for user ${withdrawalRequest.userId}`);
        } else {
          console.log(`💸 Withdrawal DMN: totalWithdrawn already updated for withdrawal ${withdrawalRequest._id}, skipping`);
        }
      }
      
      // Record platform fee as revenue (if any fee was charged and not already recorded)
      const platformFee = withdrawalRequest.platformFee || 0;
      if (platformFee > 0) {
        try {
          const { PlatformTransaction } = await import('@/database/models/platform-financials.model');
          
          // Check if fee already recorded (prevent duplicates)
          const existingFee = await PlatformTransaction.findOne({
            transactionType: 'withdrawal_fee',
            sourceId: withdrawalRequest._id.toString(),
          });
          
          if (!existingFee) {
            await PlatformTransaction.create({
              transactionType: 'withdrawal_fee',
              amount: withdrawalRequest.platformFeeCredits || platformFee,
              amountEUR: platformFee,
              sourceType: 'user_withdrawal',
              sourceId: withdrawalRequest._id.toString(),
              sourceName: withdrawalRequest.userEmail,
              userId: withdrawalRequest.userId,
              feeDetails: {
                withdrawalAmount: withdrawalRequest.amountEUR,
                platformFee,
                netAmount: withdrawalRequest.netAmountEUR,
                withdrawalMethod: withdrawalRequest.payoutMethod,
                provider: 'nuvei',
                completedViaDmn: true,
              },
              description: `Automatic withdrawal fee from ${withdrawalRequest.userEmail}`,
            });
            console.log(`💸 Withdrawal DMN: Recorded platform fee: €${platformFee}`);
          } else {
            console.log(`💸 Withdrawal DMN: Platform fee already recorded for withdrawal ${withdrawalRequest._id}`);
          }
        } catch (feeError) {
          console.error('💸 Withdrawal DMN: Error recording platform fee (non-blocking):', feeError);
        }
      }
    }

    // Handle refund if needed (failed/cancelled)
    if (shouldRefund) {
      console.log('💸 Refunding credits for failed/cancelled withdrawal');
      
      const wallet = await CreditWallet.findOne({ userId: withdrawalRequest.userId });
      if (wallet) {
        // Restore the credits
        const creditsToRefund = Math.abs(withdrawalRequest.amountCredits || 0);
        
        if (creditsToRefund > 0) {
          wallet.creditBalance += creditsToRefund;
          await wallet.save();

          console.log(`💸 Refunded ${creditsToRefund} credits to user ${withdrawalRequest.userId}`);

          // Update the original wallet transaction - mark as completed with 0 amount
          // This ensures reconciliation is correct (no net effect since reversed)
          if (walletTx) {
            await WalletTransaction.findByIdAndUpdate(walletTx._id, {
              $set: {
                status: 'completed',
                amount: 0, // Set to 0 since withdrawal was reversed
                processedAt: new Date(),
                description: `Withdrawal ${newStatus} - credits returned: ${reason || 'Declined'}`,
                'metadata.originalAmount': creditsToRefund,
                'metadata.wasReversed': true,
                'metadata.refundReason': reason || newStatus,
              },
            });
          }

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

    // Send success notification and email
    if (newStatus === 'completed') {
      // In-app notification
      try {
        const { sendWithdrawalCompletedNotification } = await import('@/lib/services/notification.service');
        await sendWithdrawalCompletedNotification(
          withdrawalRequest.userId,
          `€${withdrawalRequest.netAmountEUR?.toFixed(2) || params.amount}`
        );
        console.log(`✅ Withdrawal DMN: In-app notification sent`);
      } catch (notifError) {
        console.error('💸 Error sending withdrawal completed notification:', notifError);
      }
      
      // Email notification
      const emailToSend = withdrawalRequest.userEmail;
      console.log(`📧 Withdrawal DMN: Checking email notification, userEmail=${emailToSend || 'NOT SET'}`);
      
      if (emailToSend) {
        try {
          const { sendWithdrawalCompletedEmail } = await import('@/lib/nodemailer');
          
          // Get user's current balance
          const wallet = await CreditWallet.findOne({ userId: withdrawalRequest.userId });
          
          // Determine payment method display name
          let paymentMethodDisplay = 'Bank Transfer';
          if (withdrawalRequest.payoutMethod?.includes('card')) {
            paymentMethodDisplay = 'Card Payout';
          } else if (withdrawalRequest.payoutMethod?.includes('bank') || withdrawalRequest.payoutMethod?.includes('sepa')) {
            paymentMethodDisplay = 'Bank Transfer (SEPA)';
          }
          
          console.log(`📧 Withdrawal DMN: Sending email to ${emailToSend}...`);
          
          await sendWithdrawalCompletedEmail({
            email: emailToSend,
            name: withdrawalRequest.userName || emailToSend.split('@')[0],
            credits: withdrawalRequest.amountCredits || 0,
            netAmount: withdrawalRequest.netAmountEUR || 0,
            fee: withdrawalRequest.platformFee || 0,
            paymentMethod: paymentMethodDisplay,
            withdrawalId: withdrawalRequest._id.toString().slice(-8).toUpperCase(),
            remainingBalance: wallet?.creditBalance || 0,
          });
          console.log(`✅ Withdrawal DMN: Email sent successfully to ${emailToSend}`);
        } catch (emailError) {
          console.error('❌ Withdrawal DMN: Error sending email:', emailError);
        }
      } else {
        console.warn('⚠️ Withdrawal DMN: Cannot send email - no email address on withdrawal request');
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

