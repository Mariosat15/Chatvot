import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import UserBankAccount from '@/database/models/user-bank-account.model';

/**
 * GET /api/wallet/bank-accounts/[id]
 * Get a specific bank account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const account = await UserBankAccount.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account._id,
        accountHolderName: account.accountHolderName,
        accountHolderType: account.accountHolderType,
        bankName: account.bankName,
        country: account.country,
        currency: account.currency,
        iban: account.iban, // Return full IBAN for editing
        ibanLast4: account.ibanLast4,
        accountNumber: account.accountNumber,
        accountNumberLast4: account.accountNumberLast4,
        swiftBic: account.swiftBic,
        isVerified: account.isVerified,
        isDefault: account.isDefault,
        isActive: account.isActive,
        nickname: account.nickname,
        addedAt: account.addedAt,
        totalPayouts: account.totalPayouts,
        totalPayoutAmount: account.totalPayoutAmount,
        stripeAccountStatus: account.stripeAccountStatus,
      },
    });
  } catch (error) {
    console.error('Error fetching bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank account' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/wallet/bank-accounts/[id]
 * Update a bank account - all fields are editable
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { 
      accountHolderName, 
      bankName, 
      country, 
      iban, 
      swiftBic, 
      nickname, 
      setAsDefault 
    } = body;

    await connectToDatabase();

    const account = await UserBankAccount.findOne({
      _id: id,
      userId: session.user.id,
      isActive: true,
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // Update account holder name
    if (accountHolderName !== undefined && accountHolderName.trim()) {
      account.accountHolderName = accountHolderName.trim();
    }

    // Update bank name
    if (bankName !== undefined) {
      account.bankName = bankName.trim() || undefined;
    }

    // Update country
    if (country !== undefined && country.length === 2) {
      account.country = country.toUpperCase();
    }

    // Update IBAN (if provided)
    if (iban !== undefined && iban.trim()) {
      const cleanIban = iban.replace(/\s/g, '').toUpperCase();
      if (cleanIban.length >= 15 && cleanIban.length <= 34) {
        account.iban = cleanIban;
        account.ibanLast4 = cleanIban.slice(-4);
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid IBAN format' },
          { status: 400 }
        );
      }
    }

    // Update SWIFT/BIC
    if (swiftBic !== undefined) {
      account.swiftBic = swiftBic.toUpperCase().trim() || undefined;
    }

    // Update nickname
    if (nickname !== undefined) {
      account.nickname = nickname.trim() || undefined;
    }

    // Handle default account setting
    if (setAsDefault === true) {
      // Unset other defaults first
      await UserBankAccount.updateMany(
        { userId: session.user.id, _id: { $ne: id } },
        { isDefault: false }
      );
      account.isDefault = true;
    } else if (setAsDefault === false && account.isDefault) {
      // If unsetting default, check if there's another account to make default
      const otherAccount = await UserBankAccount.findOne({
        userId: session.user.id,
        _id: { $ne: id },
        isActive: true,
      });
      if (otherAccount) {
        account.isDefault = false;
        otherAccount.isDefault = true;
        await otherAccount.save();
      }
      // If no other account, keep this as default
    }

    await account.save();

    console.log(`✅ Bank account ${id} updated for user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Bank account updated successfully',
      account: {
        id: account._id,
        accountHolderName: account.accountHolderName,
        bankName: account.bankName,
        country: account.country,
        ibanLast4: account.ibanLast4,
        swiftBic: account.swiftBic,
        nickname: account.nickname,
        isDefault: account.isDefault,
      },
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bank account' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wallet/bank-accounts/[id]
 * Remove a bank account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const account = await UserBankAccount.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // Check if there are pending withdrawals using this account
    const WithdrawalRequest = (await import('@/database/models/withdrawal-request.model')).default;
    const pendingWithdrawals = await WithdrawalRequest.countDocuments({
      userId: session.user.id,
      'bankDetails.iban': account.iban,
      status: { $in: ['pending', 'approved', 'processing'] },
    });

    if (pendingWithdrawals > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove bank account with pending withdrawals' },
        { status: 400 }
      );
    }

    // Soft delete - mark as inactive
    account.isActive = false;
    account.isDefault = false;
    await account.save();

    // If this was the default, set another account as default
    if (account.isDefault) {
      const otherAccount = await UserBankAccount.findOne({
        userId: session.user.id,
        _id: { $ne: id },
        isActive: true,
      });
      if (otherAccount) {
        otherAccount.isDefault = true;
        await otherAccount.save();
      }
    }

    console.log(`🗑️ Bank account ${id} removed for user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Bank account removed',
    });
  } catch (error) {
    console.error('Error removing bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove bank account' },
      { status: 500 }
    );
  }
}

