import { connectToDatabase } from "@/database/mongoose";
import MarketSettings, {
  IMarketSettings,
  IMarketHoliday,
} from "@/database/models/market-settings.model";
import {
  getMarketStatusFromAPI,
  isForexMarketOpen as isForexMarketOpenAPI,
} from "./real-forex-prices.service";

type AssetClass = "forex" | "crypto" | "stocks" | "indices" | "commodities";
type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

// Cache for settings - short duration for fast updates
let settingsCache: { settings: IMarketSettings; timestamp: number } | null =
  null;
const SETTINGS_CACHE_DURATION = 10 * 1000; // 10 seconds for quick updates

// Reason: Log-once tracker — prevents repeated identical log messages from
// spamming production logs. Each key is logged at most once per cooldown window.
const loggedOnce = new Map<string, number>();
const LOG_ONCE_COOLDOWN = 10 * 60 * 1000; // 10 minutes

function logOnce(key: string, message: string, level: "log" | "warn" = "log") {
  const now = Date.now();
  const last = loggedOnce.get(key) || 0;
  if (now - last < LOG_ONCE_COOLDOWN) return;
  loggedOnce.set(key, now);
  if (level === "warn") console.warn(message);
  else console.log(message);
}

/**
 * Get market settings from database (with caching)
 */
async function getMarketSettings(): Promise<IMarketSettings | null> {
  // Check cache
  if (
    settingsCache &&
    Date.now() - settingsCache.timestamp < SETTINGS_CACHE_DURATION
  ) {
    return settingsCache.settings;
  }

  try {
    await connectToDatabase();
    let settings = await MarketSettings.findOne().lean();
    if (!settings) {
      settings = await MarketSettings.create({});
    }

    settingsCache = { settings, timestamp: Date.now() };
    return settings;
  } catch (error) {
    console.error("❌ [Market Hours] Error fetching market settings:", error);
    return null;
  }
}

/**
 * Get current day of week in UTC
 */
function getCurrentDayUTC(): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date().getUTCDay()];
}

/**
 * Get current time in UTC as HH:MM string
 */
