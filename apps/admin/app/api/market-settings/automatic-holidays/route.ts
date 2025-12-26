import { NextResponse } from 'next/server';

interface Holiday {
  id: string;
  name: string;
  date: string;
  exchange: string;
  status: string;
  daysUntil: number;
}

/**
 * Get standard market holidays for the current and next year
 * These are well-known holidays that affect major forex/stock markets
 */
function getStandardMarketHolidays(): Holiday[] {
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
    { name: "Martin Luther King Jr. Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 0, 1, 3), exchange: 'NYSE' }, // 3rd Monday of Jan
    { name: "Presidents Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 1, 1, 3), exchange: 'NYSE' }, // 3rd Monday of Feb
    { name: "Good Friday", getDate: (year: number) => getEasterDate(year, -2), exchange: 'NYSE' },
    { name: "Easter Monday", getDate: (year: number) => getEasterDate(year, 1), exchange: 'FOREX' },
    { name: "Memorial Day", getDate: (year: number) => getLastWeekdayOfMonth(year, 4, 1), exchange: 'NYSE' }, // Last Monday of May
    { name: "Juneteenth", month: 5, day: 19, exchange: 'NYSE' },
    { name: "Independence Day", month: 6, day: 4, exchange: 'NYSE' },
    { name: "Labor Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 8, 1, 1), exchange: 'NYSE' }, // 1st Monday of Sep
    { name: "Thanksgiving Day", getDate: (year: number) => getNthWeekdayOfMonth(year, 10, 4, 4), exchange: 'NYSE' }, // 4th Thursday of Nov
    
    // UK Market Holidays (LSE)
    { name: "Early May Bank Holiday", getDate: (year: number) => getNthWeekdayOfMonth(year, 4, 1, 1), exchange: 'LSE' }, // 1st Monday of May
    { name: "Spring Bank Holiday", getDate: (year: number) => getLastWeekdayOfMonth(year, 4, 1), exchange: 'LSE' }, // Last Monday of May
    { name: "Summer Bank Holiday", getDate: (year: number) => getLastWeekdayOfMonth(year, 7, 1), exchange: 'LSE' }, // Last Monday of Aug
  ];
  
  const holidays: Holiday[] = [];
  
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
          exchange: def.exchange,
          status: 'closed',
          daysUntil,
        });
      }
    }
  }
  
  // Sort by date
  holidays.sort((a, b) => a.daysUntil - b.daysUntil);
  
  // Remove duplicates (same date and name)
  const seen = new Set<string>();
  return holidays.filter(h => {
    const key = `${h.date}_${h.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get the nth occurrence of a weekday in a month
 * weekday: 0 = Sunday, 1 = Monday, etc.
 * n: 1 = first, 2 = second, etc.
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let dayOffset = weekday - firstWeekday;
  if (dayOffset < 0) dayOffset += 7;
  const day = 1 + dayOffset + (n - 1) * 7;
  return new Date(year, month, day);
}

/**
 * Get the last occurrence of a weekday in a month
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekday = lastDay.getDay();
  let dayOffset = lastWeekday - weekday;
  if (dayOffset < 0) dayOffset += 7;
  return new Date(year, month + 1, -dayOffset);
}

/**
 * Calculate Easter date using the Anonymous Gregorian algorithm
 * offset: 0 = Easter Sunday, -2 = Good Friday, 1 = Easter Monday
 */
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
 * GET /api/market-settings/automatic-holidays
 * Returns standard market holidays
 */
export async function GET() {
  try {
    const holidays = getStandardMarketHolidays();
    
    return NextResponse.json({ 
      holidays,
      source: 'Standard Market Calendar',
      description: 'Major forex and stock market holidays',
      lastUpdated: new Date().toISOString(),
      count: holidays.length
    });
  } catch (error) {
    console.error('Error generating holidays:', error);
    return NextResponse.json({ 
      holidays: [],
      error: error instanceof Error ? error.message : 'Failed to generate holidays'
    }, { status: 500 });
  }
}
