import { NextResponse } from 'next/server';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE_URL = 'https://api.massive.com/v1';

interface MarketStatus {
  isOpen: boolean;
  status: string;
  serverTime: string;
  message: string;
}

interface MarketHoliday {
  date: string;
  name: string;
  exchange: string;
  status: string;
  open?: string;
  close?: string;
}

interface MarketStatusResponse {
  currentStatus: MarketStatus;
  upcomingHolidays: MarketHoliday[];
  canCreateCompetition: boolean;
  canCreateChallenge: boolean;
  warnings: string[];
}

/**
 * Fetch current market status from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 */
async function getMarketStatus(): Promise<MarketStatus> {
  if (!MASSIVE_API_KEY) {
    // Fallback to time-based detection
    return getMarketStatusFallback();
  }

  try {
    const url = `${MASSIVE_API_BASE_URL}/marketstatus/now?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(`Market status API failed: ${response.status}`);
      return getMarketStatusFallback();
    }

    const data = await response.json();
    const fxStatus = data?.currencies?.fx || 'unknown';
    const isOpen = fxStatus.toLowerCase() === 'open';
    
    return {
      isOpen,
      status: fxStatus,
      serverTime: data?.serverTime || new Date().toISOString(),
      message: isOpen ? 'Forex market is open' : 'Forex market is closed'
    };
  } catch (error) {
    console.error('Error fetching market status:', error);
    return getMarketStatusFallback();
  }
}

/**
 * Fetch upcoming market holidays from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-holidays
 */
async function getUpcomingHolidays(): Promise<MarketHoliday[]> {
  if (!MASSIVE_API_KEY) {
    return [];
  }

  try {
    const url = `${MASSIVE_API_BASE_URL}/marketstatus/upcoming?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Holidays API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Filter for forex-related holidays
    const holidays = (data?.response || []).filter((h: MarketHoliday) => 
      h.exchange?.toLowerCase().includes('forex') || 
      h.exchange?.toLowerCase().includes('fx') ||
      h.exchange?.toLowerCase().includes('currency')
    );
    
    return holidays;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
}

/**
 * Fallback market status based on forex trading hours
 * Forex market: Sunday 5pm EST - Friday 5pm EST
 */
function getMarketStatusFallback(): MarketStatus {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();

  // Convert to EST (UTC-5, or UTC-4 during DST)
  // Simplified: Forex is closed from Friday 10pm UTC to Sunday 10pm UTC
  let isOpen = true;
  let message = 'Forex market is open';

  // Saturday = completely closed
  if (utcDay === 6) {
    isOpen = false;
    message = 'Forex market is closed (Weekend - Saturday)';
  }
  // Sunday before 10pm UTC = closed
  else if (utcDay === 0 && utcHour < 22) {
    isOpen = false;
    message = 'Forex market is closed (Weekend - Sunday, opens at 10pm UTC)';
  }
  // Friday after 10pm UTC = closed
  else if (utcDay === 5 && utcHour >= 22) {
    isOpen = false;
    message = 'Forex market is closed (Weekend - Friday close)';
  }

  return {
    isOpen,
    status: isOpen ? 'open' : 'closed',
    serverTime: now.toISOString(),
    message
  };
}

/**
 * Check if a date range overlaps with any holidays
 */
function checkHolidayOverlap(startDate: Date, endDate: Date, holidays: MarketHoliday[]): string[] {
  const warnings: string[] = [];
  
  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);
    
    // Check if holiday falls within competition/challenge dates
    if (holidayDate >= startDate && holidayDate <= endDate) {
      if (holiday.status === 'closed') {
        warnings.push(`⚠️ Market closed on ${holiday.date} for ${holiday.name}`);
      } else if (holiday.status === 'early-close' || holiday.close) {
        warnings.push(`⚠️ Early market close on ${holiday.date} for ${holiday.name}`);
      }
    }
  }
  
  return warnings;
}

/**
 * GET /api/market-status
 * Returns current market status and upcoming holidays
 * Query params:
 *   - startDate: ISO date string for competition/challenge start
 *   - endDate: ISO date string for competition/challenge end
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Fetch market status and holidays in parallel
    const [currentStatus, upcomingHolidays] = await Promise.all([
      getMarketStatus(),
      getUpcomingHolidays()
    ]);

    const warnings: string[] = [];
    let canCreateCompetition = true;
    let canCreateChallenge = true;

    // If market is currently closed, warn but allow creation (for future dates)
    if (!currentStatus.isOpen) {
      warnings.push(`ℹ️ ${currentStatus.message}`);
    }

    // Check for holiday overlaps if dates provided
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      const holidayWarnings = checkHolidayOverlap(startDate, endDate, upcomingHolidays);
      warnings.push(...holidayWarnings);
      
      // If there are closed holidays during the competition, warn but allow
      if (holidayWarnings.some(w => w.includes('Market closed'))) {
        warnings.push('⚠️ Competition/Challenge includes market closure days');
      }
    }

    // For challenges (instant start), check if market is currently open
    if (!currentStatus.isOpen) {
      canCreateChallenge = false;
      warnings.push('❌ Cannot create instant challenges while market is closed');
    }

    const response: MarketStatusResponse = {
      currentStatus,
      upcomingHolidays,
      canCreateCompetition,
      canCreateChallenge,
      warnings
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in market-status API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market status' },
      { status: 500 }
    );
  }
}

