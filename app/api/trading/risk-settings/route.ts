import { NextResponse } from 'next/server';
import { getTradingRiskSettings } from '@/lib/actions/trading/risk-settings.actions';

/**
 * Public API to get current trading risk settings
 * Used by client components to poll for updates
 * NO AUTHENTICATION REQUIRED - these are public platform settings
 */
export async function GET() {
  try {
    const settings = await getTradingRiskSettings();

    return NextResponse.json(
      {
        success: true,
        settings,
      },
      {
        headers: {
          // Disable caching - always get fresh data
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching risk settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch risk settings',
      },
      { status: 500 }
    );
  }
}

