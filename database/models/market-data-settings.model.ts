import mongoose, { Schema, Document } from 'mongoose';

/**
 * Market Data Settings
 * 
 * Controls how the application fetches and serves historical candle data.
 * These are global settings managed from the Admin panel.
 */

export interface IMarketDataSettings {
  // Historical Data Source Settings
  useLocalHistory: boolean;        // If true, serve historical data from our DB; if false, fetch from Massive.com API
  autoFetchHistory: boolean;       // If true, automatically fetch history when gaps are detected
  
  // Chart Display Settings  
  chartHistoryLimitEnabled: boolean;  // If true, limit how far back charts can display
  chartHistoryLimitDays: number;      // Number of days to limit chart history (e.g., 365 = 1 year)
  
  // Lazy Loading Settings
  initialCandleCount: number;      // How many candles to load initially (default: 500)
  lazyLoadBatchSize: number;       // How many candles to load when scrolling (default: 500)
  
  // Download Settings
  historicalYearsToDownload: number;  // How many years of history to download (default: 10)
  
  updatedAt: Date;
}

export interface IMarketDataSettingsDocument extends IMarketDataSettings, Document {}

const MarketDataSettingsSchema = new Schema<IMarketDataSettingsDocument>(
  {
    useLocalHistory: { type: Boolean, default: true },
    autoFetchHistory: { type: Boolean, default: false },
    chartHistoryLimitEnabled: { type: Boolean, default: false },
    chartHistoryLimitDays: { type: Number, default: 365 },
    initialCandleCount: { type: Number, default: 500 },
    lazyLoadBatchSize: { type: Number, default: 500 },
    historicalYearsToDownload: { type: Number, default: 10 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'market_data_settings',
  }
);

export const MarketDataSettings = mongoose.models.market_data_settings as mongoose.Model<IMarketDataSettingsDocument> || 
  mongoose.model<IMarketDataSettingsDocument>('market_data_settings', MarketDataSettingsSchema);

// Default settings
const DEFAULT_SETTINGS: Omit<IMarketDataSettings, 'updatedAt'> = {
  useLocalHistory: true,
  autoFetchHistory: false,
  chartHistoryLimitEnabled: false,
  chartHistoryLimitDays: 365,
  initialCandleCount: 500,
  lazyLoadBatchSize: 500,
  historicalYearsToDownload: 10,
};

// Get settings (creates default if not exists)
export async function getMarketDataSettings(): Promise<IMarketDataSettings> {
  let settings = await MarketDataSettings.findOne().lean();
  
  if (!settings) {
    // Create default settings
    settings = await MarketDataSettings.create(DEFAULT_SETTINGS);
    settings = settings.toObject();
  }
  
  return settings as IMarketDataSettings;
}

// Update settings
export async function updateMarketDataSettings(
  updates: Partial<IMarketDataSettings>
): Promise<IMarketDataSettings> {
  const settings = await MarketDataSettings.findOneAndUpdate(
    {},
    { $set: updates },
    { upsert: true, new: true }
  ).lean();
  
  return settings as IMarketDataSettings;
}

// Quick getters for common checks
export async function shouldUseLocalHistory(): Promise<boolean> {
  const settings = await getMarketDataSettings();
  return settings.useLocalHistory;
}

export async function shouldAutoFetchHistory(): Promise<boolean> {
  const settings = await getMarketDataSettings();
  return settings.autoFetchHistory;
}

export async function getChartHistoryLimit(): Promise<{ enabled: boolean; days: number }> {
  const settings = await getMarketDataSettings();
  return {
    enabled: settings.chartHistoryLimitEnabled,
    days: settings.chartHistoryLimitDays,
  };
}

export async function getLazyLoadSettings(): Promise<{ initial: number; batch: number }> {
  const settings = await getMarketDataSettings();
  return {
    initial: settings.initialCandleCount,
    batch: settings.lazyLoadBatchSize,
  };
}
