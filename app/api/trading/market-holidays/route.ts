import { NextResponse } from 'next/server';
import { getUpcomingHolidays } from '@/lib/services/real-forex-prices.service';

/**
 * GET /api/trading/market-holidays
 * Fetch upcoming market holidays from Massive.com API
 */
export async function GET() {
  try {
    const holidays = await getUpcomingHolidays();
    return NextResponse.json({ holidays });
  } catch (error) {
    console.error('❌ Error fetching holidays:', error);
    
    return NextResponse.json({
      holidays: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

