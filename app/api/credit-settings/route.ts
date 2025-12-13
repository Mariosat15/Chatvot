import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import { unstable_noStore as noStore } from 'next/cache';

// Public endpoint to get credit conversion settings (for display purposes)
export async function GET() {
  noStore();
  
  try {
    await connectToDatabase();
    const settings = await CreditConversionSettings.getSingleton();

    return NextResponse.json({
      success: true,
      rate: settings.eurToCreditsRate,
      minimumDeposit: settings.minimumDeposit,
      minimumWithdrawal: settings.minimumWithdrawal,
      withdrawalFeePercentage: settings.withdrawalFeePercentage,
    });
  } catch (error) {
    console.error('Error fetching credit settings:', error);
    return NextResponse.json(
      { 
        success: false,
        rate: 100, // Fallback
        minimumDeposit: 10,
        minimumWithdrawal: 20,
        withdrawalFeePercentage: 2,
      },
      { status: 200 } // Still return 200 with defaults
    );
  }
}

