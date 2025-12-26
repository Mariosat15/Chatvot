import { NextRequest, NextResponse } from 'next/server';
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
 * Fetch market holidays from database
 * In automatic mode: Returns both template holidays and custom holidays
 * In manual mode: Returns only custom holidays (template holidays are ignored)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get market settings
    const settings = await MarketSettings.findOne();
    const mode = settings?.mode || 'automatic';
    
    const allHolidays: CombinedHoliday[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get holidays from settings
    if (settings?.holidays) {
      for (const holiday of settings.holidays) {
        // In manual mode, skip template holidays - only show custom holidays
        if (mode === 'manual' && holiday.isTemplate) {
          continue;
        }
        
        let holidayDate: Date;
        let displayDate = holiday.date;
        
        if (holiday.isRecurring) {
          // For recurring, calculate next occurrence
          const [, month, day] = holiday.date.split('-').map(Number);
          const thisYearDate = new Date(today.getFullYear(), month - 1, day);
          
          if (thisYearDate < today) {
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
        
        // Only include current or future holidays
        if (daysUntil >= 0) {
          allHolidays.push({
            id: String(holiday._id || `holiday_${holiday.date}`),
            name: holiday.name,
            date: displayDate,
            type: holiday.isTemplate ? 'automatic' : 'manual',
            affectedAssets: holiday.affectedAssets,
            isRecurring: holiday.isRecurring,
            daysUntil,
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
    
    // Remove duplicates by date+name
    const seen = new Set<string>();
    const uniqueHolidays = allHolidays.filter(h => {
      const key = `${h.date}_${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return NextResponse.json({ 
      holidays: uniqueHolidays,
      mode,
      totalAutomatic: uniqueHolidays.filter(h => h.type === 'automatic').length,
      totalManual: uniqueHolidays.filter(h => h.type === 'manual').length,
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
