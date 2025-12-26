import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getPaddleConfig, paddleRequest, getPaddleApiUrl } from '@/lib/paddle/config';
import { initiateDeposit } from '@/lib/actions/trading/wallet.actions';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { connectToDatabase } from '@/database/mongoose';

/**
 * Create Paddle Checkout Session
 * 
 * Paddle is simpler than Stripe:
 * - No webhook configuration needed (auto-configured)
 * - Handles taxes automatically
 * - Handles refunds and chargebacks
 */

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, currency = 'EUR' } = await req.json();

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return NextResponse.json({ error: 'Invalid amount (min: €1)' }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: 'Maximum deposit is €10,000' }, { status: 400 });
    }

    // Check Paddle configuration
    const paddleConfig = await getPaddleConfig();
    if (!paddleConfig) {
      return NextResponse.json(
        { error: 'Paddle is not configured. Contact administrator.' },
        { status: 400 }
      );
    }

    // Create pending transaction in database
    const transaction = await initiateDeposit(amount, currency);

    // Create Paddle transaction
    // Using Paddle Billing API (v2)
    const paddleTransaction = await paddleRequest<any>('/transactions', {
      method: 'POST',
      body: {
        items: [
          {
            price: {
              description: `${amount} Credits for Trading Platform`,
              name: `${amount} Credits`,
              unit_price: {
                amount: Math.round(amount * 100).toString(), // Paddle uses minor units
                currency_code: currency.toUpperCase(),
              },
              product_id: process.env.PADDLE_PRODUCT_ID || undefined, // Optional: use default product
            },
            quantity: 1,
          },
        ],
        customer: {
          email: session.user.email,
        },
        custom_data: {
          user_id: session.user.id,
          transaction_id: transaction._id.toString(),
          type: 'deposit',
          amount: amount.toString(),
        },
        currency_code: currency.toUpperCase(),
      },
    });

    // Update transaction with Paddle transaction ID
    await connectToDatabase();
    await WalletTransaction.findByIdAndUpdate(transaction._id, {
      paymentIntentId: paddleTransaction.data.id,
      'metadata.paddleTransactionId': paddleTransaction.data.id,
      'metadata.provider': 'paddle',
    });

    console.log(`✅ Paddle transaction created: ${paddleTransaction.data.id}`);
    console.log(`   Amount: €${amount}`);
    console.log(`   User: ${session.user.email}`);

    // Return checkout URL for redirect
    // Paddle provides a hosted checkout page
    const checkoutUrl = paddleTransaction.data.checkout?.url;

    return NextResponse.json({
      success: true,
      transactionId: transaction._id.toString(),
      paddleTransactionId: paddleTransaction.data.id,
      checkoutUrl: checkoutUrl,
      // For inline checkout (Paddle.js)
      clientToken: paddleConfig.publicKey,
      environment: paddleConfig.environment,
    });
  } catch (error) {
    console.error('Error creating Paddle checkout:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout' },
      { status: 500 }
    );
  }
}

