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
 * Get standard market holidays for the current and next year
 * These are well-known holidays that affect major forex/stock markets
 */
function getStandardMarketHolidays(): CombinedHoliday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;
  
  // Define standard holidays (month is 0-indexed)
  const holidayDefinitions = [
    // Universal Holidays
    { name: "New Year's Day", month: 0, day: 1, exchange: 'FOREX' },
    { name: "Christmas Day", month: 11, day: 25, exchange: 'FOREX' },
    { name: "Boxing Day", month: 11, day: 26, exchange: 'FOREX' },
    
    // US Stock Market Holidays (NYSE/NASDAQ)
    { name: "Martin Luther King Jr. Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 0, 1, 3), exchange: 'NYSE' },
    { name: "Presidents Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 1, 1, 3), exchange: 'NYSE' },
    { name: "Good Friday", getDate: (year: number) => getEasterDate(year, -2), exchange: 'NYSE' },
    { name: "Easter Monday", getDate: (year: number) => getEasterDate(year, 1), exchange: 'FOREX' },
    { name: "Memorial Day", getDate: (year: number) => getLastWeekdayOfMonth(year, 4, 1), exchange: 'NYSE' },
    { name: "Juneteenth", month: 5, day: 19, exchange: 'NYSE' },
    { name: "Independence Day", month: 6, day: 4, exchange: 'NYSE' },
    { name: "Labor Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 8, 1, 1), exchange: 'NYSE' },
    { name: "Thanksgiving Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 10, 4, 4), exchange: 'NYSE' },
    
    // UK Market Holidays (LSE)
    { name: "Early May Bank Holiday", getDate: (year: number) => getNthWeekdayOfMonth(year, 4, 1, 1), exchange: 'LSE' },
    { name: "Spring Bank Holiday", getDate: (year: number) => getLastWeekdayOfMonth(year, 4, 1), exchange: 'LSE' },
    { name: "Summer Bank Holiday", getDate: (year: number) => getLastWeekdayOfMonth(year, 7, 1), exchange: 'LSE' },
  ];
  
  const holidays: CombinedHoliday[] = [];
  
  for (const year of [currentYear, nextYear]) {
    for (const def of holidayDefinitions) {
      let holidayDate: Date;
      
      if ('getDate' in def && def.getDate) {
        holidayDate = def.getDate(year);
      } else if ('month' in def && 'day' in def) {
        holidayDate = new Date(year, def.month, def.day);
      } else {
        continue;
      }
      
      holidayDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only include holidays from today onwards (within next 365 days)
      if (daysUntil >= 0 && daysUntil <= 365) {
        const dateStr = holidayDate.toISOString().split('T')[0];
        holidays.push({
          id: `auto_${dateStr}_${def.exchange}`,
          name: def.name,
          date: dateStr,
          type: 'automatic',
          exchange: def.exchange,
          status: 'closed',
          daysUntil,
        });
      }
    }
  }
  
  // Sort by date
  holidays.sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));
  
  // Remove duplicates (same date and name)
  const seen = new Set<string>();
  return holidays.filter(h => {
    const key = `${h.date}_${h.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let dayOffset = weekday - firstWeekday;
  if (dayOffset < 0) dayOffset += 7;
  const day = 1 + dayOffset + (n - 1) * 7;
  return new Date(year, month, day);
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekday = lastDay.getDay();
  let dayOffset = lastWeekday - weekday;
  if (dayOffset < 0) dayOffset += 7;
  return new Date(year, month + 1, -dayOffset);
}

function getEasterDate(year: number, offset: number = 0): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month, day + offset);
  return easter;
}

/**
 * GET /api/trading/market-holidays
 * Fetch market holidays - returns both automatic (standard calendar) and manual (admin-set) holidays
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
    
    // Get automatic holidays (standard market calendar)
    if (includeAutomatic && mode === 'automatic') {
      const automaticHolidays = getStandardMarketHolidays();
      allHolidays.push(...automaticHolidays);
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
