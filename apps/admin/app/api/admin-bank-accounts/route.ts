import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import AdminBankAccount from '@/database/models/admin-bank-account.model';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * GET /api/admin-bank-accounts
 * Get all admin/company bank accounts
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const accounts = await AdminBankAccount.find({ isActive: true })
      .sort({ isDefault: -1, accountName: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error('Error fetching admin bank accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin-bank-accounts
 * Add a new admin/company bank account
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    const {
      accountName,
      accountHolderName,
      bankName,
      country,
      currency,
      iban,
      accountNumber,
      routingNumber,
      swiftBic,
      isDefault,
      notes,
    } = body;

    // Validate required fields
    if (!accountName || !accountHolderName || !bankName || !country) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If this is set as default, unset all others
    if (isDefault) {
      await AdminBankAccount.updateMany({}, { isDefault: false });
    }

    const account = new AdminBankAccount({
      accountName,
      accountHolderName,
      bankName,
      country: country.toUpperCase(),
      currency: currency?.toLowerCase() || 'eur',
      iban: iban?.toUpperCase(),
      accountNumber,
      routingNumber,
      swiftBic: swiftBic?.toUpperCase(),
      isDefault: isDefault || false,
      isActive: true,
      notes,
      addedBy: session.email,
    });

    await account.save();

    return NextResponse.json({
      success: true,
      account,
      message: 'Bank account added successfully',
    });
  } catch (error) {
    console.error('Error adding admin bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add bank account' },
      { status: 500 }
    );
  }
}

