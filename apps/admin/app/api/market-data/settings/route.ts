import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

// Schedule sub-schema for both cleanup and gapFill
const ScheduleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["weekly", "monthly"], default: "weekly" },
    weekDays: { type: [Number], default: [0] }, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    monthDay: { type: Number, default: 1, min: 1, max: 28 }, // Day of month (1-28)
    hour: { type: Number, default: 3, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
  },
  { _id: false },
);

// Settings schema for market data management
const MarketDataSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "market_data_settings" },
    cleanup: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ["auto", "manual"], default: "manual" },
      daysToKeep: { type: Number, default: 30 }, // Legacy - kept for backward compatibility
      // New: Independent cleanup types - each can be ON/OFF separately
      deleteOldest: {
        enabled: { type: Boolean, default: true }, // Default ON
        days: { type: Number, default: 1, min: 0 }, // No upper limit
      },
      keepRecent: {
        enabled: { type: Boolean, default: false }, // Default OFF
        days: { type: Number, default: 365, min: 0 }, // No upper limit
      },
      includeHistorical: { type: Boolean, default: true }, // Clean all collections
      lastRun: { type: Date, default: null },
      lastResults: { type: mongoose.Schema.Types.Mixed, default: null }, // Store last cleanup results
      schedule: {
        type: ScheduleSchema,
        default: () => ({
          type: "weekly",
          weekDays: [0],
          monthDay: 1,
          hour: 3,
          minute: 0,
        }),
      },
    },
    gapFill: {
      enabled: { type: Boolean, default: true },
      mode: { type: String, enum: ["auto", "manual"], default: "auto" },
      lastRun: { type: Date, default: null },
      schedule: {
        type: ScheduleSchema,
        default: () => ({
          type: "weekly",
          weekDays: [1, 3, 5],
          monthDay: 1,
          hour: 4,
          minute: 0,
        }),
      },
    },
    // Price update mode: how browsers receive real-time price updates
    // 'polling' = browsers poll /api/trading/forming-candle (reliable)
    // 'websocket' = server broadcasts forming candles to all browsers (efficient, 99% less server load)
    priceUpdateMode: {
      type: String,
      enum: ["polling", "websocket"],
      default: "polling",
    },
    // Polling interval in milliseconds (how often browsers poll for updates)
    // Default: 200ms, Range: 50-2000ms
    pollingIntervalMs: {
      type: Number,
      default: 200,
      min: 50,
      max: 2000,
    },
    // WebSocket broadcast interval in milliseconds (how often server pushes updates)
    // Default: 200ms, Range: 50-2000ms
    websocketIntervalMs: {
      type: Number,
      default: 200,
      min: 50,
      max: 2000,
    },
    // --- Historical Data Settings ---
    // If true, serve historical data from our database; if false, fetch from Massive.com API each time
    useLocalHistory: {
      type: Boolean,
      default: true,
    },
    // If true, automatically fetch history when gaps are detected (resource intensive)
    autoFetchHistory: {
      type: Boolean,
      default: false,
    },
    // --- Chart Display Settings ---
    // If true, limit how far back charts can display
    chartHistoryLimitEnabled: {
      type: Boolean,
      default: false,
    },
    // Number of days to limit chart history (e.g., 365 = 1 year)
    chartHistoryLimitDays: {
      type: Number,
      default: 3650, // Default to max (10 years)
      min: 0,
      max: 3650,
    },
    // Hours component for chart history limit
    chartHistoryLimitHours: {
      type: Number,
      default: 23, // Default to max
      min: 0,
      max: 23,
    },
    // Minutes component for chart history limit
    chartHistoryLimitMinutes: {
      type: Number,
      default: 59, // Default to max
      min: 0,
      max: 59,
    },
    // --- Lazy Loading Settings ---
    // How many candles to load initially (default: 100)
    initialCandleCount: {
      type: Number,
      default: 100,
      min: 0, // Allow 0 for no initial load
      // No max limit - admin can set any value
    },
    // How many candles to load when scrolling (default: 500)
    lazyLoadBatchSize: {
      type: Number,
      default: 500,
      min: 100,
      max: 2000,
    },
    // --- Download Settings ---
    // How many years of history to download (default: 10)
    historicalYearsToDownload: {
      type: Number,
      default: 10,
      min: 1,
      max: 20,
    },
    // --- Auto-Seeding Settings ---
    // How many days of data to fetch when database is empty (default: 30)
    // This controls the initial seeding from Massive.com API
    seedingDaysBack: {
      type: Number,
      default: 30,
      min: 0,
      max: 365,
    },
    // Hours component for seeding
    seedingHours: {
      type: Number,
      default: 0,
      min: 0,
      max: 23,
    },
    // Minutes component for seeding
    seedingMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 59,
    },
  },
  { timestamps: true },
);

