import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Schedule sub-schema for both cleanup and gapFill
const ScheduleSchema = new mongoose.Schema({
  type: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' },
  weekDays: { type: [Number], default: [0] }, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  monthDay: { type: Number, default: 1, min: 1, max: 28 }, // Day of month (1-28)
  hour: { type: Number, default: 3, min: 0, max: 23 },
  minute: { type: Number, default: 0, min: 0, max: 59 },
}, { _id: false });

// Settings schema for market data management
const MarketDataSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'market_data_settings' },
  cleanup: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    daysToKeep: { type: Number, default: 30 },
    lastRun: { type: Date, default: null },
    schedule: { type: ScheduleSchema, default: () => ({ type: 'weekly', weekDays: [0], monthDay: 1, hour: 3, minute: 0 }) },
  },
  gapFill: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    lastRun: { type: Date, default: null },
    schedule: { type: ScheduleSchema, default: () => ({ type: 'weekly', weekDays: [1, 3, 5], monthDay: 1, hour: 4, minute: 0 }) },
  },
  // Price update mode: how browsers receive real-time price updates
  // 'polling' = browsers poll /api/trading/forming-candle (reliable)
  // 'websocket' = server broadcasts forming candles to all browsers (efficient, 99% less server load)
  priceUpdateMode: { 
    type: String, 
    enum: ['polling', 'websocket'], 
    default: 'polling' 
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
  // Candle limits per timeframe - controls how many candles users can see
  // Lower = faster loading, Higher = more history
  candleLimits: {
    '1m': { type: Number, default: 1440 },   // 1 day of 1m candles
    '5m': { type: Number, default: 2016 },   // 1 week of 5m candles
    '15m': { type: Number, default: 2688 },  // 4 weeks of 15m candles
    '30m': { type: Number, default: 1440 },  // 1 month of 30m candles
    '1h': { type: Number, default: 720 },    // 1 month of 1h candles
    '4h': { type: Number, default: 540 },    // 3 months of 4h candles
    '1d': { type: Number, default: 365 },    // 1 year of daily candles
  },
  // Toggle to enable/disable chart limits
  // When disabled, charts will load ALL available historical data
  chartLimitsEnabled: { type: Boolean, default: true },
}, { timestamps: true });

const MarketDataSettings = mongoose.models.MarketDataSettings || 
  mongoose.model('MarketDataSettings', MarketDataSettingsSchema);

