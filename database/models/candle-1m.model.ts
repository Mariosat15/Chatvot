import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Candle 1-Minute Model
 * 
 * Stores 1-minute OHLCV candles from Massive.com CA.* WebSocket feed.
 * Server is the SINGLE SOURCE OF TRUTH for candle data.
 * All browsers poll /api/candles to get the same data.
 * 
 * Architecture:
 * - websocket-price-streamer.ts receives CA.* messages
 * - Upserts candle to this collection
 * - /api/candles endpoint serves candles from here
 * - Browsers just display, NO local candle building
 */

export interface ICandle1m extends Document {
  symbol: string;    // "EUR/USD"
  t: number;         // Unix timestamp in SECONDS (start of candle)
  o: number;         // Open price
  h: number;         // High price
  l: number;         // Low price
  c: number;         // Close price
  v: number;         // Volume
}

// Candle data for API responses (plain object, not Mongoose document)
export interface CandleData {
  time: number;      // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const Candle1mSchema = new Schema<ICandle1m>(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    t: {
      type: Number,
      required: true,
    },
    o: {
      type: Number,
      required: true,
    },
    h: {
      type: Number,
      required: true,
    },
    l: {
      type: Number,
      required: true,
    },
    c: {
      type: Number,
      required: true,
    },
    v: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: false,  // No createdAt/updatedAt needed - we use 't' for time
    collection: 'candles_1m',  // Use existing collection name
  }
);

// Compound index for efficient queries (matches existing indexes)
Candle1mSchema.index({ symbol: 1, t: 1 }, { unique: true });
Candle1mSchema.index({ symbol: 1, t: -1 });  // For descending queries

/**
 * Upsert a candle from CA.* WebSocket message
 * This is called every time we receive a minute aggregate from Massive.com
 */
Candle1mSchema.statics.upsertCandle = async function (
  symbol: string,
  time: number,     // Start timestamp in milliseconds from Massive
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 0
): Promise<void> {
  // Convert milliseconds to seconds for storage
  const timeSeconds = Math.floor(time / 1000);
  
  await this.updateOne(
    { symbol, t: timeSeconds },
    {
      $set: {
        o: open,
        h: high,
        l: low,
        c: close,
        v: volume,
      },
    },
    { upsert: true }
  );
};

/**
 * Get recent candles for a symbol
 * Returns candles sorted ascending (oldest first) for chart display
 */
Candle1mSchema.statics.getCandles = async function (
  symbol: string,
  limit: number = 500
): Promise<CandleData[]> {
  const candles = await this.find({ symbol })
    .sort({ t: -1 })  // Get most recent first
    .limit(limit)
    .lean();
  
  // Convert to chart format and reverse to ascending order
  return candles
    .map((c: ICandle1m) => ({
      time: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
    }))
    .reverse();  // Oldest first for chart
};

/**
 * Bulk upsert candles (for batch processing if needed)
 */
Candle1mSchema.statics.bulkUpsertCandles = async function (
  candles: Array<{
    symbol: string;
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>
): Promise<void> {
  if (candles.length === 0) return;
  
  const bulkOps = candles.map((candle) => ({
    updateOne: {
      filter: { symbol: candle.symbol, t: Math.floor(candle.time / 1000) },
      update: {
        $set: {
          o: candle.open,
          h: candle.high,
          l: candle.low,
          c: candle.close,
          v: candle.volume || 0,
        },
      },
      upsert: true,
    },
  }));
  
  await this.bulkWrite(bulkOps, { ordered: false });
};

/**
 * Get the latest candle for a symbol (forming candle)
 */
Candle1mSchema.statics.getLatestCandle = async function (
  symbol: string
): Promise<CandleData | null> {
  const candle = await this.findOne({ symbol })
    .sort({ t: -1 })
    .lean();
  
  if (!candle) return null;
  
  return {
    time: candle.t,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
  };
};

/**
 * Cleanup old candles (keep only last N days)
 * Called periodically to prevent collection from growing too large
 */
Candle1mSchema.statics.cleanupOldCandles = async function (
  daysToKeep: number = 7
): Promise<number> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
  const result = await this.deleteMany({ t: { $lt: cutoffTime } });
  return result.deletedCount || 0;
};

// Interface for static methods
interface ICandle1mModel extends Model<ICandle1m> {
  upsertCandle(
    symbol: string,
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume?: number
  ): Promise<void>;
  getCandles(symbol: string, limit?: number): Promise<CandleData[]>;
  bulkUpsertCandles(candles: Array<{
    symbol: string;
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>): Promise<void>;
  getLatestCandle(symbol: string): Promise<CandleData | null>;
  cleanupOldCandles(daysToKeep?: number): Promise<number>;
}

// Use existing collection, don't create new indexes if they exist
const Candle1m = (mongoose.models.Candle1m as ICandle1mModel) ||
  mongoose.model<ICandle1m, ICandle1mModel>('Candle1m', Candle1mSchema);

export default Candle1m;
