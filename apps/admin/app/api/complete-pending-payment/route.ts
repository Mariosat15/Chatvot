import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';
import { getStripeClient } from '@/lib/stripe/config';
import { PaymentFraudService } from '@/lib/services/fraud/payment-fraud.service';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * POST /api/admin/complete-pending-payment
 * Manually complete a pending payment (for testing without webhooks)
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { transactionId } = await request.json();

    // Find the pending transaction
    let transaction;
    
    if (transactionId) {
      transaction = await WalletTransaction.findById(transactionId);
    } else {
      // Find most recent pending deposit
      transaction = await WalletTransaction.findOne({
        status: 'pending',
        transactionType: 'deposit'
      }).sort({ createdAt: -1 });
    }

    if (!transaction) {
      return NextResponse.json(
        { error: 'No pending transaction found' },
        { status: 404 }
      );
    }

    console.log('📋 Found pending transaction:');
    console.log('   ID:', transaction._id);
    console.log('   User:', transaction.userId);
    console.log('   Amount:', transaction.amount, transaction.currency);
    console.log('   Credits:', transaction.creditsAmount);

    // Update transaction status
    transaction.status = 'completed';
    transaction.paymentIntentId = transaction.paymentIntentId || 'manual_completion';
    transaction.paymentMethod = transaction.paymentMethod || 'manual';
    await transaction.save();
    console.log('✅ Transaction marked as completed');

    // Update wallet balance
    const wallet = await CreditWallet.findOne({ userId: transaction.userId });
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found for user' },
        { status: 404 }
      );
    }

    // Use the net amount (already has fee deducted)
    const creditsToAdd = transaction.amount;
    const eurAmount = transaction.metadata?.eurAmount || transaction.amount;
    
    wallet.creditBalance += creditsToAdd;
    wallet.totalDeposited += eurAmount; // Track EUR deposited, not credits
    await wallet.save();

    // Get fee details from transaction metadata
    const platformFeeAmount = transaction.metadata?.platformFeeAmount || 0;
    const bankFeeTotal = transaction.metadata?.bankFeeTotal || 0;
    const netPlatformEarning = platformFeeAmount - bankFeeTotal;
    
    console.log('✅ Wallet updated:');
    console.log('   Credits added:', creditsToAdd);
    console.log('   New balance:', wallet.creditBalance, 'credits');
    console.log('   EUR deposited:', eurAmount);
    console.log('   Platform Fee: €' + platformFeeAmount.toFixed(2));
    console.log('   Bank Fee: €' + bankFeeTotal.toFixed(2));
    console.log('   Net Earning: €' + netPlatformEarning.toFixed(2));

    // Record deposit fee in platform financials
    if (platformFeeAmount > 0) {
      try {
        const { PlatformFinancialsService } = await import('@/lib/services/platform-financials.service');
        console.log('💵 Recording deposit fee to PlatformTransaction...');
        await PlatformFinancialsService.recordDepositFee({
          userId: transaction.userId.toString(),
          depositAmount: eurAmount,
          platformFeeAmount: platformFeeAmount,
          bankFeeAmount: bankFeeTotal,
          netEarning: netPlatformEarning,
          transactionId: transaction._id.toString(),
        });
        console.log('✅ Deposit fee recorded successfully');
      } catch (error) {
        console.error('❌ Error recording deposit fee:', error);
      }
    } else {
      console.log('ℹ️ No platform fee to record (fee is 0%)');
    }

    // FRAUD DETECTION: Track payment fingerprint
    await trackPaymentFingerprint(transaction);

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.log({
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          action: 'payment_completed',
          category: 'financial',
          description: `Manually completed payment: ${creditsToAdd} credits for user ${transaction.userId}`,
          targetType: 'transaction',
          targetId: transaction._id.toString(),
          metadata: {
            userId: transaction.userId,
            creditsAdded: creditsToAdd,
            eurAmount,
            platformFee: platformFeeAmount,
            bankFee: bankFeeTotal,
          },
        });
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    // Send notification to user about successful deposit
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.notifyDepositCompleted(
        transaction.userId.toString(),
        eurAmount,
        wallet.creditBalance
      );
      console.log(`🔔 Deposit notification sent to user ${transaction.userId}`);
    } catch (notifError) {
      console.error('❌ Error sending deposit notification:', notifError);
      // Don't throw - deposit already succeeded
    }

    // Create and send invoice
    try {
      const InvoiceSettings = (await import('@/database/models/invoice-settings.model')).default;
      const invoiceSettings = await InvoiceSettings.getSingleton();
      
      console.log(`📄 Invoice settings: sendInvoiceOnPurchase=${invoiceSettings.sendInvoiceOnPurchase}`);
      
      if (invoiceSettings.sendInvoiceOnPurchase) {
        const { InvoiceService } = await import('@/lib/services/invoice.service');
        const { sendInvoiceEmail } = await import('@/lib/nodemailer');
        const { getUserById } = await import('@/lib/utils/user-lookup');
        
        // Get user info from database
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
            customerAddress: user?.address ? {
              line1: user.address,
              city: user.city,
              postalCode: user.postalCode,
              country: user.country,
            } : undefined,
            transactionId: transaction._id.toString(),
            transactionType: 'deposit',
            paymentMethod: transaction.paymentMethod || 'manual',
            paymentId: transaction.paymentIntentId || 'manual_completion',
            lineItems: invoiceLineItems,
            currency: 'EUR',
            actualVatAmount: actualVatAmount, // Use actual VAT charged (only on credits)
          });
          
          console.log(`📄 Invoice ${invoice.invoiceNumber} created`);
          
          // Send invoice email directly (replaces Inngest)
          try {
            await sendInvoiceEmail({
              invoiceId: (invoice._id as any).toString(),
              customerEmail,
              customerName,
            });
            console.log(`📧 Invoice email sent to ${customerEmail}`);
          } catch (emailError) {
            console.error('⚠️ Failed to send invoice email:', emailError);
            // Don't fail the payment completion if email fails
          }
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

    return NextResponse.json({
      success: true,
      message: 'Payment completed successfully',
      transaction: {
        id: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        currency: transaction.currency,
        credits: transaction.creditsAmount,
        status: transaction.status,
      },
      wallet: {
        balance: wallet.creditBalance,
        totalDeposited: wallet.totalDeposited,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ Error completing payment:', error);
    return NextResponse.json(
      { error: 'Failed to complete payment' },
      { status: 500 }
    );
  }
}

// Track payment fingerprint for fraud detection
async function trackPaymentFingerprint(transaction: any) {
  try {
    const paymentIntentId = transaction.paymentIntentId;
    const userId = transaction.userId.toString();

    if (!paymentIntentId || paymentIntentId === 'manual_completion') {
      console.log(`⚠️ No payment intent ID, skipping fraud detection`);
      return;
    }

    console.log(`💳 [FRAUD] Retrieving payment method for fraud detection...`);
    console.log(`   Payment Intent: ${paymentIntentId}`);
    console.log(`   User: ${userId}`);

    // Get Stripe client
    const stripe = await getStripeClient();

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const paymentMethodId = paymentIntent.payment_method;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      console.log(`⚠️ No payment method ID found for fraud tracking`);
      return;
    }

    // Retrieve payment method details
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

    console.log(`🔍 [FRAUD] Card Fingerprint: ${cardFingerprint.substring(0, 12)}...`);
    console.log(`   Card: ${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}`);
    console.log(`   Country: ${paymentMethod.card.country || 'Unknown'}`);

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
      transactionId: paymentIntentId,
      amount: transaction.amount,
      currency: transaction.currency || 'EUR'
    });

    if (result.fraudDetected) {
      console.log(`🚨 [FRAUD] SHARED PAYMENT DETECTED!`);
      console.log(`   Total Accounts: ${result.linkedUsers.length + 1}`);
      console.log(`   Linked Users: ${result.linkedUsers.join(', ')}`);
      console.log(`   Card: ${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}`);
    } else {
      console.log(`✅ [FRAUD] Payment fingerprint tracked, no fraud detected`);
    }
  } catch (error) {
    console.error('❌ [FRAUD] Error tracking payment fingerprint:', error);
    // Don't throw - payment already succeeded, this is just fraud detection
  }
}