/**
 * GET - Retrieve market data settings
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    let settings = await MarketDataSettings.findOne({ key: 'market_data_settings' });
    
    // Create default settings if not exists
    if (!settings) {
      settings = await MarketDataSettings.create({
        key: 'market_data_settings',
        cleanup: {
          enabled: false,
          mode: 'manual',
          daysToKeep: 30,
          lastRun: null,
          schedule: {
            type: 'weekly',
            weekDays: [0], // Sunday
            monthDay: 1,
            hour: 3,
            minute: 0,
          },
        },
        gapFill: {
          enabled: true,
          mode: 'auto',
          lastRun: null,
          schedule: {
            type: 'weekly',
            weekDays: [1, 3, 5], // Mon, Wed, Fri
            monthDay: 1,
            hour: 4,
            minute: 0,
          },
        },
        priceUpdateMode: 'polling',
        pollingIntervalMs: 200,
        websocketIntervalMs: 200,
      });
    }
    
    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        priceUpdateMode: settings.priceUpdateMode || 'polling',
        pollingIntervalMs: settings.pollingIntervalMs || 200,
        websocketIntervalMs: settings.websocketIntervalMs || 200,
        candleLimits: settings.candleLimits || {
          '1m': 1440,
          '5m': 2016,
          '15m': 2688,
          '30m': 1440,
          '1h': 720,
          '4h': 540,
          '1d': 365,
        },
        chartLimitsEnabled: settings.chartLimitsEnabled ?? true,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting market data settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

/**
 * POST - Update market data settings
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { cleanup, gapFill, priceUpdateMode, pollingIntervalMs, websocketIntervalMs, candleLimits, chartLimitsEnabled } = body;
    
    const updateData: Record<string, unknown> = {};
    
    if (cleanup) {
      if (typeof cleanup.enabled === 'boolean') updateData['cleanup.enabled'] = cleanup.enabled;
      if (cleanup.mode) updateData['cleanup.mode'] = cleanup.mode;
      if (typeof cleanup.daysToKeep === 'number') updateData['cleanup.daysToKeep'] = Math.max(0, Math.min(365, cleanup.daysToKeep));
      
      if (cleanup.schedule) {
        if (cleanup.schedule.type && ['weekly', 'monthly'].includes(cleanup.schedule.type)) {
          updateData['cleanup.schedule.type'] = cleanup.schedule.type;
        }
        if (typeof cleanup.schedule.hour === 'number') {
          updateData['cleanup.schedule.hour'] = Math.max(0, Math.min(23, cleanup.schedule.hour));
        }
        if (typeof cleanup.schedule.minute === 'number') {
          updateData['cleanup.schedule.minute'] = Math.max(0, Math.min(59, cleanup.schedule.minute));
        }
        if (Array.isArray(cleanup.schedule.weekDays)) {
          updateData['cleanup.schedule.weekDays'] = cleanup.schedule.weekDays.filter(
            (d: number) => d >= 0 && d <= 6
          );
        }
        if (typeof cleanup.schedule.monthDay === 'number') {
          updateData['cleanup.schedule.monthDay'] = Math.max(1, Math.min(28, cleanup.schedule.monthDay));
        }
      }
    }
    
    if (gapFill) {
      if (typeof gapFill.enabled === 'boolean') updateData['gapFill.enabled'] = gapFill.enabled;
      if (gapFill.mode) updateData['gapFill.mode'] = gapFill.mode;
      
      if (gapFill.schedule) {
        if (gapFill.schedule.type && ['weekly', 'monthly'].includes(gapFill.schedule.type)) {
          updateData['gapFill.schedule.type'] = gapFill.schedule.type;
        }
        if (typeof gapFill.schedule.hour === 'number') {
          updateData['gapFill.schedule.hour'] = Math.max(0, Math.min(23, gapFill.schedule.hour));
        }
        if (typeof gapFill.schedule.minute === 'number') {
          updateData['gapFill.schedule.minute'] = Math.max(0, Math.min(59, gapFill.schedule.minute));
        }
        if (Array.isArray(gapFill.schedule.weekDays)) {
          updateData['gapFill.schedule.weekDays'] = gapFill.schedule.weekDays.filter(
            (d: number) => d >= 0 && d <= 6
          );
        }
        if (typeof gapFill.schedule.monthDay === 'number') {
          updateData['gapFill.schedule.monthDay'] = Math.max(1, Math.min(28, gapFill.schedule.monthDay));
        }
      }
    }
    
    // Price update mode
    if (priceUpdateMode && ['polling', 'websocket'].includes(priceUpdateMode)) {
      updateData['priceUpdateMode'] = priceUpdateMode;
    }
    
    // Polling interval (50-2000ms)
    if (typeof pollingIntervalMs === 'number') {
      updateData['pollingIntervalMs'] = Math.max(50, Math.min(2000, pollingIntervalMs));
    }
    
    // WebSocket broadcast interval (50-2000ms)
    if (typeof websocketIntervalMs === 'number') {
      updateData['websocketIntervalMs'] = Math.max(50, Math.min(2000, websocketIntervalMs));
    }
    
    // Candle limits per timeframe
    if (candleLimits && typeof candleLimits === 'object') {
      const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      for (const tf of validTimeframes) {
        if (typeof candleLimits[tf] === 'number') {
          updateData[`candleLimits.${tf}`] = Math.max(100, Math.min(50000, candleLimits[tf]));
        }
      }
    }
    
    // Chart limits enabled toggle
    if (typeof chartLimitsEnabled === 'boolean') {
      updateData['chartLimitsEnabled'] = chartLimitsEnabled;
    }
    
    const settings = await MarketDataSettings.findOneAndUpdate(
      { key: 'market_data_settings' },
      { $set: updateData },
      { new: true, upsert: true }
    );
    
    return NextResponse.json({
      success: true,
      settings: {
        cleanup: settings.cleanup,
        gapFill: settings.gapFill,
        priceUpdateMode: settings.priceUpdateMode || 'polling',
        pollingIntervalMs: settings.pollingIntervalMs || 200,
        websocketIntervalMs: settings.websocketIntervalMs || 200,
        candleLimits: settings.candleLimits || {
          '1m': 1440,
          '5m': 2016,
          '15m': 2688,
          '30m': 1440,
          '1h': 720,
          '4h': 540,
          '1d': 365,
        },
        chartLimitsEnabled: settings.chartLimitsEnabled ?? true,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating market data settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