const MarketDataSettings =
  mongoose.models.MarketDataSettings ||
  mongoose.model("MarketDataSettings", MarketDataSettingsSchema);

/**
 * GET - Retrieve market data settings
 */
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await MarketDataSettings.findOne({
      key: "market_data_settings",
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await MarketDataSettings.create({
        key: "market_data_settings",
        cleanup: {
          enabled: false,
          mode: "manual",
          daysToKeep: 30,
          lastRun: null,
          schedule: {
            type: "weekly",
            weekDays: [0], // Sunday
            monthDay: 1,
            hour: 3,
            minute: 0,
          },
        },
        gapFill: {
          enabled: true,
          mode: "auto",
          lastRun: null,
          schedule: {
            type: "weekly",
            weekDays: [1, 3, 5], // Mon, Wed, Fri
            monthDay: 1,
            hour: 4,
            minute: 0,
          },
        },
        priceUpdateMode: "polling",
        pollingIntervalMs: 200,
        websocketIntervalMs: 200,
        useLocalHistory: true,
        autoFetchHistory: false,
        chartHistoryLimitEnabled: false,
        chartHistoryLimitDays: 3650,
        chartHistoryLimitHours: 23,
        chartHistoryLimitMinutes: 59,
        initialCandleCount: 500,
        lazyLoadBatchSize: 500,
        historicalYearsToDownload: 10,
        seedingDaysBack: 30,
        seedingHours: 0,
        seedingMinutes: 0,
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        priceUpdateMode: settings.priceUpdateMode || "polling",
        pollingIntervalMs: settings.pollingIntervalMs || 200,
        websocketIntervalMs: settings.websocketIntervalMs || 200,
        // Historical data settings
        useLocalHistory: settings.useLocalHistory ?? true,
        autoFetchHistory: settings.autoFetchHistory ?? false,
        chartHistoryLimitEnabled: settings.chartHistoryLimitEnabled ?? false,
        chartHistoryLimitDays: settings.chartHistoryLimitDays ?? 3650,
        chartHistoryLimitHours: settings.chartHistoryLimitHours ?? 23,
        chartHistoryLimitMinutes: settings.chartHistoryLimitMinutes ?? 59,
        initialCandleCount: settings.initialCandleCount ?? 500,
        lazyLoadBatchSize: settings.lazyLoadBatchSize ?? 500,
        historicalYearsToDownload: settings.historicalYearsToDownload ?? 10,
        seedingDaysBack: settings.seedingDaysBack ?? 30,
        seedingHours: settings.seedingHours ?? 0,
        seedingMinutes: settings.seedingMinutes ?? 0,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting market data settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 },
    );
  }
}

