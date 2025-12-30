import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import WithdrawalSettings from '@/database/models/withdrawal-settings.model';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import Challenge from '@/database/models/trading/challenge.model';
import AppSettings from '@/database/models/app-settings.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import KYCSettings from '@/database/models/kyc-settings.model';

/**
 * GET /api/wallet/withdraw
 * Get withdrawal eligibility and settings for current user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const [withdrawalSettings, creditSettings, wallet, appSettings, kycSettings] = await Promise.all([
      WithdrawalSettings.getSingleton(),
      CreditConversionSettings.getSingleton(),
      CreditWallet.findOne({ userId: session.user.id }),
      AppSettings.findById('global-app-settings'),
      KYCSettings.findOne(),
    ]);

    if (!wallet) {
      return NextResponse.json({
        success: true,
        eligible: false,
        reason: 'No wallet found',
        settings: null,
      });
    }

    const isSandbox = appSettings?.simulatorModeEnabled ?? true;
    
    // Determine if KYC is required - check KYC settings first, fallback to withdrawal settings
    const kycRequiredForWithdrawal = (kycSettings?.enabled && kycSettings?.requiredForWithdrawal) || withdrawalSettings.requireKYC;

    // Check eligibility
    const eligibility = await checkWithdrawalEligibility(
      session.user.id,
      wallet,
      withdrawalSettings,
      creditSettings,
      isSandbox,
      kycRequiredForWithdrawal
    );

    // Calculate fees
    const feePercentage = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeePercentage
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    // Get user's last deposit for original payment method
    const lastDeposit = await WalletTransaction.findOne({
      userId: session.user.id,
      transactionType: 'deposit',
      status: 'completed',
    }).sort({ createdAt: -1 });

    // Get user's bank accounts for withdrawals
    const bankAccounts = await UserBankAccount.getUserAccounts(session.user.id);
    const defaultBankAccount = bankAccounts.find(a => a.isDefault) || bankAccounts[0];
    const hasBankAccount = bankAccounts.length > 0;

    // Get conversion rate
    const conversionRate = creditSettings.eurToCreditsRate || 100;
    const balanceEUR = wallet.creditBalance / conversionRate;

    // Build available withdrawal methods
    const availableWithdrawalMethods: Array<{
      id: string;
      type: 'original_method' | 'bank_account';
      label: string;
      details: string;
      cardBrand?: string;
      cardLast4?: string;
      bankName?: string;
      ibanLast4?: string;
      country?: string;
      isDefault?: boolean;
      userPaymentOptionId?: string; // Nuvei UPO ID for card refunds
    }> = [];

    // Try to get stored UPOs for card refunds (Nuvei)
    let storedUPOs: any[] = [];
    try {
      const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
      storedUPOs = await NuveiUserPaymentOption.getActiveUPOs(session.user.id);
    } catch (e) {
      console.log('Could not fetch stored UPOs (model may not exist yet)');
    }

    // Add stored UPOs as card options (these have valid UPO IDs for Nuvei refunds)
    for (const upo of storedUPOs) {
      const expiryStr = upo.expMonth && upo.expYear ? `${upo.expMonth}/${upo.expYear}` : '';
      availableWithdrawalMethods.push({
        id: `upo_${upo.userPaymentOptionId}`,
        type: 'original_method',
        label: `${upo.cardBrand || 'Card'} •••• ${upo.cardLast4 || '****'}`,
        details: expiryStr ? `Expires ${expiryStr}` : 'From deposit',
        cardBrand: upo.cardBrand,
        cardLast4: upo.cardLast4,
        userPaymentOptionId: upo.userPaymentOptionId, // CRITICAL: Include UPO ID
      });
    }

    // Add original payment method if no UPOs stored but there's a deposit
    // (without UPO, can only be used for manual refunds, not automatic Nuvei)
    if (storedUPOs.length === 0 && lastDeposit?.paymentMethod) {
      const cardLast4 = lastDeposit.metadata?.cardLast4 || lastDeposit.metadata?.last4;
      const cardBrand = lastDeposit.metadata?.cardBrand || lastDeposit.metadata?.brand || lastDeposit.paymentMethod;
      const upoFromDeposit = lastDeposit.metadata?.userPaymentOptionId;
      
      availableWithdrawalMethods.push({
        id: 'original_method',
        type: 'original_method',
        label: `Original Payment Method`,
        details: cardLast4 
          ? `${cardBrand} •••• ${cardLast4}${!upoFromDeposit ? ' (manual only)' : ''}`
          : cardBrand,
        cardBrand,
        cardLast4,
        userPaymentOptionId: upoFromDeposit, // May be undefined if old deposit
      });
    }

    // Add bank accounts
    for (const bankAccount of bankAccounts) {
      availableWithdrawalMethods.push({
        id: bankAccount._id.toString(),
        type: 'bank_account',
        label: bankAccount.nickname || `Bank Account ****${bankAccount.ibanLast4}`,
        details: bankAccount.bankName 
          ? `${bankAccount.bankName} (****${bankAccount.ibanLast4})`
          : `****${bankAccount.ibanLast4}`,
        bankName: bankAccount.bankName,
        ibanLast4: bankAccount.ibanLast4,
        country: bankAccount.country,
        isDefault: bankAccount.isDefault,
      });
    }

    // Update warning if no methods available
    if (availableWithdrawalMethods.length === 0 && eligibility.eligible) {
      eligibility.warnings = eligibility.warnings || [];
      eligibility.warnings.push('No withdrawal method available. Please add a bank account or make a deposit first.');
    }

    return NextResponse.json({
      success: true,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      warnings: eligibility.warnings,
      wallet: {
        balance: wallet.creditBalance,
        balanceEUR: balanceEUR,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        kycVerified: wallet.kycVerified,
        withdrawalEnabled: wallet.withdrawalEnabled,
      },
      settings: {
        minimumWithdrawal: withdrawalSettings.minimumWithdrawal,
        maximumWithdrawal: withdrawalSettings.maximumWithdrawal,
        dailyLimit: withdrawalSettings.dailyWithdrawalLimit,
        monthlyLimit: withdrawalSettings.monthlyWithdrawalLimit,
        feePercentage,
        feeFixed,
        processingTimeHours: withdrawalSettings.processingTimeHours,
        allowedMethods: withdrawalSettings.allowedPayoutMethods,
        preferredMethod: withdrawalSettings.preferredPayoutMethod,
        requireKYC: kycRequiredForWithdrawal,
        conversionRate: conversionRate,
      },
      isSandbox,
      originalPaymentMethod: lastDeposit?.paymentMethod || null,
      // Available withdrawal methods for dropdown
      availableWithdrawalMethods,
      hasWithdrawalMethod: availableWithdrawalMethods.length > 0,
      // Nuvei automatic withdrawal enabled
      nuveiEnabled: withdrawalSettings.nuveiWithdrawalEnabled === true,
      // Legacy bank account info
      hasBankAccount,
      bankAccount: defaultBankAccount ? {
        id: defaultBankAccount._id,
        nickname: defaultBankAccount.nickname,
        bankName: defaultBankAccount.bankName,
        ibanLast4: defaultBankAccount.ibanLast4,
        country: defaultBankAccount.country,
        isVerified: defaultBankAccount.isVerified,
      } : null,
      bankAccountCount: bankAccounts.length,
    });
  } catch (error) {
    console.error('Error getting withdrawal info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get withdrawal information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wallet/withdraw
 * Create a new withdrawal request
 */
