import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import UserBankAccount from '@/database/models/user-bank-account.model';
import NuveiUserPaymentOption from '@/database/models/nuvei-user-payment-option.model';
import { nuveiService } from '@/lib/services/nuvei.service';

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
    const maskedAccounts = accounts.map((account: any) => ({
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
      // Nuvei connection status - directly from bank account record
      nuveiConnected: !!account.nuveiUpoId && account.nuveiStatus === 'active',
      nuveiUpoId: account.nuveiUpoId,
      nuveiStatus: account.nuveiStatus,
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

    // Create Nuvei UPO for bank account (for automatic withdrawals)
    // Only if automatic withdrawals are enabled in admin settings
    let nuveiUpoId: string | undefined;
    let nuveiStatus: string = 'not_configured';
    
    const userTokenId = `user_${session.user.id}`;
    const cleanIban = iban?.replace(/\s/g, '').toUpperCase();
    
    // Check if automatic withdrawals are enabled
    const WithdrawalSettings = (await import('@/database/models/withdrawal-settings.model')).default;
    const withdrawalSettings = await WithdrawalSettings.findOne();
    const automaticWithdrawalsEnabled = withdrawalSettings?.nuveiWithdrawalEnabled ?? false;
    
    // Get user email for Nuvei
    const userEmail = session.user.email || 'noemail@example.com';
    // Parse account holder name into first/last for Nuvei
    const nameParts = accountHolderName.trim().split(' ');
    const firstName = nameParts[0] || 'N/A';
    const lastName = nameParts.slice(1).join(' ') || 'N/A';
    
    // Get user's address info for Nuvei billing (required by SEPA)
    const mongoose = await import('mongoose');
    const userCollection = mongoose.default.connection.collection('user');
    const userDoc = await userCollection.findOne({ 
      $or: [
        { _id: new mongoose.default.Types.ObjectId(session.user.id) },
        { id: session.user.id }
      ]
    });
    const userAddress = (userDoc as any)?.address || 'N/A';
    const userCity = (userDoc as any)?.city || 'N/A';
    
    if (cleanIban && automaticWithdrawalsEnabled) {
      try {
        console.log('🏦 Creating Nuvei bank UPO for user:', session.user.id);
        
        // Use addSepaUpo to create the UPO directly (no redirect needed)
        const nuveiResult = await nuveiService.addSepaUpo({
          userTokenId,
          iban: cleanIban,
          bic: swiftBic?.toUpperCase(),
          accountHolderName: accountHolderName.trim(),
          email: userEmail,
          country: country.toUpperCase(),
          firstName,
          lastName,
          address: userAddress,
          city: userCity,
        });
        
        if ('error' in nuveiResult) {
          console.error('🏦 Nuvei UPO creation failed:', nuveiResult.error);
          nuveiStatus = `error: ${nuveiResult.error}`;
        } else if (nuveiResult.userPaymentOptionId) {
          console.log('🏦 Nuvei UPO created:', nuveiResult.userPaymentOptionId);
          nuveiUpoId = String(nuveiResult.userPaymentOptionId);
          nuveiStatus = 'active';
          
          // Store the UPO in our database
          await NuveiUserPaymentOption.findOneAndUpdate(
            { 
              userId: session.user.id, 
              userPaymentOptionId: nuveiResult.userPaymentOptionId 
            },
            {
              userId: session.user.id,
              userTokenId,
              userPaymentOptionId: nuveiResult.userPaymentOptionId,
              type: 'bank',
              paymentMethod: 'apmgw_SEPA',
              ibanLast4: cleanIban.slice(-4),
              accountHolderName: accountHolderName.trim(),
              isActive: true,
              lastUsed: new Date(),
            },
            { upsert: true, new: true }
          );
        }
      } catch (nuveiError: any) {
        console.error('🏦 Nuvei UPO creation error:', nuveiError);
        nuveiStatus = `error: ${nuveiError.message}`;
        // Don't fail - we can still store the bank details for manual processing
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
      iban: cleanIban,
      accountNumber,
      routingNumber,
      swiftBic: swiftBic?.toUpperCase(),
      // Store Nuvei UPO info instead of Stripe
      nuveiUpoId,
      nuveiStatus,
      isDefault: setAsDefault,
      isVerified: nuveiStatus === 'active', // Mark as verified if Nuvei UPO created successfully
      nickname: nickname?.trim() || `${bankName || 'Bank'} ****${cleanIban?.slice(-4) || accountNumber?.slice(-4)}`,
    });

    console.log(`✅ Bank account added for user ${session.user.id}: ${bankAccount._id}`);
    if (nuveiUpoId) {
      console.log(`✅ Nuvei UPO linked: ${nuveiUpoId}`);
    }

    return NextResponse.json({
      success: true,
      message: nuveiUpoId 
        ? 'Bank account added and connected for automatic withdrawals!' 
        : 'Bank account added (manual processing)',
      account: {
        id: bankAccount._id,
        accountHolderName: bankAccount.accountHolderName,
        bankName: bankAccount.bankName,
        country: bankAccount.country,
        ibanLast4: bankAccount.ibanLast4,
        isDefault: bankAccount.isDefault,
        nickname: bankAccount.nickname,
        nuveiConnected: !!nuveiUpoId,
        nuveiUpoId: nuveiUpoId,
        nuveiStatus: nuveiStatus,
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

