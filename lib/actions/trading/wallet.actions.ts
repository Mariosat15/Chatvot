'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import mongoose from 'mongoose';

// Get or create user's credit wallet
export const getOrCreateWallet = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    // Try to find existing wallet
    let wallet = await CreditWallet.findOne({ userId: session.user.id });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await CreditWallet.create({
        userId: session.user.id,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        isActive: true,
        kycVerified: false,
        withdrawalEnabled: false,
      });
      
      console.log(`✅ Created new wallet for user ${session.user.id}`);
    }

    return JSON.parse(JSON.stringify(wallet));
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting/creating wallet:', error);
    throw new Error('Failed to get wallet');
  }
};

// Get wallet balance
export const getWalletBalance = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    const wallet = await CreditWallet.findOne({ userId: session.user.id });
    
    if (!wallet) {
      return { balance: 0, isActive: false };
    }

    return {
      balance: wallet.creditBalance,
      isActive: wallet.isActive,
      kycVerified: wallet.kycVerified,
      withdrawalEnabled: wallet.withdrawalEnabled,
    };
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting wallet balance:', error);
    throw new Error('Failed to get balance');
  }
};

// Get wallet transaction history
export const getWalletTransactions = async (limit: number = 50) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    const transactions = await WalletTransaction.find({
      userId: session.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return JSON.parse(JSON.stringify(transactions));
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting transactions:', error);
    throw new Error('Failed to get transactions');
  }
};

