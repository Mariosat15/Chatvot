import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getStripeClient, eurToCents, STRIPE_CONFIG } from '@/lib/stripe/config';
import { initiateDeposit } from '@/lib/actions/trading/wallet.actions';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { connectToDatabase } from '@/database/mongoose';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get amount from request (amount = base credits, totalAmount = with VAT + platform fee)
    const { 
      amount, 
      totalAmount, 
      vatAmount, 
      vatPercentage, 
      platformFeeAmount, 
      platformFeePercentage 
    } = await req.json();

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (amount < STRIPE_CONFIG.minimumDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit is €${STRIPE_CONFIG.minimumDeposit}` },
        { status: 400 }
      );
    }

    if (amount > STRIPE_CONFIG.maximumDeposit) {
      return NextResponse.json(
        { error: `Maximum deposit is €${STRIPE_CONFIG.maximumDeposit}` },
        { status: 400 }
      );
    }

    // Charge amount is totalAmount (including VAT + platform fee) or just amount if no fees
    const chargeAmount = totalAmount && typeof totalAmount === 'number' ? totalAmount : amount;

    // Create pending transaction in database (base amount for credits calculation)
    // User receives FULL credits based on base amount (fees charged to card)
    const transaction = await initiateDeposit(amount, STRIPE_CONFIG.currency.toUpperCase());

    // Get Stripe client with database credentials
    const stripe = await getStripeClient();

    // Build description
    let description = `Purchase of €${amount} credits`;
    const feeDetails = [];
    if (vatAmount && vatAmount > 0) feeDetails.push(`VAT €${vatAmount.toFixed(2)}`);
    if (platformFeeAmount && platformFeeAmount > 0) feeDetails.push(`Platform Fee €${platformFeeAmount.toFixed(2)}`);
    if (feeDetails.length > 0) description += ` + ${feeDetails.join(' + ')}`;

    // Create Stripe Payment Intent - FORCE CARD ONLY (no Link, wallets, or saved methods)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: eurToCents(chargeAmount), // Charge total including VAT + platform fee
      currency: STRIPE_CONFIG.currency,
      // Force manual card input only - required for fraud detection
      payment_method_types: ['card'],
      // Disable automatic payment methods to prevent Link and other saved methods
      automatic_payment_methods: undefined,
      metadata: {
        userId: session.user.id,
        transactionId: transaction._id.toString(),
        type: 'deposit',
        baseAmount: amount.toString(), // Credits value (user receives full)
        vatAmount: (vatAmount || 0).toString(),
        vatPercentage: (vatPercentage || 0).toString(),
        platformFeeAmount: (platformFeeAmount || 0).toString(),
        platformFeePercentage: (platformFeePercentage || 0).toString(),
        totalAmount: chargeAmount.toString(),
      },
      description,
    });

    // Update transaction with payment intent ID, fee info, and accurate description
    await connectToDatabase();
    
    // Build accurate description showing actual total charged
    let txDescription = `Purchase of ${amount} credits`;
    const feeParts = [];
    if (vatAmount && vatAmount > 0) feeParts.push(`VAT €${vatAmount.toFixed(2)}`);
    if (platformFeeAmount && platformFeeAmount > 0) feeParts.push(`Fee €${platformFeeAmount.toFixed(2)}`);
    if (feeParts.length > 0) {
      txDescription = `${amount} credits (Total paid: €${chargeAmount.toFixed(2)} incl. ${feeParts.join(', ')})`;
    }
    
    await WalletTransaction.findByIdAndUpdate(transaction._id, {
      paymentIntentId: paymentIntent.id,
      description: txDescription,
      'metadata.vatAmount': vatAmount || 0,
      'metadata.vatPercentage': vatPercentage || 0,
      'metadata.platformFeeAmount': platformFeeAmount || 0,
      'metadata.platformFeePercentage': platformFeePercentage || 0,
      'metadata.totalCharged': chargeAmount,
    });

    console.log(`✅ Payment Intent created: ${paymentIntent.id}`);
    console.log(`   Total charge: €${chargeAmount} (Credits: €${amount}, VAT: €${vatAmount || 0}, Platform Fee: €${platformFeeAmount || 0})`);

    // Send deposit initiated notification
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.notifyDepositInitiated(session.user.id, amount);
      console.log(`🔔 Deposit initiated notification sent to user ${session.user.id}`);
    } catch (notifError) {
      console.error('❌ Error sending deposit initiated notification:', notifError);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      },
      { status: 500 }
    );
  }
}

