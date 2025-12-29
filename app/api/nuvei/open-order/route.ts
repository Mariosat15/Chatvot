/**
 * Nuvei Open Order API
 * Server-side endpoint to create a session token for Nuvei Web SDK
 * 
 * POST /api/nuvei/open-order
 * Body: { amount: number, currency: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

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
    const { amount, currency = 'EUR' } = body;

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
    // Only block if there's a very recent pending transaction (last 5 seconds)
    // This prevents rapid double-clicks while allowing legitimate retries
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
    // These are likely abandoned sessions
    const oldPending = await WalletTransaction.updateMany(
      {
        userId,
        status: 'pending',
        provider: 'nuvei',
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }, // Older than 30 minutes
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

    // Get current balance for transaction record
    const currentBalance = wallet.creditBalance || 0;

    // STEP 1: Create pending transaction FIRST to get its ID
    const pendingTransaction = await WalletTransaction.create({
      userId,
      transactionType: 'deposit',
      amount,
      currency,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance, // Will be updated when completed
      status: 'pending',
      provider: 'nuvei', // Payment provider
      paymentMethod: 'card', // Payment method (card, etc.)
      description: `Nuvei deposit of ${amount} ${currency}`,
      metadata: {
        walletId: wallet._id.toString(),
        initiatedAt: new Date().toISOString(),
        paymentProvider: 'nuvei', // Also in metadata for backwards compatibility
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
    const result = await nuveiService.openOrder({
      amount: amount.toFixed(2),
      currency,
      clientUniqueId,
      userEmail: session.user.email || '',
      userCountry: 'US', // Will be overwritten by Nuvei if available
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

    // STEP 4: Update transaction with Nuvei response data
    await WalletTransaction.findByIdAndUpdate(pendingTransaction._id, {
      providerTransactionId: result.orderId,
      metadata: {
        sessionToken: result.sessionToken,
        clientUniqueId,
        orderId: result.orderId,
        nuveiMerchantId: result.merchantId,
        nuveiSiteId: result.merchantSiteId,
      },
    });

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      orderId: result.orderId,
      clientUniqueId,
      config: clientConfig,
      userEmail: session.user.email || '',
    });
  } catch (error) {
    console.error('Nuvei open order error:', error);
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

