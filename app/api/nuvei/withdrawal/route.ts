/**
 * Nuvei Withdrawal API
 * Handles automatic withdrawal processing via Nuvei
 * 
 * POST /api/nuvei/withdrawal - Submit a withdrawal request
 * GET /api/nuvei/withdrawal - Get user's pending withdrawal requests
 * 
 * Documentation: https://docs.nuvei.com/documentation/accept-payment/web-sdk/withdrawal/
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import WithdrawalSettings from '@/database/models/withdrawal-settings.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import AppSettings from '@/database/models/app-settings.model';

/**
 * POST - Submit a withdrawal request via Nuvei
 */
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
    const userEmail = session.user.email || '';
    const userName = session.user.name || '';
    const body = await req.json();
    const { 
      amountEUR,
      withdrawalMethod, // 'card_payout' | 'bank_transfer'
      cardDetails, // For card refund: { paymentIntentId, cardBrand, cardLast4, userPaymentOptionId }
      bankAccountId, // For bank transfer: existing bank account ID
      userPaymentOptionId, // Direct UPO ID if provided
    } = body;

    // Validate amount
    const amount = parseFloat(amountEUR);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if Nuvei withdrawals are enabled
    const [withdrawalSettings, creditSettings, wallet, appSettings] = await Promise.all([
      WithdrawalSettings.getSingleton(),
      CreditConversionSettings.getSingleton(),
      CreditWallet.findOne({ userId }),
      AppSettings.findById('global-app-settings'),
    ]);
    
    if (!withdrawalSettings.nuveiWithdrawalEnabled) {
      return NextResponse.json(
        { error: 'Automatic withdrawals are not enabled. Please use manual withdrawal.' },
        { status: 400 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const isSandbox = appSettings?.simulatorModeEnabled ?? true;

    // Get fee settings
    const feePercentage = withdrawalSettings.useCustomFees 
      ? withdrawalSettings.platformFeePercentage 
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    // Calculate fees
    const platformFee = (amount * feePercentage / 100) + feeFixed;
    const platformFeeCredits = platformFee * (creditSettings.eurToCreditsRate || 1);
    const netAmountEUR = amount - platformFee;

    if (netAmountEUR <= 0) {
      return NextResponse.json(
        { error: 'Withdrawal amount too small after fees' },
        { status: 400 }
      );
    }

    // Check balance
    const exchangeRate = creditSettings.eurToCreditsRate || 1;
    const creditsNeeded = amount * exchangeRate;

    if (wallet.creditBalance < creditsNeeded) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Validate withdrawal limits
    if (amount < withdrawalSettings.minimumWithdrawal) {
      return NextResponse.json(
        { error: `Minimum withdrawal is €${withdrawalSettings.minimumWithdrawal}` },
        { status: 400 }
      );
    }

    if (amount > withdrawalSettings.maximumWithdrawal) {
      return NextResponse.json(
        { error: `Maximum withdrawal is €${withdrawalSettings.maximumWithdrawal}` },
        { status: 400 }
      );
    }

    // Get bank details for bank transfer or UPO for card refund
    let bankAccount = null;
    let bankDetailsForRequest: any = null;
    let actualUpoId: string | null = null;
    
    if (withdrawalMethod === 'bank_transfer') {
      if (!bankAccountId) {
        return NextResponse.json(
          { error: 'Please select a bank account for withdrawal' },
          { status: 400 }
        );
      }
      
      bankAccount = await UserBankAccount.findOne({
        _id: bankAccountId,
        userId,
        isActive: true,
      });
      
      if (!bankAccount) {
        return NextResponse.json(
          { error: 'Bank account not found. Please add a bank account in your wallet settings.' },
          { status: 400 }
        );
      }
      
      bankDetailsForRequest = {
        accountHolderName: bankAccount.accountHolderName,
        iban: bankAccount.ibanLast4 ? `****${bankAccount.ibanLast4}` : undefined,
        fullIban: bankAccount.iban, // Store full IBAN for admin to process manually
        bankName: bankAccount.bankName,
        swiftBic: bankAccount.swiftBic,
        country: bankAccount.country,
      };
    } else if (withdrawalMethod === 'card_refund' || withdrawalMethod === 'card_payout') {
      // For card refund, we MUST have a valid UPO ID
      actualUpoId = userPaymentOptionId || cardDetails?.userPaymentOptionId;
      
      if (!actualUpoId) {
        // Try to find a UPO from our stored records
        const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
        const storedUpo = await NuveiUserPaymentOption.getMostRecentUPO(userId);
        
        if (storedUpo) {
          actualUpoId = storedUpo.userPaymentOptionId;
          console.log(`💳 Using stored UPO ${actualUpoId} for card refund`);
        }
      }
      
      if (!actualUpoId) {
        return NextResponse.json(
          { 
            error: 'No card available for refund. You need to make a deposit first, or use bank transfer instead.',
            code: 'NO_UPO_AVAILABLE'
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid withdrawal method. Choose card_payout or bank_transfer.' },
        { status: 400 }
      );
    }

    // Generate unique IDs
    const merchantWDRequestId = `wd_${userId.slice(-8)}_${Date.now()}`;
    const userTokenId = `user_${userId}`; // Nuvei user token

    // Build withdrawal params for Nuvei
    const withdrawalParams: Parameters<typeof nuveiService.submitWithdrawal>[0] = {
      userTokenId,
      amount: netAmountEUR.toFixed(2),
      currency: 'EUR',
      merchantWDRequestId,
      merchantUniqueId: `chartvolt_${merchantWDRequestId}`,
      userDetails: {
        email: userEmail || undefined,
        firstName: userName?.split(' ')[0] || undefined,
        lastName: userName?.split(' ').slice(1).join(' ') || undefined,
      },
    };

    // Get DMN URL - use the same webhook as payments (Nuvei uses single DMN URL for both)
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
    withdrawalParams.notificationUrl = `${origin}/api/nuvei/webhook`;

    // Determine if we're doing card or bank payout
    const isCardPayout = (withdrawalMethod === 'card_refund' || withdrawalMethod === 'card_payout') && actualUpoId;
    const isBankTransfer = withdrawalMethod === 'bank_transfer' && bankAccount;

    // Add payment method details for Nuvei
    if (isCardPayout) {
      // For card refund, we MUST pass the UPO ID from the original deposit
      withdrawalParams.userPaymentOptionId = actualUpoId;
      console.log(`💳 Using UPO ${actualUpoId} for card refund withdrawal`);
    }
    // NOTE: For bank transfers, we'll use the new SEPA payout method below

    console.log('💸 Processing Nuvei withdrawal:', {
      userId,
      amountEUR: amount,
      netAmountEUR,
      platformFee,
      method: withdrawalMethod,
      isCardPayout,
      isBankTransfer,
    });

    // Deduct credits from wallet FIRST (optimistic)
    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance -= creditsNeeded;
    await wallet.save();

    // Create pending withdrawal request with ALL required fields
    const withdrawalRequest = await WithdrawalRequest.create({
      // Required user info
      userId,
      userEmail,
      userName,
      
      // Required amount details
      amountCredits: creditsNeeded,
      amountEUR: amount,
      exchangeRate,
      
      // Required fees
      platformFee,
      platformFeeCredits,
      bankFee: 0,
      netAmountEUR,
      
      // Status
      status: 'processing',
      
      // Required wallet state
      walletBalanceBefore: balanceBefore,
      walletBalanceAfter: wallet.creditBalance,
      
      // Payout details
      payoutMethod: (withdrawalMethod === 'card_refund' || withdrawalMethod === 'card_payout') ? 'nuvei_card_payout' : 'nuvei_bank_transfer',
      payoutProvider: 'nuvei',
      
      // Method-specific details
      ...((withdrawalMethod === 'card_refund' || withdrawalMethod === 'card_payout') && cardDetails ? {
        originalPaymentId: cardDetails.paymentIntentId,
        originalPaymentMethod: 'card',
        originalCardDetails: {
          brand: cardDetails.cardBrand,
          last4: cardDetails.cardLast4,
        },
      } : {}),
      ...(withdrawalMethod === 'bank_transfer' && bankAccount ? {
        bankDetails: bankDetailsForRequest,
        bankAccountId: bankAccount._id,
      } : {}),
      
      // KYC and other flags
      isSandbox,
      kycVerified: wallet.kycVerified,
      isAutoApproved: true, // Automatic withdrawals are always "auto-approved"
      autoApprovalReason: 'Automatic withdrawal via Nuvei',
      
      // Request info
      requestedAt: new Date(),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
      
      // Metadata
      metadata: {
        merchantWDRequestId,
        userTokenId,
        provider: 'nuvei',
        initiatedAt: new Date().toISOString(),
      },
    });

    // Create pending wallet transaction
    const walletTx = await WalletTransaction.create({
      userId,
      transactionType: 'withdrawal',
      amount: -creditsNeeded,
      currency: 'EUR',
      exchangeRate,
      balanceBefore,
      balanceAfter: wallet.creditBalance,
      status: 'pending',
      provider: 'nuvei',
      description: `${creditsNeeded.toFixed(0)} credits (€${netAmountEUR.toFixed(2)} net after €${platformFee.toFixed(2)} fee)`,
      metadata: {
        withdrawalRequestId: withdrawalRequest._id.toString(),
        merchantWDRequestId,
        amountEUR: amount,
        netAmountEUR,
        platformFee,
        platformFeePercentage: feePercentage,
        platformFeeFixed: feeFixed,
        withdrawalMethod,
      },
    });

    // Submit to Nuvei
    // For bank transfers, use UPO from /accountCapture flow
    // For card refunds, use the standard submitWithdrawal with UPO
    let nuveiResult: Awaited<ReturnType<typeof nuveiService.submitWithdrawal>>;
    
    if (isBankTransfer && bankAccount) {
      console.log('🏦 Processing bank transfer payout...');
      
      // Check if bank account has Nuvei UPO (from accountCapture flow)
      const bankUpoId = bankAccount.nuveiUpoId;
      
      if (!bankUpoId) {
        console.error('🏦 No Nuvei UPO found for bank account - user needs to complete accountCapture flow');
        
        // Rollback balance
        wallet.creditBalance = balanceBefore;
        await wallet.save();
        
        // Update withdrawal request as failed
        await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
          status: 'failed',
          failedAt: new Date(),
          failedReason: 'Bank account not verified for automatic withdrawals',
          'metadata.refunded': true,
          'metadata.refundedAt': new Date().toISOString(),
          'metadata.refundedCredits': creditsNeeded,
        });
        
        // Update wallet transaction as failed
        await WalletTransaction.findByIdAndUpdate(walletTx._id, {
          status: 'failed',
          failureReason: 'Bank account not verified for automatic withdrawals',
          processedAt: new Date(),
        });
        
        return NextResponse.json(
          { 
            error: 'This bank account is not set up for automatic withdrawals. Please click "Enable Auto" on your bank account in wallet settings first.',
            code: 'BANK_NOT_VERIFIED' 
          },
          { status: 400 }
        );
      }
      
      console.log('🏦 Found Nuvei bank UPO:', bankUpoId);
      
      // Submit bank payout using UPO from accountCapture
      nuveiResult = await nuveiService.submitBankPayout({
        userTokenId,
        amount: netAmountEUR.toFixed(2),
        currency: 'EUR',
        merchantWDRequestId,
        userPaymentOptionId: bankUpoId,
        email: userEmail,
        firstName: userName?.split(' ')[0] || undefined,
        lastName: userName?.split(' ').slice(1).join(' ') || undefined,
        notificationUrl: withdrawalParams.notificationUrl,
      });
    } else {
      // Card refund or other methods
      nuveiResult = await nuveiService.submitWithdrawal(withdrawalParams);
    }

    if ('error' in nuveiResult && nuveiResult.error) {
      console.error('💸 Nuvei withdrawal failed:', nuveiResult.error);
      
      // Determine if this is a technical error (should fallback to manual) or a business error (should fail)
      // Technical errors: connection issues, timeouts, API errors that can be retried
      // Business errors: declined by processor, invalid card, insufficient funds on processor side
      const isTechnicalError = 
        nuveiResult.error.includes('1060') || // Payment data issues - might need manual processing
        nuveiResult.error.includes('timeout') ||
        nuveiResult.error.includes('connection') ||
        nuveiResult.error.includes('network') ||
        nuveiResult.error.includes('unavailable') ||
        nuveiResult.error.includes('General Error') ||
        nuveiResult.error.includes('checksum');
      
      if (isTechnicalError) {
        // FALLBACK TO MANUAL PROCESSING
        // Don't refund credits - keep withdrawal in pending for admin to process
        console.log('💸 Technical error detected - falling back to manual processing');
        
        await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
          status: 'pending', // Keep as pending for admin review
          'metadata.autoProcessingFailed': true,
          'metadata.autoProcessingError': nuveiResult.error,
          'metadata.autoProcessingFailedAt': new Date().toISOString(),
          'metadata.requiresManualProcessing': true,
        });
        
        await WalletTransaction.findByIdAndUpdate(walletTx._id, {
          status: 'pending',
          'metadata.autoProcessingFailed': true,
          'metadata.autoProcessingError': nuveiResult.error,
        });
        
        const userMessage = 'Automatic processing is temporarily unavailable. Your withdrawal has been queued for manual processing by our team within 24-48 hours.';
        
        return NextResponse.json({
          success: true, // Not an error from user perspective
          message: userMessage,
          status: 'pending',
          fallbackToManual: true,
          netAmountEUR,
          platformFee,
          estimatedProcessingTime: '24-48 hours (manual processing)',
        });
      }
      
      // BUSINESS ERROR - Actually failed, refund credits
      console.log('💸 Business error detected - refunding credits');
      
      // Restore balance
      wallet.creditBalance = balanceBefore;
      await wallet.save();
      
      console.log(`💸 Refunded ${creditsNeeded} credits to user ${userId} due to failure`);
      
      // Update withdrawal request as failed
      await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
        status: 'failed',
        failedAt: new Date(),
        failedReason: nuveiResult.error,
        'metadata.refunded': true,
        'metadata.refundedAt': new Date().toISOString(),
        'metadata.refundedCredits': creditsNeeded,
      });
      
      // Update wallet transaction as failed
      await WalletTransaction.findByIdAndUpdate(walletTx._id, {
        status: 'failed',
        failureReason: nuveiResult.error,
        processedAt: new Date(),
      });
      
      // Create a refund transaction for audit trail
      await WalletTransaction.create({
        userId,
        transactionType: 'withdrawal_refund',
        amount: creditsNeeded,
        currency: 'EUR',
        exchangeRate,
        balanceBefore: wallet.creditBalance - creditsNeeded,
        balanceAfter: wallet.creditBalance,
        status: 'completed',
        provider: 'nuvei',
        description: `Withdrawal refund - ${nuveiResult.error}`,
        metadata: {
          withdrawalRequestId: withdrawalRequest._id.toString(),
          merchantWDRequestId,
          refundReason: nuveiResult.error,
          originalAmountEUR: amount,
        },
        processedAt: new Date(),
      });

      return NextResponse.json(
        { 
          error: nuveiResult.error,
          code: 'WITHDRAWAL_DECLINED',
        },
        { status: 400 }
      );
    }

    // Success - update with Nuvei response
    // Determine final status based on Nuvei's response
    // transactionStatus can be: APPROVED, DECLINED, PENDING, ERROR (case-insensitive check)
    const nuveiStatus = (nuveiResult.wdRequestStatus || nuveiResult.transactionStatus || '').toUpperCase();
    let finalStatus: 'processing' | 'completed' | 'failed' = 'processing';
    let statusMessage = 'Withdrawal submitted successfully';
    
    if (nuveiStatus === 'APPROVED') {
      finalStatus = 'completed';
      statusMessage = '🎉 Withdrawal approved! Funds will be sent to your account within 1-3 business days.';
    } else if (nuveiStatus === 'PENDING') {
      // Bank payouts typically start as PENDING and become APPROVED via DMN
      finalStatus = 'processing';
      statusMessage = '✅ Withdrawal submitted! Your bank transfer is being processed and will arrive within 1-3 business days.';
    } else if (nuveiStatus === 'DECLINED' || nuveiStatus === 'ERROR') {
      finalStatus = 'failed';
      statusMessage = 'Withdrawal was declined by the payment processor.';
    }
    
    console.log('💸 Nuvei payout response:', {
      transactionId: nuveiResult.wdRequestId || nuveiResult.transactionId,
      transactionStatus: nuveiStatus,
      finalStatus,
    });
    
    await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
      $set: {
        status: finalStatus,
        ...(finalStatus === 'completed' ? { completedAt: new Date() } : {}),
        ...(finalStatus === 'failed' ? { failedAt: new Date(), failedReason: nuveiResult.reason || 'Declined by processor' } : {}),
        'metadata.nuveiTransactionId': nuveiResult.wdRequestId || nuveiResult.transactionId,
        'metadata.nuveiTransactionStatus': nuveiStatus,
        'metadata.nuveiWdRequestId': nuveiResult.wdRequestId,
        'metadata.nuveiWdStatus': nuveiStatus,
      },
    });

    await WalletTransaction.findByIdAndUpdate(walletTx._id, {
      $set: {
        status: finalStatus === 'completed' ? 'completed' : (finalStatus === 'failed' ? 'failed' : 'pending'),
        ...(finalStatus !== 'processing' ? { processedAt: new Date() } : {}),
        providerTransactionId: nuveiResult.wdRequestId || nuveiResult.transactionId,
        'metadata.nuveiTransactionId': nuveiResult.wdRequestId || nuveiResult.transactionId,
        'metadata.nuveiTransactionStatus': nuveiStatus,
      },
    });

    // If failed, refund the credits
    if (finalStatus === 'failed') {
      wallet.creditBalance = balanceBefore;
      await wallet.save();
      
      // Create refund transaction
      await WalletTransaction.create({
        userId,
        transactionType: 'withdrawal_refund',
        amount: creditsNeeded,
        currency: 'EUR',
        exchangeRate,
        balanceBefore: wallet.creditBalance - creditsNeeded,
        balanceAfter: wallet.creditBalance,
        status: 'completed',
        provider: 'nuvei',
        description: `Withdrawal refund - ${nuveiResult.reason || 'Declined by processor'}`,
        metadata: {
          withdrawalRequestId: withdrawalRequest._id.toString(),
          merchantWDRequestId,
          refundReason: nuveiResult.reason || 'Declined by processor',
        },
        processedAt: new Date(),
      });
      
      return NextResponse.json({
        success: false,
        error: statusMessage,
        wdRequestId: nuveiResult.wdRequestId,
        wdRequestStatus: nuveiStatus,
      }, { status: 400 });
    }

    console.log('💸 Nuvei withdrawal completed successfully:', {
      transactionId: nuveiResult.wdRequestId || nuveiResult.transactionId,
      status: finalStatus,
    });

    return NextResponse.json({
      success: true,
      message: statusMessage,
      wdRequestId: nuveiResult.wdRequestId || nuveiResult.transactionId,
      wdRequestStatus: nuveiStatus,
      status: finalStatus,
      netAmountEUR,
      platformFee,
      estimatedProcessingTime: finalStatus === 'completed' ? '1-3 business days for funds to arrive' : '1-3 business days',
    });
  } catch (error) {
    console.error('Nuvei withdrawal error:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get user's Nuvei withdrawal requests
 */
export async function GET() {
  try {
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
    const userTokenId = `user_${userId}`;

    await connectToDatabase();

    // Check if Nuvei withdrawals are enabled
    const withdrawalSettings = await WithdrawalSettings.getSingleton();
    
    // Get pending requests from Nuvei
    const nuveiRequests = await nuveiService.getWithdrawalRequests({ userTokenId });

    // Get our local withdrawal records
    const localRequests = await WithdrawalRequest.find({
      userId,
      'metadata.provider': 'nuvei',
    }).sort({ createdAt: -1 }).limit(20);

    return NextResponse.json({
      nuveiEnabled: withdrawalSettings.nuveiWithdrawalEnabled,
      nuveiRequests: 'withdrawalRequests' in nuveiRequests ? nuveiRequests.withdrawalRequests : [],
      localRequests,
    });
  } catch (error) {
    console.error('Error getting Nuvei withdrawals:', error);
    return NextResponse.json(
      { error: 'Failed to get withdrawal requests' },
      { status: 500 }
    );
  }
}

