import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe/config';
import { completeDeposit, cancelDeposit } from '@/lib/actions/trading/wallet.actions';
import { getPaymentProviderCredentials } from '@/lib/services/settings.service';
import { PaymentFraudService } from '@/lib/services/fraud/payment-fraud.service';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { connectToDatabase } from '@/database/mongoose';
import Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 * 
 * Handles DEPOSIT confirmations from Stripe.
 * When a user pays via Stripe, this webhook confirms the payment and adds credits.
 * 
 * WITHDRAWALS are handled manually by admin (not via Stripe).
 * 
 * Required Stripe Events in Dashboard:
 * - payment_intent.succeeded (REQUIRED - adds credits when user pays)
 * - payment_intent.payment_failed (optional - marks failed deposits)
 * - payment_intent.canceled (optional - handles abandoned payments)
 * - charge.refunded (optional - for tracking refunds)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('❌ No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Get Stripe client and webhook secret
    const stripe = await getStripeClient();
    
    // Try database config first, then .env
    const stripeConfig = await getPaymentProviderCredentials('stripe') as any;
    const webhookSecret = 
      stripeConfig?.webhook_secret || 
      process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log('🔐 Webhook secret source:', stripeConfig?.webhook_secret ? 'database' : (process.env.STRIPE_WEBHOOK_SECRET ? '.env' : 'NOT FOUND'));

    if (!webhookSecret) {
      console.error('❌ No Stripe webhook secret configured');
      console.error('   💡 Add webhook secret in Admin Panel → Payment Providers → Stripe → Configure');
      console.error('   💡 Or add STRIPE_WEBHOOK_SECRET=whsec_xxx to your .env file');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log(`📨 Stripe Webhook: ${event.type}`);

    // Handle deposit-related events
    switch (event.type) {
      // ==========================================
      // DEPOSIT EVENTS (user pays → gets credits)
      // ==========================================
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful payment - ADD CREDITS TO USER
 * Includes idempotency check to prevent duplicate processing
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId, userId } = paymentIntent.metadata;

    if (!transactionId || !userId) {
      console.error('❌ Missing metadata in payment intent:', paymentIntent.id);
      return;
    }

    // IDEMPOTENCY CHECK: Verify transaction hasn't already been processed
    // This prevents duplicate credits if Stripe sends the same webhook multiple times
    await connectToDatabase();
    
    // Check 1: By paymentId (Stripe payment intent ID)
    const existingByPaymentId = await WalletTransaction.findOne({
      paymentId: paymentIntent.id,
      status: 'completed',
    }).lean();
    
    if (existingByPaymentId) {
      console.log(`⚠️ IDEMPOTENCY: Payment ${paymentIntent.id} already processed (found by paymentId)`);
      console.log(`   Existing transaction: ${existingByPaymentId._id}`);
      return; // Already processed, skip
    }

    // Check 2: By transactionId and status
    const existingTransaction = await WalletTransaction.findById(transactionId).lean();
    
    if (!existingTransaction) {
      console.error(`❌ Transaction ${transactionId} not found in database`);
      return;
    }
    
    if (existingTransaction.status === 'completed') {
      console.log(`⚠️ IDEMPOTENCY: Transaction ${transactionId} already completed`);
      return; // Already processed, skip
    }

    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    console.log(`   Amount: €${paymentIntent.amount / 100}`);
    console.log(`   User: ${userId}`);
    console.log(`   Transaction: ${transactionId}`);

    // Fetch card details for future refund reference
    let cardDetails: {
      brand?: string;
      last4?: string;
      expMonth?: number;
      expYear?: number;
      country?: string;
      fingerprint?: string;
    } | undefined;

    const paymentMethodId = paymentIntent.payment_method;
    if (paymentMethodId && typeof paymentMethodId === 'string') {
      try {
        const stripe = await getStripeClient();
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
        if (paymentMethod.type === 'card' && paymentMethod.card) {
          cardDetails = {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            expMonth: paymentMethod.card.exp_month,
            expYear: paymentMethod.card.exp_year,
            country: paymentMethod.card.country || undefined,
            fingerprint: paymentMethod.card.fingerprint || undefined,
          };
          console.log(`   💳 Card: ${cardDetails.brand} ****${cardDetails.last4}`);
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch card details:', err);
      }
    }

    // Complete the deposit - this adds credits to user's wallet
    await completeDeposit(
      transactionId,
      paymentIntent.id,
      paymentIntent.payment_method_types[0] || 'card',
      cardDetails
    );

    console.log(`✅ Credits added for transaction ${transactionId}`);

    // Track for fraud detection
    await trackPaymentFingerprint(paymentIntent, userId);
  } catch (error) {
    console.error('❌ Error handling successful payment:', error);
  }
}

/**
 * Track payment fingerprint for fraud detection
 */
async function trackPaymentFingerprint(paymentIntent: Stripe.PaymentIntent, userId: string) {
  try {
    const stripe = await getStripeClient();
    const paymentMethodId = paymentIntent.payment_method;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return;
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.type !== 'card' || !paymentMethod.card) {
      return;
    }

    const cardFingerprint = paymentMethod.card.fingerprint;

    if (!cardFingerprint) {
      return;
    }

    console.log(`🔍 Tracking payment fingerprint: ${cardFingerprint.substring(0, 8)}...`);

    const result = await PaymentFraudService.trackPaymentFingerprint({
      userId,
      paymentProvider: 'stripe',
      paymentFingerprint: cardFingerprint,
      cardLast4: paymentMethod.card.last4,
      cardBrand: paymentMethod.card.brand,
      cardCountry: paymentMethod.card.country || undefined,
      cardFunding: paymentMethod.card.funding,
      providerAccountId: paymentMethodId,
      transactionId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });

    if (result.fraudDetected) {
      console.log(`🚨 FRAUD: Payment method shared across ${result.linkedUsers.length + 1} accounts!`);
    }
  } catch (error) {
    console.error('❌ Error tracking payment fingerprint:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId, userId } = paymentIntent.metadata;

    console.error(`❌ Payment failed: ${paymentIntent.id}`);
    console.error(`   Reason: ${paymentIntent.last_payment_error?.message}`);

    if (transactionId) {
      await cancelDeposit(transactionId, 'failed', paymentIntent.last_payment_error?.message || 'Payment failed');
    }

    // Notify user
    if (userId) {
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        await notificationService.notifyDepositFailed(
          userId,
          paymentIntent.amount / 100,
          paymentIntent.last_payment_error?.message || 'Payment could not be processed'
        );
      } catch (error) {
        console.error('❌ Error sending notification:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error handling failed payment:', error);
  }
}

/**
 * Handle canceled/expired payment
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId } = paymentIntent.metadata;

    console.log(`🚫 Payment canceled: ${paymentIntent.id}`);

    if (transactionId) {
      await cancelDeposit(transactionId, 'cancelled', 'Payment was canceled or expired');
    }
  } catch (error) {
    console.error('❌ Error handling canceled payment:', error);
  }
}

/**
 * Handle refunded charge (for tracking - admin handles refunds manually)
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    console.log(`💸 Charge refunded: ${charge.id}`);
    console.log(`   Amount: €${charge.amount_refunded / 100}`);
    
    // Log for audit - actual credit deduction should be done via admin panel
    // TODO: Optionally auto-deduct credits when refund is issued
  } catch (error) {
    console.error('❌ Error handling refund:', error);
  }
}
