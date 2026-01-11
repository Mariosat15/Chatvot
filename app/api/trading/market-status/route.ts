import { NextResponse } from 'next/server';
import { getMarketStatusFromAPI } from '@/lib/services/real-forex-prices.service';

/**
 * GET /api/trading/market-status
 * Fetch current market status from Massive.com API
 */
export async function GET() {
  try {
    const status = await getMarketStatusFromAPI();
    return NextResponse.json(status);
  } catch (error) {
    console.error('❌ Error fetching market status:', error);
    
    // Return fallback status
    return NextResponse.json({
      isOpen: false,
      status: 'unknown',
      serverTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

