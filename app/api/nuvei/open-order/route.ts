/**
 * Nuvei Open Order API
 * Server-side endpoint to create a session token for Nuvei Web SDK
 * 
 * POST /api/nuvei/open-order
 * Body: { amount: number, currency: string, vatAmount, platformFeeAmount, etc. }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import KYCSettings from '@/database/models/kyc-settings.model';
import { RateLimiters, getRateLimitHeaders } from '@/lib/utils/rate-limiter';
import { createSecurityLogger } from '@/lib/utils/security-logger';

export async function POST(req: NextRequest) {
  // SECURITY: Create logger for this request
  const securityLogger = createSecurityLogger(req);
  
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      await securityLogger.log({ statusCode: 401, success: false, errorMessage: 'Not authenticated' });
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // SECURITY: Rate limiting - 5 deposit attempts per minute per user
    const rateLimitResult = RateLimiters.deposit(userId);
    if (!rateLimitResult.success) {
      console.log(`🛡️ Rate limit exceeded for user ${userId} - deposit`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    await connectToDatabase();

    // Check if KYC is required for deposits
    const kycSettings = await KYCSettings.findOne();
    if (kycSettings?.enabled && kycSettings?.requiredForDeposit) {
      const wallet = await CreditWallet.findOne({ userId });
      if (!wallet?.kycVerified) {
        console.log(`🛡️ KYC required for deposit - user ${userId} not verified`);
        return NextResponse.json(
          { error: 'KYC verification required before depositing. Please complete identity verification first.' },
          { status: 403 }
        );
      }
    }

    // ✅ CHECK USER RESTRICTIONS - Blocked users cannot deposit
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(userId, 'deposit');
    
    if (!restrictionCheck.allowed) {
      console.log(`❌ Deposit blocked for user ${userId}: ${restrictionCheck.reason}`);
      await securityLogger.log({ statusCode: 403, success: false, errorMessage: 'User restricted from deposits' });
      return NextResponse.json(
        { error: restrictionCheck.reason || 'Your account is restricted and cannot make deposits. Please contact support.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      amount, // Total amount to charge (includes VAT + platform fee)
      currency = 'EUR',
      // Fee breakdown from client (same as Stripe)
      baseAmount, // Credits value (what user receives)
      vatAmount = 0,
      vatPercentage = 0,
      platformFeeAmount = 0,
      platformFeePercentage = 0,
    } = body;

    // SECURITY: Strict amount validation
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }
    
    // SECURITY: Minimum deposit (10 EUR)
    if (amountNum < 10) {
      return NextResponse.json(
        { error: 'Minimum deposit is €10' },
        { status: 400 }
      );
    }
    
    // SECURITY: Maximum deposit (10,000 EUR) to prevent money laundering
    if (amountNum > 10000) {
      return NextResponse.json(
        { error: 'Maximum deposit is €10,000' },
        { status: 400 }
      );
    }
    
    // SECURITY: Validate currency
    const allowedCurrencies = ['EUR', 'USD', 'GBP'];
    if (!allowedCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid currency' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    
    // SECURITY: Check for recent pending transactions to prevent duplicate orders
    const recentPending = await WalletTransaction.findOne({
      userId,
      status: 'pending',
      provider: 'nuvei',
      createdAt: { $gte: new Date(Date.now() - 5000) }, // Last 5 seconds only
    });
    
    if (recentPending) {
      console.log(`🛡️ Blocked duplicate order - recent pending: ${recentPending._id}`);
      return NextResponse.json(
        { error: 'Please wait a moment before trying again.' },
        { status: 429 }
      );
    }
    
    // Auto-cancel any OLD pending Nuvei transactions (older than 30 minutes)
    const oldPending = await WalletTransaction.updateMany(
      {
        userId,
        status: 'pending',
        provider: 'nuvei',
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      {
        $set: {
          status: 'cancelled',
          failureReason: 'Session expired',
          processedAt: new Date(),
        },
      }
    );
    
    if (oldPending.modifiedCount > 0) {
      console.log(`🧹 Auto-cancelled ${oldPending.modifiedCount} old pending Nuvei transactions`);
    }

    // Ensure wallet exists
    let wallet = await CreditWallet.findOne({ userId });
    if (!wallet) {
      wallet = await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        totalSpentOnChallenges: 0,
        totalWonFromChallenges: 0,
        totalSpentOnMarketplace: 0,
        isActive: true,
      });
    }

    const currentBalance = wallet.creditBalance || 0;
    
    // Credits user will receive (base amount, not total charged)
    const creditsToReceive = baseAmount || amountNum;
    
    // Get fee settings for bank fee calculation (same as Stripe)
    const CreditConversionSettings = (await import('@/database/models/credit-conversion-settings.model')).default;
    const feeSettings = await CreditConversionSettings.getSingleton();
    
    const bankDepositFeePercentage = feeSettings.bankDepositFeePercentage || 2.9;
    const bankDepositFeeFixed = feeSettings.bankDepositFeeFixed || 0.30;
    const bankFeePercentage = (amountNum * bankDepositFeePercentage) / 100;
    const bankFeeTotal = bankFeePercentage + bankDepositFeeFixed;
    const netPlatformEarning = (platformFeeAmount || 0) - bankFeeTotal;

    // Build description (same format as Stripe)
    let txDescription = `${creditsToReceive} credits`;
    const feeParts = [];
    if (vatAmount && vatAmount > 0) feeParts.push(`VAT €${vatAmount.toFixed(2)}`);
    if (platformFeeAmount && platformFeeAmount > 0) feeParts.push(`Fee €${platformFeeAmount.toFixed(2)}`);
    if (feeParts.length > 0) {
      txDescription = `${creditsToReceive} credits (Total paid: €${amountNum.toFixed(2)} incl. ${feeParts.join(', ')})`;
    }

    console.log(`💰 Nuvei Deposit calculation:`);
    console.log(`   Credits Value: €${creditsToReceive}`);
    console.log(`   Total Charged: €${amountNum}`);
    console.log(`   VAT (${vatPercentage}%): €${vatAmount}`);
    console.log(`   Platform Fee (${platformFeePercentage}%): €${platformFeeAmount}`);
    console.log(`   Bank Fee: €${bankFeeTotal.toFixed(2)}`);
    console.log(`   Net Platform Earning: €${netPlatformEarning.toFixed(2)}`);

    // STEP 1: Create pending transaction with full fee metadata (like Stripe)
    const pendingTransaction = await WalletTransaction.create({
      userId,
      transactionType: 'deposit',
      amount: creditsToReceive, // Credits user will receive (not total charged)
      currency,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + creditsToReceive,
      status: 'pending',
      provider: 'nuvei',
      paymentMethod: 'card',
      description: txDescription,
      metadata: {
        walletId: wallet._id.toString(),
        initiatedAt: new Date().toISOString(),
        paymentProvider: 'nuvei',
        // Same metadata as Stripe for financial tracking
        eurAmount: creditsToReceive,
        creditsReceived: creditsToReceive,
        totalCharged: amountNum,
        // VAT info
        vatAmount: vatAmount || 0,
        vatPercentage: vatPercentage || 0,
        // Platform fees
        platformDepositFeePercentage: platformFeePercentage || 0,
        platformFeeAmount: platformFeeAmount || 0,
        // Bank fees
        bankDepositFeePercentage: bankDepositFeePercentage,
        bankDepositFeeFixed: bankDepositFeeFixed,
        bankFeeTotal: parseFloat(bankFeeTotal.toFixed(2)),
        // Net calculations
        netPlatformEarning: parseFloat(netPlatformEarning.toFixed(2)),
      },
    });

    // STEP 2: Generate clientUniqueId using transaction ID (max 45 chars for Nuvei)
    // Format: txn_[24charTransactionId] = 4 + 24 = 28 chars
    const clientUniqueId = `txn_${pendingTransaction._id.toString()}`;
    
    // Get webhook URL for DMN notifications (prefer stored DMN URL from admin config)
    const clientConfig = await nuveiService.getClientConfig();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    // Use DMN URL from credentials if available, otherwise fallback to origin-based URL
    const storedDmnUrl = process.env.NUVEI_DMN_URL;
    const notificationUrl = storedDmnUrl || `${origin}/api/nuvei/webhook`;

    // STEP 3: Create order session with Nuvei
    // CRITICAL: Include userTokenId to enable UPO (User Payment Option) storage for future refunds
    // Note: Don't specify userCountry - let Nuvei determine from card BIN for proper 3DS handling
    const userTokenId = `user_${userId}`;
    const result = await nuveiService.openOrder({
      amount: amount.toFixed(2),
      currency,
      clientUniqueId,
      userEmail: session.user.email || '',
      // CRITICAL: userTokenId is required for UPO storage - without this, UPOs won't be saved
      userTokenId,
      // Let Nuvei determine country from card for proper 3DS2 compliance
      notificationUrl,
    });

    if ('error' in result) {
      // Delete the pending transaction if Nuvei call failed
      await WalletTransaction.findByIdAndDelete(pendingTransaction._id);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // STEP 4: Update transaction with Nuvei response data (use $set with dot notation to PRESERVE fee metadata)
    await WalletTransaction.findByIdAndUpdate(pendingTransaction._id, {
      $set: {
        providerTransactionId: result.orderId,
        'metadata.sessionToken': result.sessionToken,
        'metadata.clientUniqueId': clientUniqueId,
        'metadata.orderId': result.orderId,
        'metadata.nuveiMerchantId': result.merchantId,
        'metadata.nuveiSiteId': result.merchantSiteId,
      },
    });

    // SECURITY: Log successful deposit initiation
    await securityLogger.log({
      userId,
      userEmail: session.user.email,
      body: { amount: amountNum, currency, transactionId: pendingTransaction._id },
      statusCode: 200,
      success: true,
    });

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      orderId: result.orderId,
      clientUniqueId,
      // CRITICAL: Pass userTokenId to frontend for createPayment - required for UPO storage
      userTokenId,
      config: clientConfig,
      userEmail: session.user.email || '',
    });
  } catch (error) {
    console.error('Nuvei open order error:', error);
    
    // SECURITY: Log failed deposit initiation
    await securityLogger.log({
      statusCode: 500,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      { error: 'Failed to create payment session' },
      { status: 500 }
    );
  }
}

// Get Nuvei client config
export async function GET() {
  try {
    const clientConfig = await nuveiService.getClientConfig();
    return NextResponse.json(clientConfig);
  } catch (error) {
    console.error('Nuvei config error:', error);
    return NextResponse.json(
      { enabled: false, error: 'Failed to get Nuvei config' },
      { status: 500 }
    );
  }
}

