/**
 * Nuvei Open Order API
 * Server-side endpoint to create a session token for Nuvei Web SDK
 * 
 * POST /api/nuvei/open-order
 * Body: { amount: number, currency: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import User from '@/database/models/user.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import Transaction from '@/database/models/trading/transaction.model';

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

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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

    // Generate unique transaction ID
    const clientUniqueId = `deposit_${userId}_${Date.now()}`;
    
    // Get webhook URL for DMN notifications
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
    const notificationUrl = `${origin}/api/nuvei/webhook`;

    // Create order session with Nuvei
    const result = await nuveiService.openOrder({
      amount: amount.toFixed(2),
      currency,
      clientUniqueId,
      userEmail: user.email,
      userCountry: user.country || 'US',
      notificationUrl,
    });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Create pending transaction record
    await Transaction.create({
      userId,
      walletId: wallet._id,
      type: 'deposit',
      amount,
      currency,
      status: 'pending',
      provider: 'nuvei',
      providerTransactionId: result.orderId,
      metadata: {
        sessionToken: result.sessionToken,
        clientUniqueId,
        orderId: result.orderId,
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

