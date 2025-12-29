/**
 * Nuvei Payment Status API
 * Verify payment status after createPayment() completes
 * 
 * POST /api/nuvei/payment-status
 * Body: { sessionToken: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { nuveiService } from '@/lib/services/nuvei.service';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import { InvoiceService } from '@/lib/services/invoice.service';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import { sendInvoiceEmail } from '@/lib/nodemailer';
import { ObjectId } from 'mongodb';

// Helper to get user from database
async function getUserById(db: any, id: string) {
  try {
    let user = await db.collection('user').findOne({ _id: new ObjectId(id) });
    if (!user) {
      user = await db.collection('user').findOne({ _id: id });
    }
    return user;
  } catch {
    return null;
  }
}

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
    const { sessionToken, clientUniqueId } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get payment status from Nuvei
    const result = await nuveiService.getPaymentStatus({ sessionToken });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Find the transaction
    // New format: clientUniqueId = "txn_[transactionId]" - extract and find directly
    let transaction = null;
    
    if (clientUniqueId?.startsWith('txn_')) {
      // NEW FORMAT: Extract transaction ID directly
      const ourTransactionId = clientUniqueId.replace('txn_', '');
      transaction = await WalletTransaction.findOne({
        _id: ourTransactionId,
        userId, // Ensure it belongs to this user
      });
    }
    
    if (!transaction) {
      // FALLBACK: Search by sessionToken
      transaction = await WalletTransaction.findOne({
        userId,
        'metadata.sessionToken': sessionToken,
        provider: 'nuvei',
      });
    }

    if (!transaction && clientUniqueId) {
      // FALLBACK: Old format - search by metadata
      transaction = await WalletTransaction.findOne({
        userId,
        'metadata.clientUniqueId': clientUniqueId,
        provider: 'nuvei',
      });
    }

    // Process based on transaction status
    if (result.transactionStatus === 'APPROVED' && result.errCode === 0) {
      // Payment approved
      let invoiceGenerated = false;
      
      if (transaction && transaction.status === 'pending') {
        // Credit wallet FIRST to get new balance
        const wallet = await CreditWallet.findOne({ userId });
        let newBalance = transaction.balanceBefore || 0;
        
        if (wallet) {
          const oldBalance = wallet.creditBalance || 0;
          wallet.creditBalance = oldBalance + transaction.amount;
          wallet.totalDeposited = (wallet.totalDeposited || 0) + transaction.amount;
          await wallet.save();
          newBalance = wallet.creditBalance;
          console.log(`💰 Credited ${transaction.amount} to wallet. New balance: ${newBalance}`);
        }

        // Update transaction status
        transaction.status = 'completed';
        transaction.providerTransactionId = result.transactionId;
        transaction.completedAt = new Date();
        transaction.balanceAfter = newBalance;
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          authCode: result.authCode,
        };
        await transaction.save();

        // Generate invoice
        try {
          const invoiceSettings = await InvoiceSettings.getSingleton();
          
          if (invoiceSettings.sendInvoiceOnPurchase) {
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;
            
            if (db) {
              const user = await getUserById(db, userId);
              const customerEmail = user?.email || session.user.email;
              const customerName = user?.name || session.user.name || 'Customer';
              
              if (customerEmail) {
                console.log(`📄 Creating invoice for Nuvei deposit...`);
                
                // Get amounts from transaction metadata
                const actualVatAmount = transaction.metadata?.vatAmount || 0;
                const platformFeeAmount = transaction.metadata?.platformFeeAmount || 0;
                const eurAmount = transaction.amount - platformFeeAmount;
                
                // Build line items
                const invoiceLineItems = [
                  {
                    description: `Credit Purchase - ${eurAmount.toFixed(2)} Credits`,
                    quantity: 1,
                    unitPrice: eurAmount,
                  }
                ];
                
                if (platformFeeAmount > 0) {
                  invoiceLineItems.push({
                    description: 'Platform Processing Fee',
                    quantity: 1,
                    unitPrice: platformFeeAmount,
                  });
                }
                
                // Create invoice
                const { invoice } = await InvoiceService.createInvoice({
                  userId,
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
                  paymentMethod: 'nuvei',
                  paymentId: result.transactionId || '',
                  lineItems: invoiceLineItems,
                  currency: transaction.currency || 'EUR',
                  actualVatAmount: actualVatAmount,
                });
                
                console.log(`📄 Invoice ${invoice.invoiceNumber} created`);
                invoiceGenerated = true;
                
                // Update transaction with invoice reference
                transaction.metadata = {
                  ...transaction.metadata,
                  invoiceId: invoice._id.toString(),
                  invoiceNumber: invoice.invoiceNumber,
                };
                await transaction.save();
                
                // Send invoice email
                try {
                  await sendInvoiceEmail({
                    invoiceId: (invoice._id as any).toString(),
                    customerEmail,
                    customerName,
                  });
                  console.log(`📧 Invoice email sent to ${customerEmail}`);
                } catch (emailError) {
                  console.error('⚠️ Failed to send invoice email:', emailError);
                }
              }
            }
          }
        } catch (invoiceError) {
          console.error('❌ Error creating invoice:', invoiceError);
          // Don't fail the response - payment was successful
        }
      }

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        transactionId: result.transactionId,
        amount: result.amount,
        currency: result.currency,
        invoiceGenerated,
      });
    } else if (result.transactionStatus === 'DECLINED') {
      // Payment declined
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'failed';
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          errorCode: result.errCode,
          errorReason: result.reason,
        };
        await transaction.save();
      }

      return NextResponse.json({
        success: false,
        status: 'DECLINED',
        reason: result.reason || 'Payment declined',
        errorCode: result.errCode,
      });
    } else if (result.transactionStatus === 'PENDING') {
      // Payment still pending
      return NextResponse.json({
        success: false,
        status: 'PENDING',
        message: 'Payment is still processing',
      });
    } else if (result.transactionStatus === 'ERROR' || result.status === 'ERROR') {
      // Error
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'failed';
        transaction.metadata = {
          ...transaction.metadata,
          paymentStatus: result.transactionStatus,
          errorCode: result.errCode,
          errorReason: result.reason,
        };
        await transaction.save();
      }

      return NextResponse.json({
        success: false,
        status: 'ERROR',
        reason: result.reason || 'Payment error',
        errorCode: result.errCode,
      });
    }

    // Unknown status
    return NextResponse.json({
      success: false,
      status: result.transactionStatus || 'UNKNOWN',
      raw: result,
    });
  } catch (error) {
    console.error('Nuvei payment status error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment status' },
      { status: 500 }
    );
  }
}

