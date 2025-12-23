import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import UserBankAccount from '@/database/models/user-bank-account.model';
import Stripe from 'stripe';

/**
 * GET /api/wallet/bank-accounts
 * Get user's bank accounts for withdrawals
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const accounts = await UserBankAccount.getUserAccounts(session.user.id);

    // Mask sensitive data for response
    const maskedAccounts = accounts.map((account) => ({
      id: account._id,
      accountHolderName: account.accountHolderName,
      accountHolderType: account.accountHolderType,
      bankName: account.bankName,
      country: account.country,
      currency: account.currency,
      // Only show last 4 of IBAN/account number
      ibanLast4: account.ibanLast4,
      accountNumberLast4: account.accountNumberLast4,
      swiftBic: account.swiftBic,
      isVerified: account.isVerified,
      isDefault: account.isDefault,
      isActive: account.isActive,
      nickname: account.nickname,
      addedAt: account.addedAt,
      lastUsedAt: account.lastUsedAt,
      totalPayouts: account.totalPayouts,
      stripeAccountStatus: account.stripeAccountStatus,
    }));

    return NextResponse.json({
      success: true,
      accounts: maskedAccounts,
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wallet/bank-accounts
 * Add a new bank account for withdrawals
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountHolderName,
      accountHolderType = 'individual',
      bankName,
      country,
      currency = 'eur',
      iban,
      accountNumber,
      routingNumber,
      swiftBic,
      nickname,
      setAsDefault = true,
    } = body;

    // Validation
    if (!accountHolderName || accountHolderName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Account holder name is required' },
        { status: 400 }
      );
    }

    if (!country || country.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'Valid country code is required (e.g., DE, NL, FR)' },
        { status: 400 }
      );
    }

    // Either IBAN or account number required
    if (!iban && !accountNumber) {
      return NextResponse.json(
        { success: false, error: 'Either IBAN or account number is required' },
        { status: 400 }
      );
    }

    // Validate IBAN format if provided
    if (iban) {
      const cleanIban = iban.replace(/\s/g, '').toUpperCase();
      if (cleanIban.length < 15 || cleanIban.length > 34) {
        return NextResponse.json(
          { success: false, error: 'Invalid IBAN format' },
          { status: 400 }
        );
      }
    }

    await connectToDatabase();

    // Check if user already has this bank account
    const existingAccount = await UserBankAccount.findOne({
      userId: session.user.id,
      $or: [
        { iban: iban?.replace(/\s/g, '').toUpperCase() },
        { accountNumber },
      ],
      isActive: true,
    });

    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: 'This bank account is already added to your profile' },
        { status: 400 }
      );
    }

    // Check account limit (max 5 accounts per user)
    const accountCount = await UserBankAccount.countDocuments({
      userId: session.user.id,
      isActive: true,
    });

    if (accountCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 bank accounts allowed. Please remove an existing account first.' },
        { status: 400 }
      );
    }

    // Create Stripe external account (if Stripe is configured)
    let stripeExternalAccountId: string | undefined;
    let stripeAccountStatus: string | undefined;

    const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY;
    if (stripeKey && iban) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
        
        // Create a token for the bank account
        // Note: In test mode, use test bank account numbers
        // For SEPA: Use test IBAN like DE89370400440532013000
        const bankAccountToken = await stripe.tokens.create({
          bank_account: {
            country: country.toUpperCase(),
            currency: currency.toLowerCase(),
            account_holder_name: accountHolderName,
            account_holder_type: accountHolderType,
            // For SEPA countries, use IBAN
            account_number: iban.replace(/\s/g, ''),
          },
        });

        console.log(`✅ Stripe bank account token created: ${bankAccountToken.id}`);
        stripeExternalAccountId = bankAccountToken.id;
        stripeAccountStatus = 'pending_verification';

        // Note: To actually add this as an external account for payouts,
        // you need either:
        // 1. A Stripe Connect account for the user, OR
        // 2. Add to your platform's account (not recommended for multi-user)
        // 
        // For now, we just create the token for verification
        // Full Connect integration would be:
        // const externalAccount = await stripe.accounts.createExternalAccount(
        //   connectedAccountId,
        //   { external_account: bankAccountToken.id }
        // );

      } catch (stripeError: any) {
        console.error('Stripe bank account error:', stripeError);
        // Don't fail - we can still store the bank details
        stripeAccountStatus = `error: ${stripeError.message}`;
      }
    }

    // Create the bank account record
    const bankAccount = await UserBankAccount.create({
      userId: session.user.id,
      accountHolderName: accountHolderName.trim(),
      accountHolderType,
      bankName: bankName?.trim(),
      country: country.toUpperCase(),
      currency: currency.toLowerCase(),
      iban: iban?.replace(/\s/g, '').toUpperCase(),
      accountNumber,
      routingNumber,
      swiftBic: swiftBic?.toUpperCase(),
      stripeExternalAccountId,
      stripeAccountStatus,
      isDefault: setAsDefault,
      isVerified: false, // Will be verified after first successful payout
      nickname: nickname?.trim() || `${bankName || 'Bank'} ****${iban?.slice(-4) || accountNumber?.slice(-4)}`,
    });

    console.log(`✅ Bank account added for user ${session.user.id}: ${bankAccount._id}`);

    return NextResponse.json({
      success: true,
      message: 'Bank account added successfully',
      account: {
        id: bankAccount._id,
        accountHolderName: bankAccount.accountHolderName,
        bankName: bankAccount.bankName,
        country: bankAccount.country,
        ibanLast4: bankAccount.ibanLast4,
        isDefault: bankAccount.isDefault,
        nickname: bankAccount.nickname,
        stripeAccountStatus: bankAccount.stripeAccountStatus,
      },
    });
  } catch (error) {
    console.error('Error adding bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add bank account' },
      { status: 500 }
    );
  }
}