// Create a pending deposit transaction (called before Stripe payment)
export const initiateDeposit = async (amount: number, currency: string = 'EUR') => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    // ✅ CHECK USER RESTRICTIONS
    console.log(`🔐 Checking deposit restrictions for user ${session.user.id}`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'deposit');
    
    console.log(`   Restriction check result:`, restrictionCheck);
    
    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Deposit blocked due to restrictions`);
      throw new Error(restrictionCheck.reason || 'You are not allowed to deposit');
    }
    
    console.log(`   ✅ User allowed to deposit`);

    // Validate amount
    if (amount <= 0 || amount > 10000) {
      throw new Error('Invalid amount (min: €0.01, max: €10,000)');
    }

    const wallet = await getOrCreateWallet();

    // Get centralized fee settings (for tracking platform earnings)
    const CreditConversionSettings = (await import('@/database/models/credit-conversion-settings.model')).default;
    const feeSettings = await CreditConversionSettings.getSingleton();
    
    // Platform deposit fee (charged to card, NOT deducted from credits)
    const platformDepositFeePercentage = feeSettings.platformDepositFeePercentage || 0;
    
    // Bank fees (what Stripe charges us) - for tracking purposes
    const bankDepositFeePercentage = feeSettings.bankDepositFeePercentage || 2.9;
    const bankDepositFeeFixed = feeSettings.bankDepositFeeFixed || 0.30;
    
    // User receives FULL credits (fees are charged to their card, not deducted)
    const creditsToReceive = amount; // 1 EUR = 1 Credit - FULL amount
    const platformFeeAmount = (amount * platformDepositFeePercentage) / 100;
    
    // Calculate bank fees (what Stripe takes from the total charged)
    const totalCharged = amount + platformFeeAmount; // This is charged to card (without VAT for now, VAT added in frontend)
    const bankFeePercentage = (totalCharged * bankDepositFeePercentage) / 100;
    const bankFeeTotal = bankFeePercentage + bankDepositFeeFixed;
    
    // Net platform earnings = Platform fee charged to user - Bank fee we pay
    const netPlatformEarning = platformFeeAmount - bankFeeTotal;

    console.log(`💰 Deposit calculation (fees charged to card):`);
    console.log(`   Credits Value: €${amount}`);
    console.log(`   Credits to User: ${creditsToReceive} (FULL - fees charged to card)`);
    console.log(`   Platform Fee (${platformDepositFeePercentage}%): +€${platformFeeAmount.toFixed(2)} charged to card`);
    console.log(`   Bank Fee (${bankDepositFeePercentage}% + €${bankDepositFeeFixed}): €${bankFeeTotal.toFixed(2)}`);
    console.log(`   Net Platform Earning: €${netPlatformEarning.toFixed(2)}`);

    // Create pending transaction with FULL credits
    // Note: Total charged will be updated when payment intent is created (includes VAT)
    const transaction = await WalletTransaction.create({
      userId: session.user.id,
      transactionType: 'deposit',
      amount: creditsToReceive, // User receives FULL credits
      balanceBefore: wallet.creditBalance,
      balanceAfter: wallet.creditBalance + creditsToReceive,
      currency: currency,
      exchangeRate: 1, // 1 EUR = 1 Credit
      status: 'pending',
      description: `Purchase of ${creditsToReceive} credits`, // Updated with fees when charged
      metadata: {
        eurAmount: amount, // Base credits value
        creditsReceived: creditsToReceive,
        // Platform fees (charged to card)
        platformDepositFeePercentage: platformDepositFeePercentage,
        platformFeeAmount: parseFloat(platformFeeAmount.toFixed(2)),
        // Bank fees
        bankDepositFeePercentage: bankDepositFeePercentage,
        bankDepositFeeFixed: bankDepositFeeFixed,
        bankFeeTotal: parseFloat(bankFeeTotal.toFixed(2)),
        // Net calculations
        netPlatformEarning: parseFloat(netPlatformEarning.toFixed(2)),
        paymentProvider: 'stripe',
      },
    });

    return JSON.parse(JSON.stringify(transaction));
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error initiating deposit:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to initiate deposit');
  }
};

// Complete a deposit after successful Stripe payment
export const completeDeposit = async (transactionId: string, paymentId: string, paymentMethod: string) => {
  try {
    await connectToDatabase();

    // Start MongoDB transaction for ACID compliance
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Get transaction
      const transaction = await WalletTransaction.findById(transactionId).session(mongoSession);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'pending') {
        throw new Error('Transaction already processed');
      }

      // User receives FULL credits (fees were charged to card, not deducted)
      const creditsToAdd = transaction.amount; // Full credits amount
      const eurAmount = transaction.metadata?.eurAmount || transaction.amount;
      
      // Update wallet balance - user receives FULL credits
      await CreditWallet.findOneAndUpdate(
        { userId: transaction.userId },
        {
          $inc: {
            creditBalance: creditsToAdd, // Add FULL credits (fees charged to card)
            totalDeposited: eurAmount, // Track base EUR deposited (not including fees)
          },
        },
        { session: mongoSession }
      );

      // Update transaction
      transaction.status = 'completed';
      transaction.paymentId = paymentId;
      transaction.paymentMethod = paymentMethod;
      transaction.processedAt = new Date();
      await transaction.save({ session: mongoSession });

      // Commit transaction
      await mongoSession.commitTransaction();

      // Get fee settings to calculate/verify fee amounts
      const CreditConversionSettings = (await import('@/database/models/credit-conversion-settings.model')).default;
      const feeSettings = await CreditConversionSettings.getSingleton();
      
      // Try to get fee from metadata first, otherwise calculate from current settings
      let platformFeeAmount = transaction.metadata?.platformFeeAmount;
      let bankFeeTotal = transaction.metadata?.bankFeeTotal;
      let platformDepositFeePercentage = transaction.metadata?.platformDepositFeePercentage;
      
      // If metadata doesn't have fees (old deposit), calculate from current settings
      if (platformFeeAmount === undefined || platformFeeAmount === null) {
        platformDepositFeePercentage = feeSettings.platformDepositFeePercentage || 0;
        platformFeeAmount = (eurAmount * platformDepositFeePercentage) / 100;
        
        const bankDepositFeePercentage = feeSettings.bankDepositFeePercentage || 2.9;
        const bankDepositFeeFixed = feeSettings.bankDepositFeeFixed || 0.30;
        bankFeeTotal = (eurAmount * bankDepositFeePercentage / 100) + bankDepositFeeFixed;
        
        console.log(`⚠️ Fee calculated from current settings (deposit had no fee metadata)`);
      }
      
      const netPlatformEarning = platformFeeAmount - bankFeeTotal;

      console.log(`✅ Purchase completed:`);
      console.log(`   EUR paid: €${eurAmount}`);
      console.log(`   Credits added: ${creditsToAdd} (after ${platformDepositFeePercentage}% fee)`);
      console.log(`   Platform Fee: €${platformFeeAmount.toFixed(2)}`);
      console.log(`   Bank Fee: €${bankFeeTotal.toFixed(2)}`);
      console.log(`   Net Platform Earning: €${netPlatformEarning.toFixed(2)}`);
      console.log(`   User: ${transaction.userId}`);

      // Record deposit fee in platform financials
      // Always record if there's a platform fee OR if we calculated one
      if (platformFeeAmount > 0) {
        try {
          const { PlatformFinancialsService } = await import('@/lib/services/platform-financials.service');
          console.log(`💵 Recording deposit fee to PlatformTransaction...`);
          await PlatformFinancialsService.recordDepositFee({
            userId: transaction.userId,
            depositAmount: eurAmount,
            platformFeeAmount: platformFeeAmount,
            bankFeeAmount: bankFeeTotal,
            netEarning: netPlatformEarning,
            transactionId: transaction._id.toString(),
          });
          console.log(`✅ Deposit fee recorded successfully`);
        } catch (error) {
          console.error('❌ Error recording deposit fee:', error);
        }
      } else {
        console.log(`ℹ️ No platform fee to record (fee is 0%)`);
      }

      // Evaluate badges for the user (fire and forget - don't wait)
      try {
        const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
        evaluateUserBadges(transaction.userId).then(result => {
          if (result.newBadges.length > 0) {
            console.log(`🏅 User earned ${result.newBadges.length} new badges after deposit`);
          }
        }).catch(err => console.error('Error evaluating badges:', err));
      } catch (error) {
        console.error('Error importing badge service:', error);
      }

      // Create and send invoice (fire and forget)
      try {
        const InvoiceSettings = (await import('@/database/models/invoice-settings.model')).default;
        const invoiceSettings = await InvoiceSettings.getSingleton();
        
        console.log(`📄 Invoice settings: sendInvoiceOnPurchase=${invoiceSettings.sendInvoiceOnPurchase}`);
        
        if (invoiceSettings.sendInvoiceOnPurchase) {
          const { InvoiceService } = await import('@/lib/services/invoice.service');
          const { inngest } = await import('@/lib/inngest/client');
          const { getUserById } = await import('@/lib/utils/user-lookup');
          
          // Get user info from database (not session, as this may be called from webhook)
          const userId = transaction.userId.toString();
          const user = await getUserById(userId);
          
          const customerName = user?.name || 'Customer';
          const customerEmail = user?.email || '';
          
          console.log(`📄 User for invoice: ${customerName} <${customerEmail}>`);
          
          if (customerEmail) {
            console.log(`📄 Creating invoice for deposit...`);
            
            // Get the actual VAT amount that was charged (VAT applies only to credits, not fee)
            const actualVatAmount = transaction.metadata?.vatAmount || 0;
            
            // Build line items - credits value is eurAmount (the full credits amount)
            // Fee is separate and not subject to VAT
            const invoiceLineItems = [
              {
                description: `Credit Purchase - ${creditsToAdd.toFixed(2)} Credits`,
                quantity: 1,
                unitPrice: eurAmount, // Full credits amount (VAT applies to this)
              }
            ];
            
            // Add platform fee as separate line item if present (not subject to VAT)
            if (platformFeeAmount > 0) {
              invoiceLineItems.push({
                description: 'Platform Processing Fee',
                quantity: 1,
                unitPrice: platformFeeAmount,
              });
            }
            
            console.log(`📄 Invoice line items: Credits €${eurAmount}, Fee €${platformFeeAmount}, VAT €${actualVatAmount}`);
            
            // Create invoice with actual VAT amount (VAT only on credits, not on fee)
            const { invoice } = await InvoiceService.createInvoice({
              userId: userId,
              customerName,
              customerEmail,
              transactionId: transaction._id.toString(),
              transactionType: 'deposit',
              paymentMethod: paymentMethod,
              paymentId: paymentId,
              lineItems: invoiceLineItems,
              currency: 'EUR',
              actualVatAmount: actualVatAmount, // Use actual VAT charged (only on credits)
            });
            
            console.log(`📄 Invoice ${invoice.invoiceNumber} created`);
            
            // Send invoice email via Inngest
            await inngest.send({
              name: 'app/invoice.created',
              data: {
                invoiceId: invoice._id.toString(),
                customerEmail,
                customerName,
                invoiceNumber: invoice.invoiceNumber,
              },
            });
            
            console.log(`📧 Invoice email queued for ${customerEmail}`);
          } else {
            console.log(`⚠️ No email found for user ${userId}, skipping invoice`);
          }
        } else {
          console.log(`ℹ️ Invoice sending disabled in settings`);
        }
      } catch (error) {
        console.error('❌ Error creating invoice:', error);
        // Don't throw - deposit already succeeded
      }

      // Send notification to user about successful deposit
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        
        // Get wallet balance for notification
        const wallet = await CreditWallet.findOne({ userId: transaction.userId });
        const newBalance = wallet?.creditBalance || creditsToAdd;
        
        await notificationService.notifyDepositCompleted(
          transaction.userId,
          eurAmount,
          newBalance
        );
        console.log(`🔔 Deposit notification sent to user ${transaction.userId}`);
      } catch (error) {
        console.error('❌ Error sending deposit notification:', error);
        // Don't throw - deposit already succeeded
      }

      revalidatePath('/wallet');

      return { success: true, transaction: JSON.parse(JSON.stringify(transaction)) };
    } catch (error) {
      // Rollback on error
      await mongoSession.abortTransaction();
      throw error;
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    console.error('Error completing deposit:', error);
    throw new Error('Failed to complete deposit');
  }
};

// Initiate withdrawal request (will be processed manually or via Stripe)
export const initiateWithdrawal = async (creditsAmount: number) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    // ✅ CHECK USER RESTRICTIONS
    console.log(`🔐 Checking withdrawal restrictions for user ${session.user.id}`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'withdraw');
    
    console.log(`   Restriction check result:`, restrictionCheck);
    
    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Withdrawal blocked due to restrictions`);
      throw new Error(restrictionCheck.reason || 'You are not allowed to withdraw');
    }
    
    console.log(`   ✅ User allowed to withdraw`);

    // Get conversion settings
    const CreditConversionSettings = (await import('@/database/models/credit-conversion-settings.model')).default;
    const conversionSettings = await CreditConversionSettings.getSingleton();
    const { 
      eurToCreditsRate, 
      minimumWithdrawal, 
      platformWithdrawalFeePercentage,
      bankWithdrawalFeePercentage,
      bankWithdrawalFeeFixed,
      withdrawalFeePercentage // fallback
    } = conversionSettings;
    
    // Use platform withdrawal fee (with fallback to legacy field)
    const actualPlatformFeePercentage = platformWithdrawalFeePercentage ?? withdrawalFeePercentage ?? 2;

    const wallet = await CreditWallet.findOne({ userId: session.user.id });
    if (!wallet) throw new Error('Wallet not found');

    // Validate KYC
    if (!wallet.kycVerified) {
      throw new Error('KYC verification required for withdrawals');
    }

    // Validate withdrawal enabled
    if (!wallet.withdrawalEnabled) {
      throw new Error('Withdrawals not enabled for this account');
    }

    // Validate amount
    if (creditsAmount <= 0) {
      throw new Error('Invalid amount');
    }

    // Calculate EUR gross amount
    const eurGross = creditsAmount / eurToCreditsRate;
    
    // Calculate platform withdrawal fee (what we charge user)
    const platformFeeAmountEUR = eurGross * (actualPlatformFeePercentage / 100);
    const feeAmountCredits = Math.ceil(platformFeeAmountEUR * eurToCreditsRate);
    
    // Calculate bank withdrawal fee (what bank charges us for payout)
    const bankFeePercentageAmount = eurGross * ((bankWithdrawalFeePercentage ?? 0.25) / 100);
    const bankFeeTotalEUR = bankFeePercentageAmount + (bankWithdrawalFeeFixed ?? 0.25);
    
    // Calculate net EUR user receives
    const eurNet = eurGross - platformFeeAmountEUR;
    
    // Calculate net platform earning from this withdrawal
    const netPlatformEarningEUR = platformFeeAmountEUR - bankFeeTotalEUR;
    
    // Total credits to deduct (withdrawal + fee)
    const totalCreditsDeducted = creditsAmount + feeAmountCredits;
    
    console.log(`💸 Withdrawal calculation:`);
    console.log(`   Credits: ${creditsAmount}`);
    console.log(`   EUR Gross: €${eurGross.toFixed(2)}`);
    console.log(`   Platform Fee (${actualPlatformFeePercentage}%): €${platformFeeAmountEUR.toFixed(2)}`);
    console.log(`   Bank Fee (${bankWithdrawalFeePercentage ?? 0.25}% + €${bankWithdrawalFeeFixed ?? 0.25}): €${bankFeeTotalEUR.toFixed(2)}`);
    console.log(`   Net to User: €${eurNet.toFixed(2)}`);
    console.log(`   Net Platform Earning: €${netPlatformEarningEUR.toFixed(2)}`);

    // Validate sufficient balance for withdrawal + fee
    if (totalCreditsDeducted > wallet.creditBalance) {
      throw new Error(`Insufficient balance. Need ${totalCreditsDeducted} Credits (${creditsAmount} + ${feeAmountCredits} fee), but you have ${wallet.creditBalance} Credits`);
    }

    // Minimum withdrawal check
    const minCredits = minimumWithdrawal * eurToCreditsRate;
    if (creditsAmount < minCredits) {
      throw new Error(`Minimum withdrawal is ${minCredits} Credits (€${minimumWithdrawal})`);
    }

    // Start MongoDB transaction
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Deduct credits + fee from wallet
      await CreditWallet.findOneAndUpdate(
        { userId: session.user.id },
        {
          $inc: {
            creditBalance: -totalCreditsDeducted,
            totalWithdrawn: creditsAmount, // Track only the withdrawal amount, not fee
          },
        },
        { session: mongoSession }
      );

      // Create withdrawal transaction (for the amount user requested)
      const withdrawalTransaction = await WalletTransaction.create(
        [
          {
            userId: session.user.id,
            transactionType: 'withdrawal',
            amount: -creditsAmount,
            balanceBefore: wallet.creditBalance,
            balanceAfter: wallet.creditBalance - totalCreditsDeducted,
            currency: 'EUR',
            exchangeRate: eurToCreditsRate,
            status: 'pending',
            description: `Withdrawal of ${creditsAmount} Credits (€${eurNet.toFixed(2)} net)`,
            metadata: {
              creditsAmount,
              eurGross: eurGross.toFixed(2),
              eurNet: eurNet.toFixed(2),
              // Platform fees
              platformFeePercentage: actualPlatformFeePercentage,
              platformFeeAmountEUR: parseFloat(platformFeeAmountEUR.toFixed(2)),
              feeAmountCredits,
              // Bank fees
              bankFeePercentage: bankWithdrawalFeePercentage ?? 0.25,
              bankFeeFixed: bankWithdrawalFeeFixed ?? 0.25,
              bankFeeTotalEUR: parseFloat(bankFeeTotalEUR.toFixed(2)),
              // Net calculations
              netPlatformEarningEUR: parseFloat(netPlatformEarningEUR.toFixed(2)),
              totalCreditsDeducted,
            },
          },
        ],
        { session: mongoSession }
      );

      // Create separate transaction record for the withdrawal fee (platform revenue)
      await WalletTransaction.create(
        [
          {
            userId: session.user.id,
            transactionType: 'withdrawal_fee',
            amount: -feeAmountCredits,
            balanceBefore: wallet.creditBalance - creditsAmount,
            balanceAfter: wallet.creditBalance - totalCreditsDeducted,
            currency: 'EUR',
            exchangeRate: eurToCreditsRate,
            status: 'completed',
            description: `Withdrawal fee (${actualPlatformFeePercentage}%) for ${creditsAmount} Credits`,
            metadata: {
              withdrawalTransactionId: withdrawalTransaction[0]._id,
              platformFeePercentage: actualPlatformFeePercentage,
              creditsCharged: feeAmountCredits,
              eurValue: platformFeeAmountEUR.toFixed(2),
              bankFeeEUR: bankFeeTotalEUR.toFixed(2),
              netPlatformEarningEUR: netPlatformEarningEUR.toFixed(2),
            },
          },
        ],
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();

      console.log(`💸 Withdrawal initiated: ${creditsAmount} Credits (€${eurNet.toFixed(2)} net) for user ${session.user.id}, fee: ${feeAmountCredits} Credits`);
      
      // Send withdrawal initiated notification
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        await notificationService.notifyWithdrawalInitiated(session.user.id, eurNet);
      } catch (notifError) {
        console.error('Error sending withdrawal notification:', notifError);
      }
      
      // Record withdrawal fee in platform financials (fire and forget)
      if (platformFeeAmountEUR > 0) {
        try {
          const { PlatformFinancialsService } = await import('@/lib/services/platform-financials.service');
          await PlatformFinancialsService.recordWithdrawalFee({
            userId: session.user.id,
            withdrawalAmount: eurGross,
            platformFeeAmount: platformFeeAmountEUR,
            bankFeeAmount: bankFeeTotalEUR,
            netEarning: netPlatformEarningEUR,
            transactionId: withdrawalTransaction[0]._id.toString(),
          });
        } catch (error) {
          console.error('Error recording withdrawal fee:', error);
        }
      }

      revalidatePath('/wallet');

      return {
        success: true,
        message: `Withdrawal request submitted. You will receive €${eurNet.toFixed(2)}`,
        transaction: JSON.parse(JSON.stringify(withdrawalTransaction[0])),
        breakdown: {
          creditsWithdrawn: creditsAmount,
          feeCredits: feeAmountCredits,
          totalDeducted: totalCreditsDeducted,
          eurGross: eurGross.toFixed(2),
          eurFee: feeAmountEUR.toFixed(2),
          eurNet: eurNet.toFixed(2),
        },
      };
    } catch (error) {
      await mongoSession.abortTransaction();
      throw error;
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error initiating withdrawal:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to initiate withdrawal');
  }
};

