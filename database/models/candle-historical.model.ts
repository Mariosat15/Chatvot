import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Historical Candle Storage
 * 
 * Stores historical candle data fetched from Massive.com API.
 * This is permanent storage - data is downloaded once and served from DB.
 * 
 * Collections created:
 * - candles_historical_5m
 * - candles_historical_15m
 * - candles_historical_30m
 * - candles_historical_1h
 * - candles_historical_4h
 * - candles_historical_1d
 */

export interface IHistoricalCandle {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IHistoricalCandleDocument extends IHistoricalCandle, Document {}

const HistoricalCandleSchema = new Schema<IHistoricalCandleDocument>(
  {
    symbol: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound unique index: one candle per symbol per timestamp
HistoricalCandleSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });

// Query optimization index
HistoricalCandleSchema.index({ symbol: 1, timestamp: -1 });

// Factory function to get/create model for specific timeframe
function getHistoricalCandleModel(timeframe: string): Model<IHistoricalCandleDocument> {
  const collectionName = `candles_historical_${timeframe}`;
  
  // Check if model already exists to prevent OverwriteModelError
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName] as Model<IHistoricalCandleDocument>;
  }
  
  return mongoose.model<IHistoricalCandleDocument>(
    collectionName,
    HistoricalCandleSchema,
    collectionName
  );
}

// Export models for each timeframe
export const HistoricalCandle1m = getHistoricalCandleModel('1m');
export const HistoricalCandle5m = getHistoricalCandleModel('5m');
export const HistoricalCandle15m = getHistoricalCandleModel('15m');
export const HistoricalCandle30m = getHistoricalCandleModel('30m');
export const HistoricalCandle1h = getHistoricalCandleModel('1h');
export const HistoricalCandle4h = getHistoricalCandleModel('4h');
export const HistoricalCandle1d = getHistoricalCandleModel('1d');

// Helper to get the right model based on timeframe
export function getHistoricalModel(timeframe: string | number): Model<IHistoricalCandleDocument> | null {
  const tf = String(timeframe);
  switch (tf) {
    case '1':
    case '1m':
      return HistoricalCandle1m;
    case '5':
    case '5m':
      return HistoricalCandle5m;
    case '15':
    case '15m':
      return HistoricalCandle15m;
    case '30':
    case '30m':
      return HistoricalCandle30m;
    case '60':
    case '1h':
      return HistoricalCandle1h;
    case '240':
    case '4h':
      return HistoricalCandle4h;
    case '1440':
    case 'D':
    case '1d':
      return HistoricalCandle1d;
    default:
      return null;
  }
}

// Helper to save historical candles in batches
export async function saveHistoricalCandles(
  timeframe: string | number,
  candles: IHistoricalCandle[]
): Promise<{ saved: number; duplicates: number }> {
  const model = getHistoricalModel(timeframe);
  if (!model || candles.length === 0) {
    return { saved: 0, duplicates: 0 };
  }

  let saved = 0;
  let duplicates = 0;
  const BATCH_SIZE = 1000;

  for (let i = 0; i < candles.length; i += BATCH_SIZE) {
    const batch = candles.slice(i, i + BATCH_SIZE);
    
    try {
      const operations = batch.map(candle => ({
        updateOne: {
          filter: { symbol: candle.symbol, timestamp: candle.timestamp },
          update: { $setOnInsert: candle },
          upsert: true,
        },
      }));

      const result = await model.bulkWrite(operations, { ordered: false });
      saved += result.upsertedCount;
      duplicates += batch.length - result.upsertedCount;
    } catch (error: unknown) {
      // Handle duplicate key errors gracefully
      if (error instanceof Error && 'writeErrors' in error) {
        const writeError = error as { writeErrors: Array<{ code: number }> };
        duplicates += writeError.writeErrors.filter((e) => e.code === 11000).length;
      }
    }
  }

  return { saved, duplicates };
}

// Get oldest candle date for a symbol (to know where to start downloading)
export async function getOldestHistoricalCandle(
  timeframe: string | number,
  symbol: string
): Promise<Date | null> {
  const model = getHistoricalModel(timeframe);
  if (!model) return null;

  const oldest = await model
    .findOne({ symbol })
    .sort({ timestamp: 1 })
    .select('timestamp')
    .lean();

  return oldest?.timestamp || null;
}

// Get newest candle date for a symbol
export async function getNewestHistoricalCandle(
  timeframe: string | number,
  symbol: string
): Promise<Date | null> {
  const model = getHistoricalModel(timeframe);
  if (!model) return null;

  const newest = await model
    .findOne({ symbol })
    .sort({ timestamp: -1 })
    .select('timestamp')
    .lean();

  return newest?.timestamp || null;
}

// Get historical candles for a symbol within a date range
export async function getHistoricalCandles(
  timeframe: string | number,
  symbol: string,
  options: {
    from?: Date;
    to?: Date;
    limit?: number;
    before?: Date; // For lazy loading - get candles before this date
  } = {}
): Promise<IHistoricalCandle[]> {
  const model = getHistoricalModel(timeframe);
  if (!model) return [];

  const query: Record<string, unknown> = { symbol };

  if (options.before) {
    // Lazy loading: get candles before a specific date
    query.timestamp = { $lt: options.before };
  } else {
    if (options.from || options.to) {
      query.timestamp = {};
      if (options.from) (query.timestamp as Record<string, Date>).$gte = options.from;
      if (options.to) (query.timestamp as Record<string, Date>).$lte = options.to;
    }
  }

  const candles = await model
    .find(query)
    .sort({ timestamp: options.before ? -1 : 1 })
    .limit(options.limit || 50000)
    .lean();

  // If we used 'before', reverse to get chronological order
  if (options.before) {
    candles.reverse();
  }

  return candles as IHistoricalCandle[];
}

// Count historical candles for a symbol
export async function countHistoricalCandles(
  timeframe: string | number,
  symbol: string
): Promise<number> {
  const model = getHistoricalModel(timeframe);
  if (!model) return 0;
  return model.countDocuments({ symbol });
}

// Delete historical candles for a symbol (for admin reset)
export async function deleteHistoricalCandles(
  timeframe: string | number,
  symbol: string
): Promise<number> {
  const model = getHistoricalModel(timeframe);
  if (!model) return 0;
  const result = await model.deleteMany({ symbol });
  return result.deletedCount;
}
