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

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    await connectToDatabase();

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

    // STEP 1: Create pending transaction FIRST to get its ID
    const pendingTransaction = await WalletTransaction.create({
      userId,
      walletId: wallet._id,
      type: 'deposit',
      amount,
      currency,
      status: 'pending',
      provider: 'nuvei',
      metadata: {
        initiatedAt: new Date().toISOString(),
      },
    });

    // STEP 2: Generate clientUniqueId using transaction ID (max 45 chars for Nuvei)
    // Format: txn_[24charTransactionId] = 4 + 24 = 28 chars
    const clientUniqueId = `txn_${pendingTransaction._id.toString()}`;
    
    // Get webhook URL for DMN notifications
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const notificationUrl = `${origin}/api/nuvei/webhook`;

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

    // Get client config for frontend
    const clientConfig = await nuveiService.getClientConfig();

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      orderId: result.orderId,
      clientUniqueId,
      config: clientConfig,
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