export async function POST(request: NextRequest) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amountEUR, withdrawalMethodId, userNote } = body;

    if (!amountEUR || amountEUR <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    if (!withdrawalMethodId) {
      return NextResponse.json(
        { success: false, error: 'Please select a withdrawal method' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const [withdrawalSettings, creditSettings, wallet, appSettings, kycSettings] = await Promise.all([
      WithdrawalSettings.getSingleton(),
      CreditConversionSettings.getSingleton(),
      CreditWallet.findOne({ userId: session.user.id }).session(mongoSession),
      AppSettings.findById('global-app-settings'),
      KYCSettings.findOne(),
    ]);

    if (!wallet) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const isSandbox = appSettings?.simulatorModeEnabled ?? true;
    const kycRequiredForWithdrawal = (kycSettings?.enabled && kycSettings?.requiredForWithdrawal) || withdrawalSettings.requireKYC;

    // Determine withdrawal method (original method, UPO card, or bank account)
    let bankAccount = null;
    let originalPaymentDetails = null;
    let payoutMethodType = 'bank_transfer';

    if (withdrawalMethodId === 'original_method') {
      // Using original payment method (card)
      const lastDeposit = await WalletTransaction.findOne({
        userId: session.user.id,
        transactionType: 'deposit',
        status: 'completed',
      }).sort({ createdAt: -1 }).session(mongoSession);

      if (!lastDeposit) {
        await mongoSession.abortTransaction();
        return NextResponse.json(
          { success: false, error: 'No original payment method found. Please make a deposit first or add a bank account.' },
          { status: 400 }
        );
      }

      payoutMethodType = 'original_method';
      originalPaymentDetails = {
        paymentIntentId: lastDeposit.metadata?.paymentIntentId,
        paymentMethod: lastDeposit.paymentMethod,
        cardBrand: lastDeposit.metadata?.cardBrand || lastDeposit.metadata?.brand,
        cardLast4: lastDeposit.metadata?.cardLast4 || lastDeposit.metadata?.last4,
        cardExpMonth: lastDeposit.metadata?.cardExpMonth,
        cardExpYear: lastDeposit.metadata?.cardExpYear,
        cardCountry: lastDeposit.metadata?.cardCountry,
      };
    } else if (withdrawalMethodId.startsWith('upo_')) {
      // Using a Nuvei UPO (User Payment Option) - card from previous deposit
      const upoId = withdrawalMethodId.replace('upo_', '');
      
      // Try to find the UPO in our stored records
      const NuveiUserPaymentOption = (await import('@/database/models/nuvei-user-payment-option.model')).default;
      const storedUpo = await NuveiUserPaymentOption.findOne({
        userId: session.user.id,
        userPaymentOptionId: upoId,
      }).session(mongoSession);
      
      if (!storedUpo) {
        // UPO not found in our records, but might still be valid in Nuvei
        // For manual processing, just record the card details
        console.log(`⚠️ UPO ${upoId} not found in local records, proceeding with manual withdrawal`);
      }
      
      payoutMethodType = 'card_refund';
      originalPaymentDetails = {
        userPaymentOptionId: upoId,
        paymentMethod: 'nuvei_card',
        cardBrand: storedUpo?.cardBrand || 'Card',
        cardLast4: storedUpo?.cardLast4 || '****',
        cardExpMonth: storedUpo?.expiryMonth,
        cardExpYear: storedUpo?.expiryYear,
      };
    } else {
      // Using bank account - withdrawalMethodId should be a valid MongoDB ObjectId
      bankAccount = await UserBankAccount.findOne({
        _id: withdrawalMethodId,
        userId: session.user.id,
        isActive: true,
      }).session(mongoSession);

      if (!bankAccount) {
        await mongoSession.abortTransaction();
        return NextResponse.json(
          { success: false, error: 'Selected bank account not found' },
          { status: 400 }
        );
      }
      payoutMethodType = 'bank_transfer';
    }

    // Check eligibility
    const eligibility = await checkWithdrawalEligibility(
      session.user.id,
      wallet,
      withdrawalSettings,
      creditSettings,
      isSandbox,
      kycRequiredForWithdrawal
    );

    if (!eligibility.eligible) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: eligibility.reason },
        { status: 400 }
      );
    }

    // Validate amount
    if (amountEUR < withdrawalSettings.minimumWithdrawal) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal is €${withdrawalSettings.minimumWithdrawal}` },
        { status: 400 }
      );
    }

    if (amountEUR > withdrawalSettings.maximumWithdrawal) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Maximum withdrawal is €${withdrawalSettings.maximumWithdrawal}` },
        { status: 400 }
      );
    }

    // Convert EUR to credits
    const exchangeRate = creditSettings.eurToCreditsRate;
    const amountCredits = amountEUR * exchangeRate;

    if (amountCredits > wallet.creditBalance) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Check daily limit
    const dailyTotal = await WithdrawalRequest.getDailyTotal(session.user.id);
    if (withdrawalSettings.dailyWithdrawalLimit > 0 && 
        dailyTotal + amountEUR > withdrawalSettings.dailyWithdrawalLimit) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Would exceed daily limit of €${withdrawalSettings.dailyWithdrawalLimit}` },
        { status: 400 }
      );
    }

    // Check monthly limit
    const monthlyTotal = await WithdrawalRequest.getMonthlyTotal(session.user.id);
    if (withdrawalSettings.monthlyWithdrawalLimit > 0 && 
        monthlyTotal + amountEUR > withdrawalSettings.monthlyWithdrawalLimit) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Would exceed monthly limit of €${withdrawalSettings.monthlyWithdrawalLimit}` },
        { status: 400 }
      );
    }

    // Calculate fees
    const feePercentage = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeePercentage
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    const platformFee = (amountEUR * feePercentage / 100) + feeFixed;
    const platformFeeCredits = platformFee * exchangeRate;
    const netAmountEUR = amountEUR - platformFee;

    // Deduct credits from wallet
    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance -= amountCredits;
    await wallet.save({ session: mongoSession });

    // Build withdrawal request data based on selected method
    const withdrawalRequestData: any = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      amountCredits,
      amountEUR,
      exchangeRate,
      platformFee,
      platformFeeCredits,
      bankFee: 0, // Will be calculated when processing
      netAmountEUR,
      status: 'pending',
      payoutMethod: payoutMethodType,
      walletBalanceBefore: balanceBefore,
      walletBalanceAfter: wallet.creditBalance,
      isSandbox,
      kycVerified: wallet.kycVerified,
      userNote,
      requestedAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    };

    // Add method-specific details
    if (payoutMethodType === 'original_method' && originalPaymentDetails) {
      // Original payment method (card refund from Stripe/other provider)
      withdrawalRequestData.originalPaymentId = originalPaymentDetails.paymentIntentId;
      withdrawalRequestData.originalPaymentMethod = originalPaymentDetails.paymentMethod;
      withdrawalRequestData.originalCardDetails = {
        brand: originalPaymentDetails.cardBrand,
        last4: originalPaymentDetails.cardLast4,
        expMonth: originalPaymentDetails.cardExpMonth,
        expYear: originalPaymentDetails.cardExpYear,
        country: originalPaymentDetails.cardCountry,
      };
    } else if (payoutMethodType === 'card_refund' && originalPaymentDetails) {
      // Nuvei UPO card refund
      withdrawalRequestData.originalPaymentMethod = originalPaymentDetails.paymentMethod || 'nuvei_card';
      withdrawalRequestData.originalCardDetails = {
        brand: originalPaymentDetails.cardBrand,
        last4: originalPaymentDetails.cardLast4,
        expMonth: originalPaymentDetails.cardExpMonth,
        expYear: originalPaymentDetails.cardExpYear,
        userPaymentOptionId: originalPaymentDetails.userPaymentOptionId,
      };
    } else if (bankAccount) {
      // Bank transfer
      withdrawalRequestData.bankDetails = {
        accountHolderName: bankAccount.accountHolderName,
        iban: bankAccount.ibanLast4 ? `****${bankAccount.ibanLast4}` : undefined,
        fullIban: bankAccount.iban, // Store full IBAN for processing
        bankName: bankAccount.bankName,
        swiftBic: bankAccount.swiftBic,
        country: bankAccount.country,
      };
      withdrawalRequestData.bankAccountId = bankAccount._id;
    }

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create(
      [withdrawalRequestData],
      { session: mongoSession }
    );

    // Record wallet transaction with proper description (same format as deposits)
    const withdrawalTx = await WalletTransaction.create(
      [{
        userId: session.user.id,
        transactionType: 'withdrawal',
        amount: -amountCredits,
        balanceBefore,
        balanceAfter: wallet.creditBalance,
        currency: 'EUR',
        exchangeRate,
        status: 'pending',
        description: `${amountCredits} credits (€${netAmountEUR.toFixed(2)} net after €${platformFee.toFixed(2)} fee)`,
        metadata: {
          withdrawalRequestId: withdrawalRequest[0]._id,
          amountEUR,
          netAmountEUR,
          platformFee,
          platformFeePercentage: feePercentage,
          platformFeeFixed: feeFixed,
        },
      }],
      { session: mongoSession }
    );

    // NOTE: Don't create withdrawal_fee transaction here!
    // Withdrawal fees should ONLY be recorded when the withdrawal is actually COMPLETED by admin.
    // This prevents charging users fees for failed/rejected withdrawals.
    // The fee will be recorded in:
    // - apps/admin/app/api/withdrawals/[id]/route.ts when admin marks as 'completed'

    await mongoSession.commitTransaction();

    // NOTE: Don't record withdrawal fee to platform financials here either!
    // It will be recorded when the withdrawal is completed.
    console.log(`💵 Withdrawal fee (€${platformFee.toFixed(2)}) will be recorded when withdrawal is completed`);

    // Check for auto-approval (sandbox mode only)
    let autoApproved = false;

    if (isSandbox && withdrawalSettings.sandboxAutoApprove) {
      // Auto-approve sandbox withdrawals
      withdrawalRequest[0].status = 'approved';
      withdrawalRequest[0].isAutoApproved = true;
      withdrawalRequest[0].autoApprovalReason = 'Sandbox mode auto-approval';
      withdrawalRequest[0].processedAt = new Date();
      await withdrawalRequest[0].save();
      autoApproved = true;
    } else if (
      withdrawalSettings.processingMode === 'automatic' &&
      withdrawalSettings.autoApproveEnabled &&
      amountEUR <= withdrawalSettings.autoApproveMaxAmount
    ) {
      // Check auto-approval criteria for production
      const accountCreatedAt = new Date(session.user.createdAt || Date.now());
      const accountAge = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const previousWithdrawals = await WithdrawalRequest.countDocuments({
        userId: session.user.id,
        status: 'completed',
      });

      const meetsKYC = !withdrawalSettings.autoApproveRequireKYC || wallet.kycVerified;
      const meetsAge = accountAge >= withdrawalSettings.autoApproveMinAccountAge;
      const meetsHistory = previousWithdrawals >= withdrawalSettings.autoApproveMinSuccessfulWithdrawals;

      if (meetsKYC && meetsAge && meetsHistory) {
        withdrawalRequest[0].status = 'approved';
        withdrawalRequest[0].isAutoApproved = true;
        withdrawalRequest[0].autoApprovalReason = `Met auto-approval criteria: Amount ≤ €${withdrawalSettings.autoApproveMaxAmount}, Account age ${accountAge} days, Previous withdrawals: ${previousWithdrawals}`;
        withdrawalRequest[0].processedAt = new Date();
        await withdrawalRequest[0].save();
        autoApproved = true;
      }
    }

    // Note: Auto-approved withdrawals still need admin to complete the bank transfer
    // The auto-approval just skips the initial review step in sandbox mode
    // Admin must still mark as "completed" after actual bank transfer
    
    const finalStatus = withdrawalRequest[0].status;
    let message = 'Withdrawal request submitted successfully. It will be reviewed shortly.';
    
    if (autoApproved && finalStatus === 'approved') {
      message = '✅ Withdrawal auto-approved! Funds will be transferred to your bank account within 24-48 hours.';
    } else if (autoApproved && finalStatus === 'completed') {
      message = '🎉 Withdrawal processed successfully! Funds are on the way.';
    } else if (finalStatus === 'processing') {
      message = 'Withdrawal approved and being processed! You will be notified when complete.';
    } else if (autoApproved) {
      message = 'Withdrawal request approved! Processing will begin shortly.';
    }

    return NextResponse.json({
      success: true,
      message,
      withdrawalRequest: {
        id: withdrawalRequest[0]._id,
        status: finalStatus,
        amountEUR,
        netAmountEUR,
        platformFee,
        estimatedProcessingHours: withdrawalSettings.processingTimeHours,
        isAutoApproved: autoApproved,
        payoutId: withdrawalRequest[0].payoutId || null,
      },
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error creating withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create withdrawal request' },
      { status: 500 }
    );
  } finally {
    mongoSession.endSession();
  }
}

