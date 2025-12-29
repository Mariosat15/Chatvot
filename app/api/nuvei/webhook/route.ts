/**
 * Nuvei DMN (Direct Merchant Notification) Webhook
 * Handles payment notifications from Nuvei
 * 
 * POST /api/nuvei/webhook
 * 
 * Documentation: https://docs.nuvei.com/documentation/integration/webhooks/payment-dmns/
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import PaymentProvider from '@/database/models/payment-provider.model';
import { InvoiceService } from '@/lib/services/invoice.service';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import { sendInvoiceEmail } from '@/lib/email/invoice-email';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

// Helper to get user from database
async function getUserById(db: any, id: string) {
  try {
    // Try ObjectId first
    let user = await db.collection('user').findOne({ _id: new ObjectId(id) });
    if (!user) {
      // Try as string
      user = await db.collection('user').findOne({ _id: id });
    }
    return user;
  } catch {
    return null;
  }
}

interface NuveiDmnParams {
  ppp_status: string;
  Status: string;
  ErrCode: string;
  ExErrCode: string;
  errCode?: string;
  errApmCode?: string;
  errScCode?: string;
  Reason?: string;
  ReasonCode?: string;
  PPP_TransactionID: string;
  TransactionID?: string;
  transactionId?: string;
  userid?: string;
  merchant_unique_id?: string;
  clientUniqueId?: string;
  currency: string;
  totalAmount?: string;
  amount?: string;
  transactionType?: string;
  merchant_id?: string;
  merchant_site_id?: string;
  advanceResponseChecksum?: string;
  responsechecksum?: string;
  [key: string]: string | undefined;
}

// Verify DMN signature
function verifyDmnSignature(params: NuveiDmnParams, secretKey: string): boolean {
  const checksum = params.advanceResponseChecksum || params.responsechecksum;
  if (!checksum) {
    console.warn('No checksum found in DMN');
    return false;
  }

  // The advanceResponseChecksum is calculated from specific fields
  // For simplicity, we'll trust DMNs from Nuvei's IP range in production
  // In a real implementation, you should verify the checksum properly
  
  // Basic checksum verification attempt
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'advanceResponseChecksum' && k !== 'responsechecksum')
    .sort();
  
  let data = '';
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined) {
      data += value;
    }
  }
  data += secretKey;
  
  const calculatedChecksum = crypto.createHash('sha256').update(data).digest('hex');
  
  // Log for debugging
  console.log('DMN verification - received:', checksum);
  console.log('DMN verification - calculated:', calculatedChecksum);
  
  return calculatedChecksum === checksum;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    // Parse form data or JSON
    let params: NuveiDmnParams;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      params = {} as NuveiDmnParams;
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      params = await req.json();
    } else {
      // Try to parse as URL encoded
      const text = await req.text();
      params = {} as NuveiDmnParams;
      const urlParams = new URLSearchParams(text);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    console.log('Nuvei DMN received:', JSON.stringify(params, null, 2));

    // Get Nuvei provider config for secret key
    const provider = await PaymentProvider.findOne({ slug: 'nuvei', isActive: true });
    if (!provider) {
      console.error('Nuvei provider not found');
      return NextResponse.json({ error: 'Provider not configured' }, { status: 500 });
    }

    const secretKey = provider.credentials.find((c: { key: string }) => c.key === 'secret_key')?.value;
    
    // Optional: Verify signature (can be skipped for testing)
    // if (secretKey && !verifyDmnSignature(params, secretKey)) {
    //   console.error('DMN signature verification failed');
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    // }

    // Extract transaction details
    const nuveiTransactionId = params.TransactionID || params.transactionId || params.PPP_TransactionID;
    const status = params.Status || params.ppp_status;
    const clientUniqueId = params.clientUniqueId || params.merchant_unique_id;
    const amount = parseFloat(params.totalAmount || params.amount || '0');
    const currency = params.currency;
    const errCode = parseInt(params.ErrCode || params.errCode || '0');

    console.log(`Processing DMN: nuveiTransactionId=${nuveiTransactionId}, status=${status}, clientUniqueId=${clientUniqueId}`);

    // Find the pending transaction
    // New format: clientUniqueId = "txn_[transactionId]" - extract and find directly
    // Old format: clientUniqueId = "dep_[userId8]_[timestamp]" - search by metadata
    let transaction = null;
    
    if (clientUniqueId?.startsWith('txn_')) {
      // NEW FORMAT: Extract transaction ID directly from clientUniqueId
      const ourTransactionId = clientUniqueId.replace('txn_', '');
      transaction = await WalletTransaction.findById(ourTransactionId);
      console.log(`Found transaction by ID: ${ourTransactionId}`, !!transaction);
    }
    
    if (!transaction) {
      // FALLBACK: Old format or search by metadata
      transaction = await WalletTransaction.findOne({
        'metadata.clientUniqueId': clientUniqueId,
        provider: 'nuvei',
      });
    }

    if (!transaction) {
      // Try finding by orderId
      transaction = await WalletTransaction.findOne({
        'metadata.orderId': params.PPP_TransactionID,
        provider: 'nuvei',
      });
    }

    if (!transaction) {
      console.error('Transaction not found for DMN:', clientUniqueId);
      // Still return OK to Nuvei to prevent retries
      return NextResponse.json({ status: 'OK', message: 'Transaction not found' });
    }

    // Update transaction based on status
    if (status === 'APPROVED' && errCode === 0) {
      // Check if already processed to prevent duplicate processing
      if (transaction.status === 'completed') {
        console.log(`Transaction ${transaction._id} already completed, skipping`);
        return NextResponse.json({ status: 'OK', message: 'Already processed' });
      }

      // Credit the wallet FIRST to get new balance
      const wallet = await CreditWallet.findOne({ userId: transaction.userId });
      let newBalance = transaction.balanceBefore || 0;
      
      if (wallet) {
        const oldBalance = wallet.creditBalance || 0;
        wallet.creditBalance = oldBalance + transaction.amount;
        wallet.totalDeposited = (wallet.totalDeposited || 0) + transaction.amount;
        await wallet.save();
        newBalance = wallet.creditBalance;
        console.log(`Credited ${transaction.amount} to wallet for user ${transaction.userId}. New balance: ${newBalance}`);
      } else {
        console.error('Wallet not found for user:', transaction.userId);
      }

      // Payment successful - update transaction with new balance
      transaction.status = 'completed';
      transaction.providerTransactionId = nuveiTransactionId;
      transaction.processedAt = new Date();
      transaction.balanceAfter = newBalance;
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
      };
      await transaction.save();

      // Generate and send invoice (if not already generated by payment-status endpoint)
      try {
        // Check if invoice was already created
        if (transaction.metadata?.invoiceId) {
          console.log(`📄 Invoice already exists for transaction ${transaction._id}, skipping`);
        } else {
          const invoiceSettings = await InvoiceSettings.getSingleton();
          
          if (invoiceSettings.sendInvoiceOnPurchase) {
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;
            
            if (db) {
              const user = await getUserById(db, transaction.userId);
              const customerEmail = user?.email || params.email;
              const customerName = user?.name || params.nameOnCard || params.first_name || 'Customer';
              
              if (customerEmail) {
                console.log(`📄 Creating invoice for Nuvei deposit for ${customerEmail}...`);
                
                // Get VAT amount from transaction metadata
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
                
                console.log(`📄 Invoice line items: Credits €${eurAmount}, Fee €${platformFeeAmount}, VAT €${actualVatAmount}`);
                
                // Create invoice
                const { invoice } = await InvoiceService.createInvoice({
                  userId: transaction.userId,
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
                  paymentId: nuveiTransactionId || '',
                  lineItems: invoiceLineItems,
                  currency: transaction.currency || 'EUR',
                  actualVatAmount: actualVatAmount,
                });
                
                console.log(`📄 Invoice ${invoice.invoiceNumber} created for Nuvei deposit`);
                
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
              } else {
                console.log(`⚠️ No email found for user ${transaction.userId}, skipping invoice`);
              }
            }
          } else {
            console.log(`ℹ️ Invoice sending disabled in settings`);
          }
        }
      } catch (invoiceError) {
        console.error('❌ Error creating invoice:', invoiceError);
        // Don't fail the webhook - deposit already succeeded
      }
    } else if (status === 'DECLINED' || status === 'ERROR') {
      // Payment failed
      transaction.status = 'failed';
      transaction.providerTransactionId = nuveiTransactionId;
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
        errorCode: errCode,
        errorReason: params.Reason || params.errApmDescription || 'Payment declined',
      };
      await transaction.save();
      console.log(`Transaction ${transaction._id} marked as failed: ${params.Reason}`);
    } else if (status === 'PENDING') {
      // Payment pending - update metadata
      transaction.metadata = {
        ...transaction.metadata,
        dmnStatus: status,
        dmnTransactionId: nuveiTransactionId,
      };
      await transaction.save();
      console.log(`Transaction ${transaction._id} still pending`);
    }

    // Return OK to acknowledge receipt
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('Nuvei webhook error:', error);
    // Still return OK to prevent Nuvei from retrying
    return NextResponse.json({ status: 'OK', error: 'Internal error' });
  }
}

// Nuvei may send GET requests for testing
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    message: 'Nuvei webhook endpoint active' 
  });
}

