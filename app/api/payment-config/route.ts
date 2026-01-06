import { NextResponse } from 'next/server';
import { getPaymentProviderCredentials } from '@/lib/services/settings.service';
import { connectToDatabase } from '@/database/mongoose';
import PaymentProvider from '@/database/models/payment-provider.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import InvoiceSettings from '@/database/models/invoice-settings.model';
import CompanySettings from '@/database/models/company-settings.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { isEUCountry } from '@/lib/utils/country-vat';
import { ObjectId } from 'mongodb';
import { isPaddleConfigured, getPaddleConfig } from '@/lib/paddle/config';
import { nuveiService, NUVEI_SDK_URL } from '@/lib/services/nuvei.service';

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
    
    // Get centralized fee settings
    const feeSettings = await CreditConversionSettings.getSingleton();
    const platformDepositFee = feeSettings.platformDepositFeePercentage || 0;

    // Get VAT settings
    const invoiceSettings = await InvoiceSettings.getSingleton();
    const vatEnabled = invoiceSettings.vatEnabled;
    const vatPercentage = invoiceSettings.vatPercentage || 0;

    // Get company country to determine VAT applicability
    const companySettings = await CompanySettings.getSingleton();
    const companyCountry = companySettings.country;
    const companyIsInEU = isEUCountry(companyCountry);

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

    // VAT RULES:
    // - User in EU + Company in EU = VAT APPLIES
    // - User in EU + Company NOT in EU = NO VAT
    // - User NOT in EU + Company in EU = NO VAT
    // - User NOT in EU + Company NOT in EU = NO VAT
    // Summary: VAT applies ONLY when BOTH user AND company are in the EU
    const userIsInEU = isEUCountry(userCountry);
    vatApplicable = vatEnabled && userIsInEU && companyIsInEU;
    
    console.log(`💳 Payment config - VAT enabled: ${vatEnabled}, User country: ${userCountry} (EU: ${userIsInEU}), Company country: ${companyCountry} (EU: ${companyIsInEU}), VAT applicable: ${vatApplicable}`);

    // Check Stripe availability
    let stripeAvailable = false;
    let stripeConfig: any = null;
    try {
      const stripeProvider = await PaymentProvider.findOne({ slug: 'stripe', isActive: true });
      if (stripeProvider) {
        stripeConfig = await getPaymentProviderCredentials('stripe');
        stripeAvailable = !!(stripeConfig && ((stripeConfig as any).publishable_key || (stripeConfig as any).public_key));
      }
    } catch (e) {
      // Stripe not configured
    }

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

    // Check Nuvei availability
    let nuveiConfig: any = null;
    let nuveiAvailable = false;
    try {
      nuveiConfig = await nuveiService.getClientConfig();
      nuveiAvailable = nuveiConfig?.enabled || false;
      console.log('💳 Nuvei config check:', { nuveiConfig, nuveiAvailable });
    } catch (e) {
      console.error('💳 Nuvei config error:', e);
      // Nuvei not configured
    }

    // Check if ANY provider is available
    const anyProviderConfigured = stripeAvailable || paddleAvailable || nuveiAvailable;
    
    console.log('💳 Payment providers available:', { 
      stripeAvailable, 
      paddleAvailable, 
      nuveiAvailable,
      anyProviderConfigured 
    });

    if (!anyProviderConfigured) {
      console.log('💳 No payment providers configured');
      return NextResponse.json({
        configured: false,
        provider: null,
        providers: {},
      });
    }

    // Determine primary provider (first available)
    let primaryProvider = 'stripe';
    if (stripeAvailable) {
      primaryProvider = 'stripe';
    } else if (nuveiAvailable) {
      primaryProvider = 'nuvei';
    } else if (paddleAvailable) {
      primaryProvider = 'paddle';
    }

    // Return available payment providers
    return NextResponse.json({
      configured: true,
      // Primary provider
      provider: primaryProvider,
      publishableKey: stripeConfig ? ((stripeConfig as any).publishable_key || (stripeConfig as any).public_key || '') : '',
      testMode: stripeConfig?.testMode || false,
      processingFee: platformDepositFee, // From centralized Fee Settings
      // VAT info
      vatEnabled: vatApplicable, // True only if admin enabled AND user is EU
      vatPercentage: vatApplicable ? vatPercentage : 0,
      userCountry,
      // Available payment providers
      providers: {
        stripe: {
          available: stripeAvailable,
          publishableKey: stripeConfig ? ((stripeConfig as any).publishable_key || (stripeConfig as any).public_key || '') : '',
          testMode: stripeConfig?.testMode || false,
        },
        paddle: {
          available: paddleAvailable,
          clientToken: paddleConfig?.publicKey || null,
          environment: paddleConfig?.environment || 'sandbox',
          vendorId: paddleConfig?.vendorId || null,
        },
        nuvei: {
          available: nuveiAvailable,
          merchantId: nuveiConfig?.merchantId || null,
          siteId: nuveiConfig?.siteId || null,
          testMode: nuveiConfig?.testMode ?? true,
          sdkUrl: nuveiConfig?.sdkUrl || NUVEI_SDK_URL,
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