// Cancel a pending deposit (payment failed, canceled, or expired)
export const cancelDeposit = async (
  transactionId: string, 
  status: 'failed' | 'cancelled' | 'expired' = 'cancelled',
  reason?: string
) => {
  try {
    await connectToDatabase();

    // Find and update the transaction
    const transaction = await WalletTransaction.findById(transactionId);
    
    if (!transaction) {
      console.log(`⚠️ Transaction ${transactionId} not found for cancellation`);
      return { success: false, error: 'Transaction not found' };
    }

    if (transaction.status !== 'pending') {
      console.log(`⚠️ Transaction ${transactionId} is not pending (status: ${transaction.status})`);
      return { success: false, error: 'Transaction already processed' };
    }

    // Update transaction status
    transaction.status = status;
    transaction.processedAt = new Date();
    transaction.description = `${transaction.description} - ${reason || status}`;
    await transaction.save();

    console.log(`✅ Deposit cancelled/failed:`);
    console.log(`   Transaction: ${transactionId}`);
    console.log(`   Status: ${status}`);
    console.log(`   Reason: ${reason || 'N/A'}`);

    return { success: true, transaction: JSON.parse(JSON.stringify(transaction)) };
  } catch (error) {
    console.error('Error cancelling deposit:', error);
    return { success: false, error: 'Failed to cancel deposit' };
  }
};

