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
    const body = await req.json();
    const { 
      amountEUR,
      withdrawalMethod, // 'card_refund' | 'bank_transfer'
      userPaymentOptionId, // For card refund
      bankDetails, // For bank transfer: { iban, bic, accountHolderName }
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
    const withdrawalSettings = await WithdrawalSettings.getSingleton();
    
    if (!withdrawalSettings.nuveiWithdrawalEnabled) {
      return NextResponse.json(
        { error: 'Automatic withdrawals are not enabled. Please use manual withdrawal.' },
        { status: 400 }
      );
    }

    // Get user's wallet
    const wallet = await CreditWallet.findOne({ userId });
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Get fee settings
    const creditSettings = await CreditConversionSettings.getSingleton();
    const feePercentage = withdrawalSettings.useCustomFees 
      ? withdrawalSettings.platformFeePercentage 
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    // Calculate fees
    const platformFee = (amount * feePercentage / 100) + feeFixed;
    const netAmountEUR = amount - platformFee;

    if (netAmountEUR <= 0) {
      return NextResponse.json(
        { error: 'Withdrawal amount too small after fees' },
        { status: 400 }
      );
    }

    // Check balance (assuming 1:1 EUR to credits for simplicity)
    const exchangeRate = creditSettings.eurToCredits || 1;
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

    // Generate unique IDs
    const merchantWDRequestId = `wd_${userId.slice(-8)}_${Date.now()}`;
    const userTokenId = `user_${userId}`; // Nuvei user token

    // Build withdrawal params
    const withdrawalParams: Parameters<typeof nuveiService.submitWithdrawal>[0] = {
      userTokenId,
      amount: netAmountEUR.toFixed(2),
      currency: 'EUR',
      merchantWDRequestId,
      merchantUniqueId: `chartvolt_${merchantWDRequestId}`,
      userDetails: {
        email: session.user.email || undefined,
        firstName: session.user.name?.split(' ')[0] || undefined,
        lastName: session.user.name?.split(' ').slice(1).join(' ') || undefined,
      },
    };

    // Add payment method details
    if (withdrawalMethod === 'card_refund' && userPaymentOptionId) {
      withdrawalParams.userPaymentOptionId = userPaymentOptionId;
    } else if (withdrawalMethod === 'bank_transfer' && bankDetails) {
      withdrawalParams.bankDetails = {
        iban: bankDetails.iban,
        bic: bankDetails.bic,
        accountHolderName: bankDetails.accountHolderName,
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid withdrawal method. Specify card_refund with UPO ID or bank_transfer with bank details.' },
        { status: 400 }
      );
    }

    // Get DMN URL
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
    withdrawalParams.notificationUrl = `${origin}/api/nuvei/withdrawal-webhook`;

    console.log('💸 Processing Nuvei withdrawal:', {
      userId,
      amountEUR: amount,
      netAmountEUR,
      platformFee,
      method: withdrawalMethod,
    });

    // Deduct credits from wallet FIRST (optimistic)
    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance -= creditsNeeded;
    await wallet.save();

    // Create pending withdrawal request in our system
    const withdrawalRequest = await WithdrawalRequest.create({
      userId,
      amountRequested: creditsNeeded,
      amountRequestedEUR: amount,
      platformFee,
      netAmountEUR,
      status: 'processing',
      payoutMethod: withdrawalMethod === 'card_refund' ? 'nuvei_card_refund' : 'nuvei_bank_transfer',
      payoutDetails: withdrawalMethod === 'card_refund' 
        ? { userPaymentOptionId }
        : { bankDetails },
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
      balanceBefore,
      balanceAfter: wallet.creditBalance,
      status: 'pending',
      provider: 'nuvei',
      description: `Withdrawal €${netAmountEUR.toFixed(2)} (Fee: €${platformFee.toFixed(2)})`,
      metadata: {
        withdrawalRequestId: withdrawalRequest._id.toString(),
        merchantWDRequestId,
        amountEUR: amount,
        netAmountEUR,
        platformFee,
        feePercentage,
        withdrawalMethod,
      },
    });

    // Submit to Nuvei
    const nuveiResult = await nuveiService.submitWithdrawal(withdrawalParams);

    if ('error' in nuveiResult && nuveiResult.error) {
      // Nuvei failed - rollback
      console.error('💸 Nuvei withdrawal failed:', nuveiResult.error);
      
      // Restore balance
      wallet.creditBalance = balanceBefore;
      await wallet.save();
      
      // Update records as failed
      await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
        status: 'failed',
        failedAt: new Date(),
        failedReason: nuveiResult.error,
      });
      
      await WalletTransaction.findByIdAndUpdate(walletTx._id, {
        status: 'failed',
        failureReason: nuveiResult.error,
        processedAt: new Date(),
      });

      return NextResponse.json(
        { error: nuveiResult.error },
        { status: 500 }
      );
    }

    // Success - update with Nuvei response
    await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
      $set: {
        'metadata.nuveiWdRequestId': nuveiResult.wdRequestId,
        'metadata.nuveiWdStatus': nuveiResult.wdRequestStatus,
      },
    });

    await WalletTransaction.findByIdAndUpdate(walletTx._id, {
      $set: {
        providerTransactionId: nuveiResult.wdRequestId,
        'metadata.nuveiWdRequestId': nuveiResult.wdRequestId,
        'metadata.nuveiWdStatus': nuveiResult.wdRequestStatus,
      },
    });

    console.log('💸 Nuvei withdrawal submitted successfully:', {
      wdRequestId: nuveiResult.wdRequestId,
      wdRequestStatus: nuveiResult.wdRequestStatus,
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal submitted successfully',
      wdRequestId: nuveiResult.wdRequestId,
      wdRequestStatus: nuveiResult.wdRequestStatus,
      netAmountEUR,
      platformFee,
      estimatedProcessingTime: '1-3 business days',
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