/**
 * POST - Update market data settings
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      cleanup,
      gapFill,
      priceUpdateMode,
      pollingIntervalMs,
      websocketIntervalMs,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (cleanup) {
      if (typeof cleanup.enabled === "boolean")
        updateData["cleanup.enabled"] = cleanup.enabled;
      if (cleanup.mode) updateData["cleanup.mode"] = cleanup.mode;
      if (typeof cleanup.daysToKeep === "number")
        updateData["cleanup.daysToKeep"] = Math.max(
          0,
          Math.min(365, cleanup.daysToKeep),
        );

      // Delete Oldest cleanup type
      if (cleanup.deleteOldest) {
        if (typeof cleanup.deleteOldest.enabled === "boolean") {
          updateData["cleanup.deleteOldest.enabled"] =
            cleanup.deleteOldest.enabled;
        }
        if (typeof cleanup.deleteOldest.days === "number") {
          updateData["cleanup.deleteOldest.days"] = Math.max(
            0,
            cleanup.deleteOldest.days,
          );
        }
      }

      // Keep Recent cleanup type
      if (cleanup.keepRecent) {
        if (typeof cleanup.keepRecent.enabled === "boolean") {
          updateData["cleanup.keepRecent.enabled"] = cleanup.keepRecent.enabled;
        }
        if (typeof cleanup.keepRecent.days === "number") {
          updateData["cleanup.keepRecent.days"] = Math.max(
            0,
            cleanup.keepRecent.days,
          );
        }
      }

      // Include Historical collections
      if (typeof cleanup.includeHistorical === "boolean") {
        updateData["cleanup.includeHistorical"] = cleanup.includeHistorical;
      }

      if (cleanup.schedule) {
        if (
          cleanup.schedule.type &&
          ["weekly", "monthly"].includes(cleanup.schedule.type)
        ) {
          updateData["cleanup.schedule.type"] = cleanup.schedule.type;
        }
        if (typeof cleanup.schedule.hour === "number") {
          updateData["cleanup.schedule.hour"] = Math.max(
            0,
            Math.min(23, cleanup.schedule.hour),
          );
        }
        if (typeof cleanup.schedule.minute === "number") {
          updateData["cleanup.schedule.minute"] = Math.max(
            0,
            Math.min(59, cleanup.schedule.minute),
          );
        }
        if (Array.isArray(cleanup.schedule.weekDays)) {
          updateData["cleanup.schedule.weekDays"] =
            cleanup.schedule.weekDays.filter((d: number) => d >= 0 && d <= 6);
        }
        if (typeof cleanup.schedule.monthDay === "number") {
          updateData["cleanup.schedule.monthDay"] = Math.max(
            1,
            Math.min(28, cleanup.schedule.monthDay),
          );
        }
      }
    }

    if (gapFill) {
      if (typeof gapFill.enabled === "boolean")
        updateData["gapFill.enabled"] = gapFill.enabled;
      if (gapFill.mode) updateData["gapFill.mode"] = gapFill.mode;

      if (gapFill.schedule) {
        if (
          gapFill.schedule.type &&
          ["weekly", "monthly"].includes(gapFill.schedule.type)
        ) {
          updateData["gapFill.schedule.type"] = gapFill.schedule.type;
        }
        if (typeof gapFill.schedule.hour === "number") {
          updateData["gapFill.schedule.hour"] = Math.max(
            0,
            Math.min(23, gapFill.schedule.hour),
          );
        }
        if (typeof gapFill.schedule.minute === "number") {
          updateData["gapFill.schedule.minute"] = Math.max(
            0,
            Math.min(59, gapFill.schedule.minute),
          );
        }
        if (Array.isArray(gapFill.schedule.weekDays)) {
          updateData["gapFill.schedule.weekDays"] =
            gapFill.schedule.weekDays.filter((d: number) => d >= 0 && d <= 6);
        }
        if (typeof gapFill.schedule.monthDay === "number") {
          updateData["gapFill.schedule.monthDay"] = Math.max(
            1,
            Math.min(28, gapFill.schedule.monthDay),
          );
        }
      }
    }

    // Price update mode
    if (priceUpdateMode && ["polling", "websocket"].includes(priceUpdateMode)) {
      updateData["priceUpdateMode"] = priceUpdateMode;
    }

    // Polling interval (50-2000ms)
    if (typeof pollingIntervalMs === "number") {
      updateData["pollingIntervalMs"] = Math.max(
        50,
        Math.min(2000, pollingIntervalMs),
      );
    }

    // WebSocket broadcast interval (50-2000ms)
    if (typeof websocketIntervalMs === "number") {
      updateData["websocketIntervalMs"] = Math.max(
        50,
        Math.min(2000, websocketIntervalMs),
      );
    }

    // Historical data settings
    if (typeof body.useLocalHistory === "boolean") {
      updateData["useLocalHistory"] = body.useLocalHistory;
    }
    if (typeof body.autoFetchHistory === "boolean") {
      updateData["autoFetchHistory"] = body.autoFetchHistory;
    }
    if (typeof body.chartHistoryLimitEnabled === "boolean") {
      updateData["chartHistoryLimitEnabled"] = body.chartHistoryLimitEnabled;
    }
    if (typeof body.chartHistoryLimitDays === "number") {
      updateData["chartHistoryLimitDays"] = Math.max(
        0,
        Math.min(3650, body.chartHistoryLimitDays),
      );
    }
    if (typeof body.chartHistoryLimitHours === "number") {
      updateData["chartHistoryLimitHours"] = Math.max(
        0,
        Math.min(23, body.chartHistoryLimitHours),
      );
    }
    if (typeof body.chartHistoryLimitMinutes === "number") {
      updateData["chartHistoryLimitMinutes"] = Math.max(
        0,
        Math.min(59, body.chartHistoryLimitMinutes),
      );
    }
    if (typeof body.initialCandleCount === "number") {
      updateData["initialCandleCount"] = Math.max(0, body.initialCandleCount); // No upper limit, allow 0
    }
    if (typeof body.lazyLoadBatchSize === "number") {
      updateData["lazyLoadBatchSize"] = Math.max(
        100,
        Math.min(2000, body.lazyLoadBatchSize),
      );
    }
    if (typeof body.historicalYearsToDownload === "number") {
      updateData["historicalYearsToDownload"] = Math.max(
        1,
        Math.min(20, body.historicalYearsToDownload),
      );
    }
    if (typeof body.seedingDaysBack === "number") {
      updateData["seedingDaysBack"] = Math.max(
        0,
        Math.min(365, body.seedingDaysBack),
      );
    }
    if (typeof body.seedingHours === "number") {
      updateData["seedingHours"] = Math.max(0, Math.min(23, body.seedingHours));
    }
    if (typeof body.seedingMinutes === "number") {
      updateData["seedingMinutes"] = Math.max(
        0,
        Math.min(59, body.seedingMinutes),
      );
    }

    const settings = await MarketDataSettings.findOneAndUpdate(
      { key: "market_data_settings" },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        priceUpdateMode: settings.priceUpdateMode || "polling",
        pollingIntervalMs: settings.pollingIntervalMs || 200,
        websocketIntervalMs: settings.websocketIntervalMs || 200,
        // Historical data settings
        useLocalHistory: settings.useLocalHistory ?? true,
        autoFetchHistory: settings.autoFetchHistory ?? false,
        chartHistoryLimitEnabled: settings.chartHistoryLimitEnabled ?? false,
        chartHistoryLimitDays: settings.chartHistoryLimitDays ?? 3650,
        chartHistoryLimitHours: settings.chartHistoryLimitHours ?? 23,
        chartHistoryLimitMinutes: settings.chartHistoryLimitMinutes ?? 59,
        initialCandleCount: settings.initialCandleCount ?? 500,
        lazyLoadBatchSize: settings.lazyLoadBatchSize ?? 500,
        historicalYearsToDownload: settings.historicalYearsToDownload ?? 10,
        seedingDaysBack: settings.seedingDaysBack ?? 30,
        seedingHours: settings.seedingHours ?? 0,
        seedingMinutes: settings.seedingMinutes ?? 0,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating market data settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
