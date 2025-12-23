import { NextResponse } from 'next/server';
import { getPaymentProviderCredentials } from '@/lib/services/settings.service';
import { connectToDatabase } from '@/database/mongoose';
import PaymentProvider from '@/database/models/payment-provider.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { isEUCountry } from '@/lib/utils/country-vat';
import { ObjectId } from 'mongodb';
import { isPaddleConfigured, getPaddleConfig } from '@/lib/paddle/config';

/**
 * Helper to find user by various ID formats
 */
async function findUserById(db: any, userId: string) {
  // Try by 'id' field first (better-auth uses this)
  let user = await db.collection('user').findOne({ id: userId });
  
  // If not found, try by '_id' as ObjectId
  if (!user && ObjectId.isValid(userId)) {
    try {
      user = await db.collection('user').findOne({ _id: new ObjectId(userId) });
    } catch {
      // Not a valid ObjectId
    }
  }
  
  // If still not found, try by '_id' as string
  if (!user) {
    user = await db.collection('user').findOne({ _id: userId });
  }
  
  return user;
}

/**
 * GET /api/payment-config
 * Get public payment configuration (publishable keys only)
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    // Get provider from database
    const provider = await PaymentProvider.findOne({ slug: 'stripe', isActive: true });
    
    if (!provider) {
      return NextResponse.json({
        configured: false,
        provider: null,
      });
    }

    const stripeConfig = await getPaymentProviderCredentials('stripe');
    
    if (!stripeConfig) {
      return NextResponse.json({
        configured: false,
        provider: null,
      });
    }

    // Get centralized fee settings
    const feeSettings = await CreditConversionSettings.getSingleton();
    const platformDepositFee = feeSettings.platformDepositFeePercentage || 0;

    // Get VAT settings
    const invoiceSettings = await InvoiceSettings.getSingleton();
    const vatEnabled = invoiceSettings.vatEnabled;
    const vatPercentage = invoiceSettings.vatPercentage || 0;

    // Get user's country to determine if VAT applies
    let userCountry: string | null = null;
    let vatApplicable = false;
    
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session?.user?.id) {
        // Get user's country from database (handle multiple ID formats)
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (db) {
          const user = await findUserById(db, session.user.id);
          userCountry = user?.country || null;
          console.log(`💳 Payment config - User ${session.user.id} country: ${userCountry}`);
        }
      }
    } catch (e) {
      console.error('Error getting user country:', e);
      // User not logged in, that's okay
    }

    // VAT applies only if: admin enabled VAT AND user is in EU
    vatApplicable = vatEnabled && isEUCountry(userCountry);
    
    console.log(`💳 Payment config - VAT enabled by admin: ${vatEnabled}, User country: ${userCountry}, Is EU: ${isEUCountry(userCountry)}, VAT applicable: ${vatApplicable}`);

    // Check Paddle availability
    let paddleAvailable = false;
    let paddleConfig: any = null;
    try {
      paddleAvailable = await isPaddleConfigured();
      if (paddleAvailable) {
        paddleConfig = await getPaddleConfig();
      }
    } catch (e) {
      // Paddle not configured
    }

    // Return available payment providers
    return NextResponse.json({
      configured: true,
      // Primary provider (Stripe for backwards compatibility)
      provider: 'stripe',
      publishableKey: (stripeConfig as any).publishable_key || (stripeConfig as any).public_key || '',
      testMode: stripeConfig.testMode || false,
      processingFee: platformDepositFee, // From centralized Fee Settings
      // VAT info
      vatEnabled: vatApplicable, // True only if admin enabled AND user is EU
      vatPercentage: vatApplicable ? vatPercentage : 0,
      userCountry,
      // Available payment providers
      providers: {
        stripe: {
          available: true,
          publishableKey: (stripeConfig as any).publishable_key || (stripeConfig as any).public_key || '',
          testMode: stripeConfig.testMode || false,
        },
        paddle: {
          available: paddleAvailable,
          clientToken: paddleConfig?.publicKey || null,
          environment: paddleConfig?.environment || 'sandbox',
          vendorId: paddleConfig?.vendorId || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    return NextResponse.json({
      configured: false,
      provider: null,
      providers: {},
    });
  }
}