function getCurrentTimeUTC(): string {
  const now = new Date();
  const hours = now.getUTCHours().toString().padStart(2, "0");
  const minutes = now.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Check if current time is within a time range
 */
function isWithinTimeRange(
  currentTime: string,
  openTime: string,
  closeTime: string,
): boolean {
  // Handle overnight ranges (e.g., 22:00 to 02:00)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Check if today is a holiday for the given asset class
 * In manual mode, only custom holidays are checked (template holidays ignored)
 */
function isTodayHoliday(
  holidays: IMarketHoliday[],
  assetClass: AssetClass,
  mode: "automatic" | "manual" = "automatic",
): boolean {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const todayMonthDay = todayStr.slice(5); // MM-DD for recurring check

  for (const holiday of holidays) {
    // In manual mode, skip template holidays - only use custom holidays
    if (mode === "manual" && (holiday as { isTemplate?: boolean }).isTemplate) {
      continue;
    }

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
export async function isMarketOpen(assetClass: AssetClass = "forex"): Promise<{
  isOpen: boolean;
  reason?: string;
  isHoliday?: boolean;
  holidayName?: string;
}> {
  const settings = await getMarketSettings();

  // Fallback if no settings
  if (!settings) {
    logOnce("no-settings", "⚠️ [Market Hours] No settings found, using API fallback", "warn");
    const apiOpen = await isForexMarketOpenAPI();
    return { isOpen: apiOpen };
  }

  // Check holidays first (applies to both modes, but respects mode for template vs custom)
  if (settings.blockTradingOnHolidays) {
    const holiday = getTodayHoliday(
      settings.holidays,
      assetClass,
      settings.mode,
    );
    if (holiday) {
      logOnce(
        `holiday-${assetClass}-${holiday.name}`,
        `🏖️ [Market Hours] ${assetClass} closed for holiday: ${holiday.name}`,
      );
      return {
        isOpen: false,
        reason: `Market closed for ${holiday.name}`,
        isHoliday: true,
        holidayName: holiday.name,
      };
    }
  }

  // Automatic mode - use Massive.com API
  if (settings.mode === "automatic") {
    try {
      const status = await getMarketStatusFromAPI();
      // Reason: Only log state transitions, not every poll. Log once per status.
      logOnce(
        `auto-${assetClass}-${status.isOpen}`,
        `📡 [Market Hours] ${assetClass} (auto): ${status.isOpen ? "OPEN" : "CLOSED"}`,
      );
      return {
        isOpen: status.isOpen,
        reason: status.isOpen ? undefined : "Market is currently closed",
      };
    } catch (error) {
      console.error("❌ [Market Hours] API failed:", error);
      // If API fails and fallback is enabled, use manual settings
      if (settings.automaticSettings.fallbackToManual) {
        logOnce("auto-fallback", "⚠️ [Market Hours] API failed, falling back to manual", "warn");
        return checkManualSchedule(settings, assetClass);
      }

      // Otherwise, return closed as a safety measure
      return {
        isOpen: false,
        reason: "Unable to determine market status",
      };
    }
  }

  // Manual mode - use configured schedules
  return checkManualSchedule(settings, assetClass);
}

/**
 * Check market status using manual schedule settings
 */
function checkManualSchedule(
  settings: IMarketSettings,
  assetClass: AssetClass,
): {
  isOpen: boolean;
  reason?: string;
} {
  const schedule = settings.assetSchedules[assetClass];

  // Check if asset class is enabled
  if (!schedule || !schedule.enabled) {
    logOnce(
      `disabled-${assetClass}`,
      `🚫 [Market Hours] ${assetClass} trading is disabled in settings`,
    );
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
    logOnce(
      `closed-day-${assetClass}-${currentDay}`,
      `🌙 [Market Hours] ${assetClass} closed on ${currentDay}`,
    );
    return {
      isOpen: false,
      reason: `Market is closed on ${currentDay}`,
    };
  }

  // Check if within trading hours
  if (
    !isWithinTimeRange(currentTime, daySchedule.openTime, daySchedule.closeTime)
  ) {
    logOnce(
      `outside-hours-${assetClass}-${currentDay}`,
      `🕐 [Market Hours] ${assetClass} outside hours on ${currentDay} (${daySchedule.openTime}-${daySchedule.closeTime} UTC)`,
    );
    return {
      isOpen: false,
      reason: `Market is closed. Trading hours: ${daySchedule.openTime} - ${daySchedule.closeTime} UTC`,
    };
  }

  // Reason: Only log "OPEN" once per asset class per cooldown window to avoid spam.
  logOnce(`open-${assetClass}`, `✅ [Market Hours] ${assetClass} market is OPEN`);
  return { isOpen: true };
}

/**
 * Get today's holiday if any
 * In manual mode, only returns custom holidays (template holidays ignored)
 */
function getTodayHoliday(
  holidays: IMarketHoliday[],
  assetClass: AssetClass,
  mode: "automatic" | "manual" = "automatic",
): IMarketHoliday | null {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const todayMonthDay = todayStr.slice(5);

  for (const holiday of holidays) {
    // In manual mode, skip template holidays - only use custom holidays
    if (mode === "manual" && (holiday as { isTemplate?: boolean }).isTemplate) {
      continue;
    }

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

  // Check if blocking is enabled
  if (!settings.blockCompetitionsOnHolidays) {
    return { canJoin: true };
  }

  // Check for holidays first (respects mode for template vs custom)
  const holiday = getTodayHoliday(settings.holidays, "forex", settings.mode);
  if (holiday) {
    logOnce(
      `comp-holiday-${holiday.name}`,
      `🏖️ [Market Hours] Competition entry blocked: ${holiday.name}`,
    );
    return {
      canJoin: false,
      reason: `Competition entry blocked due to market holiday: ${holiday.name}`,
    };
  }

  // Check market status (respects mode: automatic vs manual)
  const marketStatus = await isMarketOpen("forex");

  if (!marketStatus.isOpen) {
    return {
      canJoin: false,
      reason:
        marketStatus.reason ||
        "Market is closed. Competition entry is not available.",
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

  // Check if blocking is enabled
  if (!settings.blockChallengesOnHolidays) {
    return { canJoin: true };
  }

  // Check for holidays first (respects mode for template vs custom)
  const holiday = getTodayHoliday(settings.holidays, "forex", settings.mode);
  if (holiday) {
    logOnce(
      `challenge-holiday-${holiday.name}`,
      `🏖️ [Market Hours] Challenge blocked: ${holiday.name}`,
    );
    return {
      canJoin: false,
      reason: `Challenge blocked due to market holiday: ${holiday.name}`,
    };
  }

  // Check market status (respects mode: automatic vs manual)
  const marketStatus = await isMarketOpen("forex");

  if (!marketStatus.isOpen) {
    return {
      canJoin: false,
      reason:
        marketStatus.reason ||
        "Market is closed. Challenges are not available.",
    };
  }

  return { canJoin: true };
}

/**
 * Get upcoming holidays for display
 */
export async function getUpcomingHolidays(
  assetClass?: AssetClass,
): Promise<IMarketHoliday[]> {
  const settings = await getMarketSettings();

  if (!settings) {
    return [];
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return settings.holidays
    .filter((h) => {
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

  // Respects mode for template vs custom holidays
  const holiday = getTodayHoliday(settings.holidays, "forex", settings.mode);
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
