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
  } catch (error: any) {
    console.error('❌ Error fetching holidays:', error);
    
    return NextResponse.json({
      holidays: [],
      error: error.message
    }, { status: 500 });
  }
}