/**
 * Check if user is eligible for withdrawal
 */
async function checkWithdrawalEligibility(
  userId: string,
  wallet: any,
  settings: any,
  creditSettings: any,
  isSandbox: boolean,
  kycRequired: boolean = false
): Promise<{ eligible: boolean; reason: string; warnings: string[] }> {
  const warnings: string[] = [];
  
  // Get the actual conversion rate from credit settings
  const conversionRate = creditSettings?.eurToCreditsRate || 100;

  // ============================================
  // FIRST: Check user restrictions (banned/suspended)
  // This must be checked before anything else!
  // ============================================
  const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
  const restrictionCheck = await canUserPerformAction(userId, 'withdraw');
  
  if (!restrictionCheck.allowed) {
    return {
      eligible: false,
      reason: restrictionCheck.reason || 'Your account is restricted from withdrawals. Please contact support.',
      warnings,
    };
  }

  // Check if sandbox withdrawals are enabled
  if (isSandbox && !settings.sandboxEnabled) {
    return {
      eligible: false,
      reason: 'Withdrawals are disabled in sandbox mode',
      warnings,
    };
  }

  // Check if wallet is active
  if (!wallet.isActive) {
    return {
      eligible: false,
      reason: 'Your wallet is inactive. Please contact support.',
      warnings,
    };
  }
  
  // Note: wallet.withdrawalEnabled is no longer checked here
  // Admin withdrawal settings now control eligibility globally

  // Check minimum balance using actual conversion rate
  const minCreditsRequired = settings.minimumWithdrawal * conversionRate;
  if (wallet.creditBalance < minCreditsRequired) {
    const userBalanceEUR = (wallet.creditBalance / conversionRate).toFixed(2);
    return {
      eligible: false,
      reason: `Minimum withdrawal amount is €${settings.minimumWithdrawal}. Your balance is €${userBalanceEUR}`,
      warnings,
    };
  }

  // Check KYC requirement (uses combined KYC settings from both models)
  if (kycRequired && !wallet.kycVerified) {
    return {
      eligible: false,
      reason: 'KYC verification required before withdrawal. Please complete identity verification.',
      warnings,
    };
  }

  // Check deposit requirement
  if (settings.minimumDepositRequired && wallet.totalDeposited === 0) {
    return {
      eligible: false,
      reason: 'You must make at least one deposit before withdrawing',
      warnings,
    };
  }

  // Check withdrawal frequency limits
  const todayCount = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ['pending', 'approved', 'processing', 'completed'] },
    requestedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  });

  if (todayCount >= settings.maxWithdrawalsPerDay) {
    return {
      eligible: false,
      reason: `Maximum ${settings.maxWithdrawalsPerDay} withdrawal requests per day`,
      warnings,
    };
  }

  // Check monthly limit
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const monthCount = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ['pending', 'approved', 'processing', 'completed'] },
    requestedAt: { $gte: startOfMonth },
  });

  if (monthCount >= settings.maxWithdrawalsPerMonth) {
    return {
      eligible: false,
      reason: `Maximum ${settings.maxWithdrawalsPerMonth} withdrawal requests per month`,
      warnings,
    };
  }

  // Check cooldown
  if (settings.cooldownHours > 0) {
    const lastWithdrawal = await WithdrawalRequest.findOne({
      userId,
      status: { $in: ['pending', 'approved', 'processing', 'completed'] },
    }).sort({ requestedAt: -1 });

    if (lastWithdrawal) {
      const cooldownEnd = new Date(lastWithdrawal.requestedAt);
      cooldownEnd.setHours(cooldownEnd.getHours() + settings.cooldownHours);
      
      if (cooldownEnd > new Date()) {
        const hoursLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60));
        return {
          eligible: false,
          reason: `Please wait ${hoursLeft} more hour(s) before your next withdrawal`,
          warnings,
        };
      }
    }
  }

  // Check hold period after deposit
  if (settings.holdPeriodAfterDeposit > 0) {
    const lastDeposit = await WalletTransaction.findOne({
      userId,
      transactionType: 'deposit',
      status: 'completed',
    }).sort({ createdAt: -1 });

    if (lastDeposit) {
      const holdEnd = new Date(lastDeposit.createdAt);
      holdEnd.setHours(holdEnd.getHours() + settings.holdPeriodAfterDeposit);
      
      if (holdEnd > new Date()) {
        const hoursLeft = Math.ceil((holdEnd.getTime() - Date.now()) / (1000 * 60 * 60));
        return {
          eligible: false,
          reason: `Please wait ${hoursLeft} more hour(s) after your last deposit`,
          warnings,
        };
      }
    }
  }

  // Check active competitions/challenges
  if (!settings.allowWithdrawalDuringActiveCompetitions) {
    // IMPROVED: Check for participants where BOTH the participant AND competition are still active
    // This handles cases where competition ended but participant status wasn't updated
    const Competition = (await import('@/database/models/trading/competition.model')).default;
    
    // Get all participant records for this user
    const participantRecords = await CompetitionParticipant.find({
      userId: userId,
      status: 'active',
    }).select('competitionId').lean();

    if (participantRecords.length > 0) {
      // Check if any of these competitions are actually still active
      const competitionIds = participantRecords.map((p: any) => p.competitionId);
      const activeCompetitionCount = await Competition.countDocuments({
        _id: { $in: competitionIds },
        status: 'active', // Only count if competition itself is still active
      });

      if (activeCompetitionCount > 0) {
        return {
          eligible: false,
          reason: `You have ${activeCompetitionCount} active competition(s). Complete them before withdrawing.`,
          warnings,
        };
      }

      // If participant is 'active' but competition is NOT active, auto-fix the participant status
      if (participantRecords.length > activeCompetitionCount) {
        const staleCount = participantRecords.length - activeCompetitionCount;
        console.log(`⚠️ Found ${staleCount} orphaned 'active' participant(s) - competition already ended. Auto-fixing...`);
        
        // Get competitions that are NOT active
        const nonActiveCompetitions = await Competition.find({
          _id: { $in: competitionIds },
          status: { $ne: 'active' },
        }).select('_id status').lean();

        for (const comp of nonActiveCompetitions) {
          const newStatus = (comp as any).status === 'cancelled' ? 'refunded' : 'completed';
          await CompetitionParticipant.updateMany(
            { userId, competitionId: (comp as any)._id, status: 'active' },
            { $set: { status: newStatus } }
          );
          console.log(`   ✅ Fixed participant status to '${newStatus}' for competition ${(comp as any)._id}`);
        }
      }
    }
  }

  if (settings.blockWithdrawalOnActiveChallenges) {
    // Find active challenges where user is either challenger or challenged
    // Status values: 'pending' = waiting for accept, 'accepted' = accepted but not started, 'active' = in progress
    const activeChallenges = await Challenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: { $in: ['pending', 'accepted', 'active'] },
    }).select('_id status challengerId challengedId acceptDeadline createdAt').lean();

    // Debug log to help identify stale challenges
    if (activeChallenges.length > 0) {
      console.log(`🔍 Found ${activeChallenges.length} blocking challenge(s) for user ${userId}:`);
      activeChallenges.forEach((c: any, i: number) => {
        console.log(`   Challenge ${i + 1}: id=${c._id}, status=${c.status}, challengerId=${c.challengerId}, challengedId=${c.challengedId}, acceptDeadline=${c.acceptDeadline}, createdAt=${c.createdAt}`);
      });
      
      // Check if any pending challenges have expired accept deadlines
      const now = new Date();
      const expiredPending = activeChallenges.filter((c: any) => 
        c.status === 'pending' && c.acceptDeadline && new Date(c.acceptDeadline) < now
      );
      
      if (expiredPending.length > 0) {
        console.log(`⚠️  Found ${expiredPending.length} expired pending challenge(s) - these should have been auto-expired!`);
        // Auto-expire these stale challenges
        for (const expiredChallenge of expiredPending) {
          try {
            await Challenge.updateOne(
              { _id: expiredChallenge._id, status: 'pending' },
              { $set: { status: 'expired', expiredAt: now } }
            );
            console.log(`   ✅ Auto-expired stale challenge ${expiredChallenge._id}`);
          } catch (err) {
            console.error(`   ❌ Failed to expire challenge ${expiredChallenge._id}:`, err);
          }
        }
        
        // Re-check after cleanup
        const remainingChallenges = activeChallenges.filter((c: any) => 
          !(c.status === 'pending' && c.acceptDeadline && new Date(c.acceptDeadline) < now)
        );
        
        if (remainingChallenges.length === 0) {
          console.log(`   ✅ All blocking challenges were expired - user can now withdraw`);
          // Continue to next check instead of blocking
        } else {
          const pendingCount = remainingChallenges.filter((c: any) => c.status === 'pending').length;
          const activeCount = remainingChallenges.filter((c: any) => c.status === 'accepted' || c.status === 'active').length;
          
          let message = 'You have ';
          const parts = [];
          if (pendingCount > 0) parts.push(`${pendingCount} pending challenge(s)`);
          if (activeCount > 0) parts.push(`${activeCount} active challenge(s)`);
          message += parts.join(' and ') + '. Complete or cancel them before withdrawing.';
          
          return {
            eligible: false,
            reason: message,
            warnings,
          };
        }
      } else {
        const pendingCount = activeChallenges.filter((c: any) => c.status === 'pending').length;
        const activeCount = activeChallenges.filter((c: any) => c.status === 'accepted' || c.status === 'active').length;
        
        let message = 'You have ';
        const parts = [];
        if (pendingCount > 0) parts.push(`${pendingCount} pending challenge(s)`);
        if (activeCount > 0) parts.push(`${activeCount} active challenge(s)`);
        message += parts.join(' and ') + '. Complete or cancel them before withdrawing.';
        
        return {
          eligible: false,
          reason: message,
          warnings,
        };
      }
    }
  }

  // Check pending withdrawals
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ['pending', 'approved', 'processing'] },
  });

  if (pendingWithdrawals > 0) {
    warnings.push(`You have ${pendingWithdrawals} pending withdrawal request(s)`);
  }

  return {
    eligible: true,
    reason: 'Eligible for withdrawal',
    warnings,
  };
}

