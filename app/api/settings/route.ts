import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import AppSettings from '@/database/models/app-settings.model';
import { WhiteLabel } from '@/database/models/whitelabel.model';

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
    
    // Also fetch WhiteLabel settings for branding assets
    const whiteLabel = await WhiteLabel.findOne();
    
    // Merge branding assets into settings
    const mergedSettings = {
      ...JSON.parse(JSON.stringify(settings)),
      branding: {
        ...JSON.parse(JSON.stringify(settings)).branding,
        appLogo: whiteLabel?.appLogo || '/assets/images/logo.png',
        emailLogo: whiteLabel?.emailLogo || '/assets/images/logo.png',
        favicon: whiteLabel?.favicon || '/favicon.ico',
        profileImage: whiteLabel?.profileImage || '/assets/images/PROFILE.png',
      }
    };
    
    return NextResponse.json({
      success: true,
      settings: mergedSettings,
    });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

