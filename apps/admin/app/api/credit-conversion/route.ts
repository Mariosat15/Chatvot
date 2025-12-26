import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production'
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// GET: Fetch credit conversion settings
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const settings = await CreditConversionSettings.getSingleton();

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching credit conversion settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST: Update credit conversion settings
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    await connectToDatabase();
    
    const settings = await CreditConversionSettings.findOneAndUpdate(
      { _id: 'global-credit-conversion' },
      {
        eurToCreditsRate: data.eurToCreditsRate,
        minimumDeposit: data.minimumDeposit,
        minimumWithdrawal: data.minimumWithdrawal,
        withdrawalFeePercentage: data.withdrawalFeePercentage,
        lastUpdated: new Date(),
        updatedBy: admin.email as string || 'admin',
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Credit conversion settings updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Error updating credit conversion settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

