import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import AdminBankAccount from '@/database/models/admin-bank-account.model';
import { getAdminSession } from '@/lib/admin-auth';

/**
 * GET /api/admin-bank-accounts/[id]
 * Get a specific bank account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    
    const account = await AdminBankAccount.findById(id);
    
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account,
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
 * PUT /api/admin-bank-accounts/[id]
 * Update a bank account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
      isActive,
      notes,
    } = body;

    // If setting as default, unset all others first
    if (isDefault) {
      await AdminBankAccount.updateMany(
        { _id: { $ne: id } },
        { isDefault: false }
      );
    }

    const account = await AdminBankAccount.findByIdAndUpdate(
      id,
      {
        accountName,
        accountHolderName,
        bankName,
        country: country?.toUpperCase(),
        currency: currency?.toLowerCase(),
        iban: iban?.toUpperCase(),
        accountNumber,
        routingNumber,
        swiftBic: swiftBic?.toUpperCase(),
        isDefault,
        isActive,
        notes,
      },
      { new: true }
    );

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account,
      message: 'Bank account updated successfully',
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
 * DELETE /api/admin-bank-accounts/[id]
 * Delete a bank account (soft delete - set inactive)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    
    const account = await AdminBankAccount.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // If we deleted the default, make another one default
    if (account.isDefault) {
      const newDefault = await AdminBankAccount.findOne({ isActive: true });
      if (newDefault) {
        newDefault.isDefault = true;
        await newDefault.save();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bank account' },
      { status: 500 }
    );
  }
}

