import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { requireAdminAuth } from '@/lib/admin/auth';
import { getStripeClient } from '@/lib/stripe/config';

/**
 * GET /api/admin/pending-payments
 * Get all pending payment transactions with user details
 * Verifies Stripe PaymentIntent status and auto-cancels abandoned payments
 */
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const pendingPayments = await WalletTransaction.find({
      status: 'pending',
      transactionType: 'deposit'
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get Stripe client to verify payment intent statuses
    const stripe = await getStripeClient();
    
    // Filter and verify pending payments against Stripe
    const verifiedPendingPayments = [];
    
    for (const payment of pendingPayments) {
      const paymentIntentId = (payment as any).paymentIntentId;
      
      if (!paymentIntentId) {
        // Old transaction without payment intent ID - check age
        const paymentAge = Date.now() - new Date((payment as any).createdAt).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (paymentAge > maxAge) {
          // Auto-cancel old payments without payment intent
          console.log(`⏰ Auto-cancelling old pending payment without PI: ${(payment as any)._id}`);
          await WalletTransaction.findByIdAndUpdate((payment as any)._id, {
            status: 'cancelled',
            processedAt: new Date(),
            description: `${(payment as any).description} - Auto-cancelled (no payment intent, expired)`,
          });
          continue;
        }
        
        verifiedPendingPayments.push(payment);
        continue;
      }
      
      try {
        // Check actual status with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        console.log(`🔍 Checking PaymentIntent ${paymentIntentId}: status=${paymentIntent.status}`);
        
        // If Stripe says it's canceled, failed, or requires action - update our DB
        if (['canceled', 'requires_payment_method'].includes(paymentIntent.status)) {
          console.log(`🚫 PaymentIntent ${paymentIntentId} is ${paymentIntent.status} - cancelling transaction`);
          await WalletTransaction.findByIdAndUpdate((payment as any)._id, {
            status: 'cancelled',
            processedAt: new Date(),
            description: `${(payment as any).description} - Cancelled (payment ${paymentIntent.status})`,
          });
          continue;
        }
        
        // If it succeeded but we didn't get webhook, complete it
        if (paymentIntent.status === 'succeeded') {
          console.log(`✅ PaymentIntent ${paymentIntentId} succeeded but webhook missed - should process`);
          // Keep in pending for manual review since webhook didn't fire
          verifiedPendingPayments.push({
            ...payment,
            stripeStatus: paymentIntent.status,
            stripeStatusNote: 'Webhook may have been missed - payment succeeded on Stripe',
          });
          continue;
        }
        
        // Check if payment is too old (48 hours) and still requires confirmation
        const paymentAge = Date.now() - new Date((payment as any).createdAt).getTime();
        const maxAge = 48 * 60 * 60 * 1000; // 48 hours
        
        if (paymentAge > maxAge && paymentIntent.status === 'requires_confirmation') {
          console.log(`⏰ PaymentIntent ${paymentIntentId} expired (${Math.round(paymentAge / 3600000)}h old) - cancelling`);
          
          // Cancel on Stripe side too
          try {
            await stripe.paymentIntents.cancel(paymentIntentId);
          } catch {
            // May already be canceled or in non-cancelable state
          }
          
          await WalletTransaction.findByIdAndUpdate((payment as any)._id, {
            status: 'cancelled',
            processedAt: new Date(),
            description: `${(payment as any).description} - Auto-cancelled (payment expired)`,
          });
          continue;
        }
        
        // Payment is still legitimately pending
        verifiedPendingPayments.push({
          ...payment,
          stripeStatus: paymentIntent.status,
        });
        
      } catch (stripeError: any) {
        console.error(`⚠️ Error checking PaymentIntent ${paymentIntentId}:`, stripeError.message);
        // If we can't verify with Stripe, still show it but flag it
        verifiedPendingPayments.push({
          ...payment,
          stripeStatus: 'unknown',
          stripeStatusNote: 'Could not verify with Stripe',
        });
      }
    }

    // Get database connection for Better Auth users
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Fetch user details from Better Auth for each verified payment
    const paymentsWithUserDetails = await Promise.all(
      verifiedPendingPayments.map(async (payment) => {
        try {
          // Get user from Better Auth 'user' collection
          // Try matching both 'id' field and '_id' field
          console.log(`🔍 Looking up user: ${payment.userId}`);
          
          let user = await db.collection('user').findOne({ id: payment.userId });
          
          // If not found by 'id', try by '_id' as ObjectId
          if (!user) {
            try {
              const { ObjectId } = await import('mongodb');
              user = await db.collection('user').findOne({ _id: new ObjectId(payment.userId) });
            } catch (e) {
              // Not a valid ObjectId, skip
            }
          }
          
          // If still not found, try as string _id
          if (!user) {
            user = await db.collection('user').findOne({ _id: payment.userId });
          }
          
          if (!user) {
            console.log(`⚠️ User not found for ID: ${payment.userId}`);
            // Try fetching all users to debug
            const allUsers = await db.collection('user').find({}).limit(3).toArray();
            console.log(`📋 Sample users in DB (first 3):`, allUsers.map((u: any) => ({
              id: u.id,
              _id: u._id?.toString(),
              email: u.email
            })));
          } else {
            console.log(`✅ Found user: ${user.name || 'No name'} (${user.email || 'No email'})`);
          }
          
          return {
            ...payment,
            user: user ? {
              id: user.id || user._id?.toString(),
              name: user.name || 'User',
              email: user.email || 'No email',
              image: user.image || null,
            } : {
              id: payment.userId,
              name: 'User',
              email: 'No email available',
              image: null,
            },
          };
        } catch (error) {
          console.error(`❌ Error fetching user ${payment.userId}:`, error);
          return {
            ...payment,
            user: {
              id: payment.userId,
              name: 'User',
              email: 'Error loading email',
              image: null,
            },
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      count: paymentsWithUserDetails.length,
      payments: paymentsWithUserDetails,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ Error fetching pending payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending payments' },
      { status: 500 }
    );
  }
}

