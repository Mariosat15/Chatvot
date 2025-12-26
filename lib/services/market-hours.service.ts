import { connectToDatabase } from '@/database/mongoose';
import MarketSettings, { IMarketSettings, IMarketHoliday } from '@/database/models/market-settings.model';
import { getMarketStatusFromAPI, isForexMarketOpen as isForexMarketOpenAPI } from './real-forex-prices.service';

type AssetClass = 'forex' | 'crypto' | 'stocks' | 'indices' | 'commodities';
type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

// Cache for settings
let settingsCache: { settings: IMarketSettings; timestamp: number } | null = null;
const SETTINGS_CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Get market settings from database (with caching)
 */
async function getMarketSettings(): Promise<IMarketSettings | null> {
  // Check cache
  if (settingsCache && (Date.now() - settingsCache.timestamp) < SETTINGS_CACHE_DURATION) {
    return settingsCache.settings;
  }

  try {
    await connectToDatabase();
    let settings = await MarketSettings.findOne();
    if (!settings) {
      settings = await MarketSettings.create({});
    }
    
    settingsCache = { settings, timestamp: Date.now() };
    return settings;
  } catch (error) {
    console.error('Error fetching market settings:', error);
    return null;
  }
}

/**
 * Get current day of week in UTC
 */
function getCurrentDayUTC(): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getUTCDay()];
}

/**
 * Get current time in UTC as HH:MM string
 */
