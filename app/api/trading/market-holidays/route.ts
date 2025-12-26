import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingHolidays as getAutomaticHolidays, MarketHoliday } from '@/lib/services/real-forex-prices.service';
import { getUpcomingHolidays as getManualHolidays } from '@/lib/services/market-hours.service';
import { connectToDatabase } from '@/database/mongoose';
import MarketSettings from '@/database/models/market-settings.model';

export const dynamic = 'force-dynamic';

interface CombinedHoliday {
  id: string;
  name: string;
  date: string;
  type: 'automatic' | 'manual';
  affectedAssets?: string[];
  exchange?: string;
  status?: string;
  isRecurring?: boolean;
  daysUntil?: number;
}

/**
 * GET /api/trading/market-holidays
 * Fetch market holidays - returns both automatic (from Massive.com API) and manual (admin-set) holidays
 * Query params:
 *   - includeAutomatic: boolean (default: true) - include API holidays
 *   - includeManual: boolean (default: true) - include admin-set holidays
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAutomatic = searchParams.get('includeAutomatic') !== 'false';
    const includeManual = searchParams.get('includeManual') !== 'false';
    
    await connectToDatabase();
    
    // Get market settings to determine mode
    const settings = await MarketSettings.findOne();
    const mode = settings?.mode || 'automatic';
    
    const allHolidays: CombinedHoliday[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get automatic holidays from Massive.com API
    if (includeAutomatic) {
      try {
        const automaticHolidays = await getAutomaticHolidays();
        
        for (const holiday of automaticHolidays) {
          const holidayDate = new Date(holiday.date);
          holidayDate.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only include current or future holidays
          if (daysUntil >= 0) {
            allHolidays.push({
              id: `auto_${holiday.date}_${holiday.exchange}`,
              name: holiday.name,
              date: holiday.date,
              type: 'automatic',
              exchange: holiday.exchange,
              status: holiday.status,
              daysUntil,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching automatic holidays:', error);
      }
    }
    
    // Get manual holidays from admin settings
    if (includeManual && settings?.holidays) {
      for (const holiday of settings.holidays) {
        let holidayDate: Date;
        let displayDate = holiday.date;
        
        if (holiday.isRecurring) {
          // For recurring, calculate next occurrence
          const [, month, day] = holiday.date.split('-').map(Number);
          const thisYearDate = new Date(today.getFullYear(), month - 1, day);
          
          if (thisYearDate < today) {
            // Already passed this year, show next year
            holidayDate = new Date(today.getFullYear() + 1, month - 1, day);
            displayDate = `${today.getFullYear() + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else {
            holidayDate = thisYearDate;
            displayDate = `${today.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        } else {
          holidayDate = new Date(holiday.date);
        }
        
        holidayDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only include current or future holidays (or recurring)
        if (daysUntil >= 0 || holiday.isRecurring) {
          allHolidays.push({
            id: String(holiday._id || `manual_${holiday.date}`),
            name: holiday.name,
            date: displayDate,
            type: 'manual',
            affectedAssets: holiday.affectedAssets,
            isRecurring: holiday.isRecurring,
            daysUntil: daysUntil >= 0 ? daysUntil : undefined,
          });
        }
      }
    }
    
    // Sort by date (closest first)
    allHolidays.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    return NextResponse.json({ 
      holidays: allHolidays,
      mode,
      totalAutomatic: allHolidays.filter(h => h.type === 'automatic').length,
      totalManual: allHolidays.filter(h => h.type === 'manual').length,
    });
  } catch (error) {
    console.error('❌ Error fetching holidays:', error);
    
    return NextResponse.json({
      holidays: [],
      mode: 'manual',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