// Get wallet statistics
export const getWalletStats = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    const wallet = await CreditWallet.findOne({ userId: session.user.id });
    
    if (!wallet) {
      return {
        currentBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        totalSpentOnChallenges: 0,
        totalWonFromChallenges: 0,
        netProfitFromCompetitions: 0,
        netProfitFromChallenges: 0,
        roi: 0,
      };
    }

    const netProfitCompetitions = wallet.totalWonFromCompetitions - wallet.totalSpentOnCompetitions;
    const netProfitChallenges = (wallet.totalWonFromChallenges || 0) - (wallet.totalSpentOnChallenges || 0);
    const totalSpent = wallet.totalSpentOnCompetitions + (wallet.totalSpentOnChallenges || 0);
    const roi = totalSpent > 0
      ? ((netProfitCompetitions + netProfitChallenges) / totalSpent) * 100
      : 0;

    return {
      currentBalance: wallet.creditBalance,
      totalDeposited: wallet.totalDeposited,
      totalWithdrawn: wallet.totalWithdrawn,
      totalSpentOnCompetitions: wallet.totalSpentOnCompetitions,
      totalWonFromCompetitions: wallet.totalWonFromCompetitions,
      totalSpentOnChallenges: wallet.totalSpentOnChallenges || 0,
      totalWonFromChallenges: wallet.totalWonFromChallenges || 0,
      netProfitFromCompetitions: netProfitCompetitions,
      netProfitFromChallenges: netProfitChallenges,
      roi: roi,
      kycVerified: wallet.kycVerified,
      withdrawalEnabled: wallet.withdrawalEnabled,
    };
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting wallet stats:', error);
    throw new Error('Failed to get wallet stats');
  }
};

