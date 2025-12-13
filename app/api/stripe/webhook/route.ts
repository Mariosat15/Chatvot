import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe/config';
import { completeDeposit, cancelDeposit } from '@/lib/actions/trading/wallet.actions';
import { getPaymentProviderCredentials } from '@/lib/services/settings.service';
import { PaymentFraudService } from '@/lib/services/fraud/payment-fraud.service';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('❌ No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Get Stripe client and webhook secret from database
    const stripe = await getStripeClient();
    const stripeConfig = await getPaymentProviderCredentials('stripe') as any;
    const webhookSecret = stripeConfig?.webhook_secret || stripeConfig?.webhookUrl || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ No Stripe webhook secret configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log(`📨 Stripe Webhook Event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.expired' as string:
        await handlePaymentIntentCanceled((event as any).data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
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

// Handle successful payment
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId, userId } = paymentIntent.metadata;

    if (!transactionId || !userId) {
      console.error('❌ Missing metadata in payment intent:', paymentIntent.id);
      return;
    }

    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    console.log(`   Amount: €${paymentIntent.amount / 100}`);
    console.log(`   User: ${userId}`);
    console.log(`   Transaction: ${transactionId}`);

    // Complete the deposit in database
    await completeDeposit(
      transactionId,
      paymentIntent.id,
      paymentIntent.payment_method_types[0] || 'card'
    );

    console.log(`✅ Deposit completed for transaction ${transactionId}`);

    // FRAUD DETECTION: Track payment fingerprint
    await trackPaymentFingerprint(paymentIntent, userId);
  } catch (error) {
    console.error('❌ Error handling successful payment:', error);
  }
}

// Track payment fingerprint for fraud detection
async function trackPaymentFingerprint(paymentIntent: Stripe.PaymentIntent, userId: string) {
  try {
    // Get payment method details from Stripe
    const stripe = await getStripeClient();
    const paymentMethodId = paymentIntent.payment_method;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      console.log(`⚠️ No payment method ID found for fraud tracking`);
      return;
    }

    console.log(`💳 Retrieving payment method for fraud detection...`);
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.type !== 'card' || !paymentMethod.card) {
      console.log(`⚠️ Payment method is not a card, skipping fraud detection`);
      return;
    }

    // Extract card fingerprint (Stripe's unique identifier for this card)
    const cardFingerprint = paymentMethod.card.fingerprint;

    if (!cardFingerprint) {
      console.log(`⚠️ No card fingerprint available`);
      return;
    }

    console.log(`🔍 Tracking payment fingerprint: ${cardFingerprint.substring(0, 12)}...`);

    // Track payment fingerprint and detect shared payments
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
      console.log(`🚨 FRAUD DETECTED: Payment method shared across ${result.linkedUsers.length + 1} accounts!`);
      console.log(`   Linked users: ${result.linkedUsers.join(', ')}`);
    } else {
      console.log(`✅ Payment fingerprint tracked, no fraud detected`);
    }
  } catch (error) {
    console.error('❌ Error tracking payment fingerprint:', error);
    // Don't throw - payment already succeeded, this is just fraud detection
  }
}

// Handle failed payment
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId, userId } = paymentIntent.metadata;

    console.error(`❌ Payment failed: ${paymentIntent.id}`);
    console.error(`   User: ${userId}`);
    console.error(`   Reason: ${paymentIntent.last_payment_error?.message}`);

    if (transactionId) {
      // Cancel the pending transaction
      await cancelDeposit(transactionId, 'failed', paymentIntent.last_payment_error?.message || 'Payment failed');
      console.log(`✅ Transaction ${transactionId} marked as failed`);
    }

    // Send notification to user about failed deposit
    if (userId) {
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        await notificationService.notifyDepositFailed(
          userId,
          paymentIntent.amount / 100,
          paymentIntent.last_payment_error?.message || 'Payment could not be processed'
        );
        console.log(`🔔 Deposit failed notification sent to user ${userId}`);
      } catch (error) {
        console.error('❌ Error sending deposit failed notification:', error);
      }
    }

  } catch (error) {
    console.error('❌ Error handling failed payment:', error);
  }
}

// Handle canceled/expired payment (user closed window or abandoned payment)
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { transactionId, userId } = paymentIntent.metadata;

    console.log(`🚫 Payment canceled/expired: ${paymentIntent.id}`);
    console.log(`   User: ${userId}`);
    console.log(`   Status: ${paymentIntent.status}`);

    if (transactionId) {
      // Cancel the pending transaction
      await cancelDeposit(transactionId, 'cancelled', 'Payment was canceled or expired');
      console.log(`✅ Transaction ${transactionId} marked as cancelled`);
    }

  } catch (error) {
    console.error('❌ Error handling canceled payment:', error);
  }
}

// Handle refunded charge
async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    console.log(`💸 Charge refunded: ${charge.id}`);
    console.log(`   Amount: €${charge.amount_refunded / 100}`);

    // TODO: Handle refund in database (deduct credits)
    // We'll implement this later

  } catch (error) {
    console.error('❌ Error handling refund:', error);
  }
}