function getCurrentTimeUTC(): string {
  const now = new Date();
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Check if current time is within a time range
 */
function isWithinTimeRange(currentTime: string, openTime: string, closeTime: string): boolean {
  // Handle overnight ranges (e.g., 22:00 to 02:00)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Check if today is a holiday for the given asset class
 */
function isTodayHoliday(holidays: IMarketHoliday[], assetClass: AssetClass): boolean {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayMonthDay = todayStr.slice(5); // MM-DD for recurring check

  for (const holiday of holidays) {
    // Check if this holiday affects this asset class
    if (!holiday.affectedAssets.includes(assetClass)) {
      continue;
    }

    if (holiday.isRecurring) {
      // For recurring holidays, just check month and day
      const holidayMonthDay = holiday.date.slice(5);
      if (holidayMonthDay === todayMonthDay) {
        return true;
      }
    } else {
      // For non-recurring, check exact date
      if (holiday.date === todayStr) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if market is open for a specific asset class
 * Uses admin-configured settings (automatic API or manual schedules)
 */
export async function isMarketOpen(assetClass: AssetClass = 'forex'): Promise<{
  isOpen: boolean;
  reason?: string;
  isHoliday?: boolean;
  holidayName?: string;
}> {
  const settings = await getMarketSettings();
  
  // Fallback if no settings
  if (!settings) {
    console.warn('No market settings found, using API fallback');
    const apiOpen = await isForexMarketOpenAPI();
    return { isOpen: apiOpen };
  }

  // Check holidays first (applies to both modes)
  if (settings.blockTradingOnHolidays) {
    const holiday = getTodayHoliday(settings.holidays, assetClass);
    if (holiday) {
      return {
        isOpen: false,
        reason: `Market closed for ${holiday.name}`,
        isHoliday: true,
        holidayName: holiday.name,
      };
    }
  }

  // Automatic mode - use Massive.com API
  if (settings.mode === 'automatic') {
    try {
      const status = await getMarketStatusFromAPI();
      return {
        isOpen: status.isOpen,
        reason: status.isOpen ? undefined : 'Market is currently closed',
      };
    } catch (error) {
      // If API fails and fallback is enabled, use manual settings
      if (settings.automaticSettings.fallbackToManual) {
        console.log('API failed, falling back to manual settings');
        return checkManualSchedule(settings, assetClass);
      }
      
      // Otherwise, return closed as a safety measure
      return {
        isOpen: false,
        reason: 'Unable to determine market status',
      };
    }
  }

  // Manual mode - use configured schedules
  return checkManualSchedule(settings, assetClass);
}

/**
 * Check market status using manual schedule settings
 */
function checkManualSchedule(settings: IMarketSettings, assetClass: AssetClass): {
  isOpen: boolean;
  reason?: string;
} {
  const schedule = settings.assetSchedules[assetClass];
  
  // Check if asset class is enabled
  if (!schedule || !schedule.enabled) {
    return {
      isOpen: false,
      reason: `${assetClass} trading is disabled`,
    };
  }

  // Get current day and time
  const currentDay = getCurrentDayUTC();
  const currentTime = getCurrentTimeUTC();
  const daySchedule = schedule[currentDay];

  // Check if trading is enabled for this day
  if (!daySchedule || !daySchedule.enabled) {
    return {
      isOpen: false,
      reason: `Market is closed on ${currentDay}`,
    };
  }

  // Check if within trading hours
  if (!isWithinTimeRange(currentTime, daySchedule.openTime, daySchedule.closeTime)) {
    return {
      isOpen: false,
      reason: `Market is closed. Trading hours: ${daySchedule.openTime} - ${daySchedule.closeTime} UTC`,
    };
  }

  return { isOpen: true };
}

/**
 * Get today's holiday if any
 */
function getTodayHoliday(holidays: IMarketHoliday[], assetClass: AssetClass): IMarketHoliday | null {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayMonthDay = todayStr.slice(5);

  for (const holiday of holidays) {
    if (!holiday.affectedAssets.includes(assetClass)) {
      continue;
    }

    if (holiday.isRecurring) {
      const holidayMonthDay = holiday.date.slice(5);
      if (holidayMonthDay === todayMonthDay) {
        return holiday;
      }
    } else {
      if (holiday.date === todayStr) {
        return holiday;
      }
    }
  }

  return null;
}

/**
 * Check if competitions should be blocked
 */
export async function canJoinCompetition(): Promise<{
  canJoin: boolean;
  reason?: string;
}> {
  const settings = await getMarketSettings();
  
  if (!settings) {
    return { canJoin: true };
  }

  if (settings.blockCompetitionsOnHolidays) {
    const holiday = getTodayHoliday(settings.holidays, 'forex');
    if (holiday) {
      return {
        canJoin: false,
        reason: `Competition entry blocked due to market holiday: ${holiday.name}`,
      };
    }
  }

  const marketStatus = await isMarketOpen('forex');
  if (!marketStatus.isOpen && settings.blockCompetitionsOnHolidays) {
    return {
      canJoin: false,
      reason: marketStatus.reason || 'Market is closed',
    };
  }

  return { canJoin: true };
}

/**
 * Check if challenges should be blocked
 */
export async function canJoinChallenge(): Promise<{
  canJoin: boolean;
  reason?: string;
}> {
  const settings = await getMarketSettings();
  
  if (!settings) {
    return { canJoin: true };
  }

  if (settings.blockChallengesOnHolidays) {
    const holiday = getTodayHoliday(settings.holidays, 'forex');
    if (holiday) {
      return {
        canJoin: false,
        reason: `Challenge entry blocked due to market holiday: ${holiday.name}`,
      };
    }
  }

  const marketStatus = await isMarketOpen('forex');
  if (!marketStatus.isOpen && settings.blockChallengesOnHolidays) {
    return {
      canJoin: false,
      reason: marketStatus.reason || 'Market is closed',
    };
  }

  return { canJoin: true };
}

/**
 * Get upcoming holidays for display
 */
export async function getUpcomingHolidays(assetClass?: AssetClass): Promise<IMarketHoliday[]> {
  const settings = await getMarketSettings();
  
  if (!settings) {
    return [];
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return settings.holidays
    .filter(h => {
      // Filter by asset class if specified
      if (assetClass && !h.affectedAssets.includes(assetClass)) {
        return false;
      }

      // For recurring, always include
      if (h.isRecurring) {
        return true;
      }

      // For non-recurring, only include future dates
      return h.date >= todayStr;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = a.isRecurring ? `9999-${a.date.slice(5)}` : a.date;
      const dateB = b.isRecurring ? `9999-${b.date.slice(5)}` : b.date;
      return dateA.localeCompare(dateB);
    });
}

/**
 * Check if holiday warning should be shown
 */
export async function shouldShowHolidayWarning(): Promise<{
  show: boolean;
  holiday?: IMarketHoliday;
}> {
  const settings = await getMarketSettings();
  
  if (!settings || !settings.showHolidayWarning) {
    return { show: false };
  }

  const holiday = getTodayHoliday(settings.holidays, 'forex');
  return {
    show: !!holiday,
    holiday: holiday || undefined,
  };
}

/**
 * Clear settings cache (for admin updates)
 */
export function clearMarketSettingsCache(): void {
  settingsCache = null;
}

