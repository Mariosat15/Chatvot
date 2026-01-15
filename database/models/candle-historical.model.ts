/**
 * Historical Candles Model
 * 
 * Stores historical candle data fetched from Massive.com API.
 * This is PERMANENT storage - data is fetched once and never deleted.
 * 
 * Separate from candles_1m which stores live data with cleanup.
 * 
 * Collections created:
 * - candles_historical_5m
 * - candles_historical_15m
 * - candles_historical_30m
 * - candles_historical_1h
 * - candles_historical_4h
 * - candles_historical_1d
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface HistoricalCandleData {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalCandleDocument extends HistoricalCandleData, Document {}

// Schema definition
const HistoricalCandleSchema = new Schema<HistoricalCandleDocument>(
  {
    symbol: { 
      type: String, 
      required: true, 
      index: true 
    },
    timestamp: { 
      type: Date, 
      required: true, 
      index: true 
    },
    open: { 
      type: Number, 
      required: true 
    },
    high: { 
      type: Number, 
      required: true 
    },
    low: { 
      type: Number, 
      required: true 
    },
    close: { 
      type: Number, 
      required: true 
    },
    volume: { 
      type: Number, 
      default: 0 
    },
  },
  {
    timestamps: false, // No createdAt/updatedAt needed for historical data
  }
);

// Compound index for efficient queries: symbol + timestamp
HistoricalCandleSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });

// Supported timeframes for historical data
export const HISTORICAL_TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'] as const;
export type HistoricalTimeframe = typeof HISTORICAL_TIMEFRAMES[number];

// Collection name mapping
const COLLECTION_NAMES: Record<HistoricalTimeframe, string> = {
  '5m': 'candles_historical_5m',
  '15m': 'candles_historical_15m',
  '30m': 'candles_historical_30m',
  '1h': 'candles_historical_1h',
  '4h': 'candles_historical_4h',
  '1d': 'candles_historical_1d',
};

// Model cache to avoid re-creating models
const modelCache: Partial<Record<HistoricalTimeframe, Model<HistoricalCandleDocument>>> = {};

/**
 * Get the model for a specific timeframe's historical candles
 */
export function getHistoricalCandleModel(timeframe: HistoricalTimeframe): Model<HistoricalCandleDocument> {
  if (modelCache[timeframe]) {
    return modelCache[timeframe]!;
  }

  const collectionName = COLLECTION_NAMES[timeframe];
  const modelName = `HistoricalCandle_${timeframe}`;

  // Check if model already exists in mongoose
  if (mongoose.models[modelName]) {
    modelCache[timeframe] = mongoose.models[modelName] as Model<HistoricalCandleDocument>;
    return modelCache[timeframe]!;
  }

  // Create new model
  const model = mongoose.model<HistoricalCandleDocument>(
    modelName,
    HistoricalCandleSchema,
    collectionName
  );

  modelCache[timeframe] = model;
  return model;
}

/**
 * Normalize timeframe string to HistoricalTimeframe
 */
export function normalizeTimeframe(timeframe: string): HistoricalTimeframe | null {
  const mapping: Record<string, HistoricalTimeframe> = {
    '5m': '5m',
    '5': '5m',
    '15m': '15m',
    '15': '15m',
    '30m': '30m',
    '30': '30m',
    '1h': '1h',
    '60': '1h',
    '4h': '4h',
    '240': '4h',
    '1d': '1d',
    'D': '1d',
  };
  return mapping[timeframe] || null;
}

/**
 * Save historical candles to MongoDB (bulk upsert)
 */
export async function saveHistoricalCandles(
  timeframe: HistoricalTimeframe,
  symbol: string,
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>
): Promise<number> {
  if (candles.length === 0) return 0;

  const Model = getHistoricalCandleModel(timeframe);
  
  const operations = candles.map(candle => ({
    updateOne: {
      filter: { 
        symbol, 
        timestamp: new Date(candle.time * 1000) 
      },
      update: {
        $setOnInsert: {
          symbol,
          timestamp: new Date(candle.time * 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
        }
      },
      upsert: true,
    }
  }));

  const result = await Model.bulkWrite(operations, { ordered: false });
  return result.upsertedCount;
}

/**
 * Get historical candles from MongoDB
 */
export async function getHistoricalCandles(
  timeframe: HistoricalTimeframe,
  symbol: string,
  beforeTimestamp?: number, // Unix seconds - get candles BEFORE this time
  limit: number = 10000
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>> {
  const Model = getHistoricalCandleModel(timeframe);
  
  const query: { symbol: string; timestamp?: { $lt: Date } } = { symbol };
  
  if (beforeTimestamp) {
    query.timestamp = { $lt: new Date(beforeTimestamp * 1000) };
  }
  
  const candles = await Model.find(query)
    .sort({ timestamp: -1 }) // Newest first
    .limit(limit)
    .lean();
  
  return candles.map(c => ({
    time: Math.floor(new Date(c.timestamp).getTime() / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  })).reverse(); // Return oldest first
}

/**
 * Check if we have historical data for a symbol/timeframe
 */
export async function hasHistoricalData(
  timeframe: HistoricalTimeframe,
  symbol: string
): Promise<{ exists: boolean; count: number; oldestTimestamp?: number }> {
  const Model = getHistoricalCandleModel(timeframe);
  
  const count = await Model.countDocuments({ symbol });
  
  if (count === 0) {
    return { exists: false, count: 0 };
  }
  
  const oldest = await Model.findOne({ symbol }).sort({ timestamp: 1 }).lean();
  
  return {
    exists: true,
    count,
    oldestTimestamp: oldest ? Math.floor(new Date(oldest.timestamp).getTime() / 1000) : undefined,
  };
}

/**
 * Get the oldest timestamp we have for a symbol/timeframe
 */
export async function getOldestHistoricalTimestamp(
  timeframe: HistoricalTimeframe,
  symbol: string
): Promise<number | null> {
  const Model = getHistoricalCandleModel(timeframe);
  const oldest = await Model.findOne({ symbol }).sort({ timestamp: 1 }).lean();
  return oldest ? Math.floor(new Date(oldest.timestamp).getTime() / 1000) : null;
}

export default getHistoricalCandleModel;
