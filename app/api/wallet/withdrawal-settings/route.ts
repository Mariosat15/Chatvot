import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import WithdrawalSettings from '@/database/models/withdrawal-settings.model';

/**
 * GET - Fetch withdrawal settings for the user
 * Returns only the settings that are relevant for the user to know (e.g., which methods are enabled)
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const settings = await WithdrawalSettings.getSingleton();
    
    // Return only the settings that users need to know about
    return NextResponse.json({
      bankWithdrawalsEnabled: settings.bankWithdrawalsEnabled ?? true,
      cardWithdrawalsEnabled: settings.cardWithdrawalsEnabled ?? true,
      minimumWithdrawal: settings.minimumWithdrawal,
      maximumWithdrawal: settings.maximumWithdrawal,
      processingTimeHours: settings.processingTimeHours,
      nuveiWithdrawalEnabled: settings.nuveiWithdrawalEnabled,
    });
  } catch (error) {
    console.error('Error fetching withdrawal settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal settings' },
      { status: 500 }
    );
  }
}

