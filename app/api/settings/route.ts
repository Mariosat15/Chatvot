import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import AppSettings from '@/database/models/app-settings.model';

// GET - Fetch app settings (public endpoint)
export async function GET() {
  try {
    await connectToDatabase();
    
    let settings = await AppSettings.findById('app-settings');
    
    // Create default settings if none exist
    if (!settings) {
      settings = await AppSettings.create({
        _id: 'app-settings',
        currency: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          exchangeRateToEUR: 1.0,
        },
        credits: {
          name: 'Volt Credits',
          symbol: '⚡',
          icon: 'zap',
          valueInEUR: 1.0,
          showEUREquivalent: true,
          decimals: 2,
        },
        transactions: {
          minimumDeposit: 10,
          minimumWithdrawal: 20,
          withdrawalFeePercentage: 2,
        },
        branding: {
          primaryColor: '#EAB308',
          accentColor: '#F59E0B',
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
    });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

