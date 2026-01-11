import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import MarketSettings from '@/database/models/market-settings.model';

interface TemplateHoliday {
  name: string;
  date: string;
  affectedAssets: ('forex' | 'crypto' | 'stocks' | 'indices' | 'commodities')[];
  isRecurring: boolean;
  isTemplate: boolean;
}

/**
 * Generate standard market holidays template
 * These are recurring yearly holidays that affect major markets
 */
function generateTemplateHolidays(): TemplateHoliday[] {
  const currentYear = new Date().getFullYear();
  
  // Helper functions for variable dates
  function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    let dayOffset = weekday - firstWeekday;
    if (dayOffset < 0) dayOffset += 7;
    const day = 1 + dayOffset + (n - 1) * 7;
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
  }

  function getLastWeekdayOfMonth(year: number, month: number, weekday: number): string {
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    let dayOffset = lastWeekday - weekday;
    if (dayOffset < 0) dayOffset += 7;
    const date = new Date(year, month + 1, -dayOffset);
    return date.toISOString().split('T')[0];
  }

  function getEasterDate(year: number, offset: number = 0): string {
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
    return easter.toISOString().split('T')[0];
  }

  const holidays: TemplateHoliday[] = [];

  // Generate for current and next year
  for (const year of [currentYear, currentYear + 1]) {
    // Fixed date holidays (recurring)
    holidays.push({
      name: "New Year's Day",
      date: `${year}-01-01`,
      affectedAssets: ['forex', 'stocks', 'indices'],
      isRecurring: true,
      isTemplate: true,
    });

    holidays.push({
      name: "Christmas Day",
      date: `${year}-12-25`,
      affectedAssets: ['forex', 'stocks', 'indices'],
      isRecurring: true,
      isTemplate: true,
    });

    holidays.push({
      name: "Boxing Day",
      date: `${year}-12-26`,
      affectedAssets: ['forex', 'stocks'],
      isRecurring: true,
      isTemplate: true,
    });

    holidays.push({
      name: "Independence Day (US)",
      date: `${year}-07-04`,
      affectedAssets: ['stocks', 'indices'],
      isRecurring: true,
      isTemplate: true,
    });

    holidays.push({
      name: "Juneteenth (US)",
      date: `${year}-06-19`,
      affectedAssets: ['stocks', 'indices'],
      isRecurring: true,
      isTemplate: true,
    });

    // Variable date holidays
    holidays.push({
      name: "Martin Luther King Jr. Day",
      date: getNthWeekdayOfMonth(year, 0, 1, 3), // 3rd Monday of January
      affectedAssets: ['stocks', 'indices'],
      isRecurring: false, // Date changes each year
      isTemplate: true,
    });

    holidays.push({
      name: "Presidents Day",
      date: getNthWeekdayOfMonth(year, 1, 1, 3), // 3rd Monday of February
      affectedAssets: ['stocks', 'indices'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Good Friday",
      date: getEasterDate(year, -2),
      affectedAssets: ['forex', 'stocks', 'indices'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Easter Monday",
      date: getEasterDate(year, 1),
      affectedAssets: ['forex', 'stocks'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Memorial Day",
      date: getLastWeekdayOfMonth(year, 4, 1), // Last Monday of May
      affectedAssets: ['stocks', 'indices'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Labor Day",
      date: getNthWeekdayOfMonth(year, 8, 1, 1), // 1st Monday of September
      affectedAssets: ['stocks', 'indices'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Thanksgiving Day",
      date: getNthWeekdayOfMonth(year, 10, 4, 4), // 4th Thursday of November
      affectedAssets: ['stocks', 'indices'],
      isRecurring: false,
      isTemplate: true,
    });

    // UK Holidays
    holidays.push({
      name: "Early May Bank Holiday (UK)",
      date: getNthWeekdayOfMonth(year, 4, 1, 1), // 1st Monday of May
      affectedAssets: ['stocks'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Spring Bank Holiday (UK)",
      date: getLastWeekdayOfMonth(year, 4, 1), // Last Monday of May
      affectedAssets: ['stocks'],
      isRecurring: false,
      isTemplate: true,
    });

    holidays.push({
      name: "Summer Bank Holiday (UK)",
      date: getLastWeekdayOfMonth(year, 7, 1), // Last Monday of August
      affectedAssets: ['stocks'],
      isRecurring: false,
      isTemplate: true,
    });
  }

  // Filter to only future holidays and remove duplicates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seen = new Set<string>();
  return holidays
    .filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate >= today;
    })
    .filter(h => {
      const key = `${h.date}_${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * GET /api/market-settings/template-holidays
 * Get the template holidays that would be added
 */
export async function GET() {
  try {
    const templateHolidays = generateTemplateHolidays();
    
    return NextResponse.json({
      holidays: templateHolidays,
      count: templateHolidays.length,
      description: 'Standard market holidays that can be added to your calendar'
    });
  } catch (error) {
    console.error('Error generating template holidays:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}

/**
 * POST /api/market-settings/template-holidays
 * Populate template holidays into the market settings
 */
export async function POST() {
  try {
    await connectToDatabase();
    
    let settings = await MarketSettings.findOne();
    if (!settings) {
      settings = await MarketSettings.create({});
    }

    // Remove existing template holidays
    settings.holidays = settings.holidays.filter((h: { isTemplate?: boolean }) => !h.isTemplate);
    
    // Add new template holidays
    const templateHolidays = generateTemplateHolidays();
    settings.holidays.push(...templateHolidays);
    
    await settings.save();

    return NextResponse.json({
      success: true,
      message: `Added ${templateHolidays.length} template holidays`,
      totalHolidays: settings.holidays.length,
      templateCount: templateHolidays.length,
      customCount: settings.holidays.filter((h: { isTemplate?: boolean }) => !h.isTemplate).length
    });
  } catch (error) {
    console.error('Error populating template holidays:', error);
    return NextResponse.json({ error: 'Failed to populate template' }, { status: 500 });
  }
}

/**
 * DELETE /api/market-settings/template-holidays
 * Remove all template holidays from settings
 */
export async function DELETE() {
  try {
    await connectToDatabase();
    
    const settings = await MarketSettings.findOne();
    if (!settings) {
      return NextResponse.json({ success: true, message: 'No settings found' });
    }

    const templateCount = settings.holidays.filter((h: { isTemplate?: boolean }) => h.isTemplate).length;
    
    // Remove template holidays, keep custom ones
    settings.holidays = settings.holidays.filter((h: { isTemplate?: boolean }) => !h.isTemplate);
    await settings.save();

    return NextResponse.json({
      success: true,
      message: `Removed ${templateCount} template holidays`,
      remainingHolidays: settings.holidays.length
    });
  } catch (error) {
    console.error('Error clearing template holidays:', error);
    return NextResponse.json({ error: 'Failed to clear template' }, { status: 500 });
  }
}

