import mongoose, { Schema, Document } from 'mongoose';

/**
 * Historical Fetch Status
 * 
 * Tracks which symbols/timeframes have had historical data downloaded.
 * Prevents re-downloading the same data multiple times.
 */

export interface IHistoricalFetchStatus {
  symbol: string;
  timeframe: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  oldestCandleDate?: Date;    // Oldest candle we have
  newestCandleDate?: Date;    // Newest candle we have
  totalCandles?: number;      // Total candles downloaded
  lastFetchedAt?: Date;       // When we last ran a fetch
  lastError?: string;         // Error message if failed
  createdAt: Date;
  updatedAt: Date;
}

export interface IHistoricalFetchStatusDocument extends IHistoricalFetchStatus, Document {}

const HistoricalFetchStatusSchema = new Schema<IHistoricalFetchStatusDocument>(
  {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    },
    oldestCandleDate: { type: Date },
    newestCandleDate: { type: Date },
    totalCandles: { type: Number, default: 0 },
    lastFetchedAt: { type: Date },
    lastError: { type: String },
  },
  {
    timestamps: true,
    collection: 'historical_fetch_status',
  }
);

// Compound unique index: one record per symbol per timeframe
HistoricalFetchStatusSchema.index({ symbol: 1, timeframe: 1 }, { unique: true });

export const HistoricalFetchStatus = mongoose.models.historical_fetch_status as mongoose.Model<IHistoricalFetchStatusDocument> || 
  mongoose.model<IHistoricalFetchStatusDocument>('historical_fetch_status', HistoricalFetchStatusSchema);

// Helper functions

export async function getFetchStatus(
  symbol: string,
  timeframe: string
): Promise<IHistoricalFetchStatus | null> {
  return HistoricalFetchStatus.findOne({ symbol, timeframe }).lean();
}

export async function setFetchStatus(
  symbol: string,
  timeframe: string,
  data: Partial<IHistoricalFetchStatus>
): Promise<IHistoricalFetchStatus> {
  return HistoricalFetchStatus.findOneAndUpdate(
    { symbol, timeframe },
    { $set: data },
    { upsert: true, new: true }
  ).lean() as Promise<IHistoricalFetchStatus>;
}

export async function markFetchInProgress(
  symbol: string,
  timeframe: string
): Promise<void> {
  await HistoricalFetchStatus.updateOne(
    { symbol, timeframe },
    { 
      $set: { 
        status: 'in_progress',
        lastFetchedAt: new Date(),
      }
    },
    { upsert: true }
  );
}

export async function markFetchCompleted(
  symbol: string,
  timeframe: string,
  stats: {
    oldestCandleDate?: Date;
    newestCandleDate?: Date;
    totalCandles: number;
  }
): Promise<void> {
  await HistoricalFetchStatus.updateOne(
    { symbol, timeframe },
    { 
      $set: { 
        status: 'completed',
        ...stats,
        lastFetchedAt: new Date(),
        lastError: null,
      }
    },
    { upsert: true }
  );
}

export async function markFetchFailed(
  symbol: string,
  timeframe: string,
  error: string
): Promise<void> {
  await HistoricalFetchStatus.updateOne(
    { symbol, timeframe },
    { 
      $set: { 
        status: 'failed',
        lastError: error,
        lastFetchedAt: new Date(),
      }
    },
    { upsert: true }
  );
}

export async function isFetchCompleted(
  symbol: string,
  timeframe: string
): Promise<boolean> {
  const status = await HistoricalFetchStatus.findOne(
    { symbol, timeframe, status: 'completed' }
  ).lean();
  return !!status;
}

export async function getAllFetchStatuses(): Promise<IHistoricalFetchStatus[]> {
  return HistoricalFetchStatus.find().sort({ symbol: 1, timeframe: 1 }).lean();
}

export async function resetFetchStatus(
  symbol: string,
  timeframe: string
): Promise<void> {
  await HistoricalFetchStatus.deleteOne({ symbol, timeframe });
}

export async function resetAllFetchStatuses(): Promise<number> {
  const result = await HistoricalFetchStatus.deleteMany({});
  return result.deletedCount;
}
