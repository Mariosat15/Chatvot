import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

const MASSIVE_API_BASE_URL = 'https://api.massive.com';
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || process.env.NEXT_PUBLIC_MASSIVE_API_KEY;

// Timeframe configuration
const TIMEFRAME_CONFIG: Record<string, { minutes: number; collectionName: string; apiMultiplier: number; apiTimespan: string }> = {
  '1m': { minutes: 1, collectionName: 'candles_historical_1m', apiMultiplier: 1, apiTimespan: 'minute' },
  '5m': { minutes: 5, collectionName: 'candles_historical_5m', apiMultiplier: 5, apiTimespan: 'minute' },
  '15m': { minutes: 15, collectionName: 'candles_historical_15m', apiMultiplier: 15, apiTimespan: 'minute' },
  '30m': { minutes: 30, collectionName: 'candles_historical_30m', apiMultiplier: 30, apiTimespan: 'minute' },
  '1h': { minutes: 60, collectionName: 'candles_historical_1h', apiMultiplier: 1, apiTimespan: 'hour' },
  '4h': { minutes: 240, collectionName: 'candles_historical_4h', apiMultiplier: 4, apiTimespan: 'hour' },
  '1d': { minutes: 1440, collectionName: 'candles_historical_1d', apiMultiplier: 1, apiTimespan: 'day' },
  '1w': { minutes: 10080, collectionName: 'candles_historical_1w', apiMultiplier: 1, apiTimespan: 'week' },
  '1M': { minutes: 43200, collectionName: 'candles_historical_1M', apiMultiplier: 1, apiTimespan: 'month' },
};

/**
 * Align timestamp to proper interval boundary
 * e.g., 12:13 for 5m → 12:10, 12:18 for 5m → 12:15
 */
function alignTimestamp(timestampMs: number, timeframeMinutes: number): number {
  const intervalMs = timeframeMinutes * 60 * 1000;
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

// Historical candle schema (matches database/models/candle-historical.model.ts)
const HistoricalCandleSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
}, { timestamps: false, versionKey: false });

HistoricalCandleSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });
HistoricalCandleSchema.index({ symbol: 1, timestamp: -1 });

// Helper to get or create model for a timeframe
function getHistoricalModel(timeframe: string) {
  const config = TIMEFRAME_CONFIG[timeframe];
  if (!config) return null;
  
  const modelName = config.collectionName;
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }
  return mongoose.model(modelName, HistoricalCandleSchema, config.collectionName);
}

// Fetch status schema
const FetchStatusSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timeframe: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
  oldestCandleDate: { type: Date },
  newestCandleDate: { type: Date },
  totalCandles: { type: Number, default: 0 },
  lastFetchedAt: { type: Date },
  lastError: { type: String },
}, { timestamps: true, collection: 'historical_fetch_status' });

FetchStatusSchema.index({ symbol: 1, timeframe: 1 }, { unique: true });

const FetchStatus = mongoose.models.historical_fetch_status || 
  mongoose.model('historical_fetch_status', FetchStatusSchema);

/**
 * Convert symbol format (EUR/USD) to Massive format (C:EURUSD)
 */
function symbolToMassiveFormat(symbol: string): string {
  const cleanSymbol = symbol.replace('/', '');
  return `C:${cleanSymbol}`;
}

/**
 * Fetch candles from Massive.com API
 */
async function fetchFromMassive(
  symbol: string,
  timeframe: string,
  fromMs: number,
  toMs: number
): Promise<Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>> {
  if (!MASSIVE_API_KEY) {
    throw new Error('MASSIVE_API_KEY is not configured');
  }

  const config = TIMEFRAME_CONFIG[timeframe];
  if (!config) {
    throw new Error(`Invalid timeframe: ${timeframe}`);
  }

  const ticker = symbolToMassiveFormat(symbol);
  const endpoint = `/v2/aggs/ticker/${ticker}/range/${config.apiMultiplier}/${config.apiTimespan}/${fromMs}/${toMs}`;
  const url = `${MASSIVE_API_BASE_URL}${endpoint}?adjusted=true&sort=asc&limit=50000&apiKey=${MASSIVE_API_KEY}`;

  console.log(`🌐 [Download History] Fetching ${ticker} ${timeframe}: ${new Date(fromMs).toISOString()} to ${new Date(toMs).toISOString()}`);

  const response = await fetch(url, { cache: 'no-store' });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Download History] API Error ${response.status}: ${errorText}`);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.results && data.results.length > 0) {
    console.log(`✅ [Download History] Got ${data.results.length} candles`);
  } else {
    console.log(`⚠️ [Download History] No results for ${ticker}`);
  }
  
  return data.results || [];
}

/**
 * GET - Get download status for all symbols/timeframes
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const hasApiKey = !!MASSIVE_API_KEY;
    
    // Get all fetch statuses
    const statuses = await FetchStatus.find().sort({ symbol: 1, timeframe: 1 }).lean();
    
    // Get candle counts per timeframe
    const timeframeCounts: Record<string, Record<string, number>> = {};
    
    for (const [tf, config] of Object.entries(TIMEFRAME_CONFIG)) {
      const Model = getHistoricalModel(tf);
      if (Model) {
        const counts = await Model.aggregate([
          { $group: { _id: '$symbol', count: { $sum: 1 } } }
        ]);
        timeframeCounts[tf] = {};
        for (const c of counts) {
          timeframeCounts[tf][c._id] = c.count;
        }
      }
    }

    return NextResponse.json({
      success: true,
      hasApiKey,
      availableTimeframes: Object.keys(TIMEFRAME_CONFIG),
      fetchStatuses: statuses,
      candleCounts: timeframeCounts,
    });
  } catch (error) {
    console.error('Error getting download status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

/**
 * POST - Download historical data for specified symbols and timeframes
 * 
 * Body: {
 *   symbols: string[],      // e.g., ["EUR/USD", "GBP/USD"]
 *   timeframes: string[],   // e.g., ["5m", "15m", "1h", "4h", "1d"]
 *   yearsBack: number,      // e.g., 10 (fetch 10 years of history)
 *   startFromLastCandle: boolean  // If true, start from the last 1m candle date backwards
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    if (!MASSIVE_API_KEY) {
      return NextResponse.json({ error: 'MASSIVE_API_KEY is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { symbols, timeframes, yearsBack = 10, startFromLastCandle = true, fromDate, toDate } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array is required' }, { status: 400 });
    }

    if (!timeframes || !Array.isArray(timeframes) || timeframes.length === 0) {
      return NextResponse.json({ error: 'timeframes array is required' }, { status: 400 });
    }

    // Validate timeframes
    const validTimeframes = timeframes.filter(tf => TIMEFRAME_CONFIG[tf]);
    if (validTimeframes.length === 0) {
      return NextResponse.json({ 
        error: `Invalid timeframes. Valid options: ${Object.keys(TIMEFRAME_CONFIG).join(', ')}` 
      }, { status: 400 });
    }

    // Determine if using date range mode or years back mode
    const useDateRange = fromDate && toDate;
    const dateRangeFrom = useDateRange ? new Date(fromDate) : null;
    const dateRangeTo = useDateRange ? new Date(toDate) : null;
    
    if (useDateRange) {
      console.log(`📥 [Download History] DATE RANGE MODE: ${symbols.length} symbols, timeframes: ${validTimeframes.join(', ')}`);
      console.log(`📥 [Download History] From: ${dateRangeFrom?.toISOString()} To: ${dateRangeTo?.toISOString()}`);
    } else {
      console.log(`📥 [Download History] YEARS BACK MODE: ${symbols.length} symbols, timeframes: ${validTimeframes.join(', ')}, ${yearsBack} years`);
    }

    // RETURN IMMEDIATELY - process in background to avoid timeout
    const jobId = `download-${Date.now()}`;
    
    // Start background processing
    (async () => {
      console.log(`🚀 [Download History] Background job ${jobId} started`);
      const jobStartTime = Date.now();
      let grandTotalFetched = 0;
      let grandTotalSaved = 0;

      for (const symbol of symbols) {
        for (const timeframe of validTimeframes) {
          const Model = getHistoricalModel(timeframe);
          if (!Model) continue;
          
          let startMs: number;
          let endMs: number;
          
          // DATE RANGE MODE: Use provided dates
          if (useDateRange && dateRangeFrom && dateRangeTo) {
            startMs = dateRangeFrom.getTime();
            endMs = dateRangeTo.getTime();
            console.log(`📊 [Download History] ${symbol} ${timeframe}: DATE RANGE ${dateRangeFrom.toISOString()} → ${dateRangeTo.toISOString()}`);
          } 
          // YEARS BACK MODE: Calculate from last candle backwards
          else {
            let endDate = new Date();
            
            const oldestHistorical = await Model.findOne({ symbol })
              .sort({ timestamp: 1 })
              .select('timestamp')
              .lean();
            
            if (oldestHistorical && oldestHistorical.timestamp) {
              endDate = new Date(oldestHistorical.timestamp);
              console.log(`📊 [Download History] ${symbol} ${timeframe}: Existing data, oldest at ${endDate.toISOString()}`);
            } else if (startFromLastCandle) {
              const db = mongoose.connection.db;
              if (db) {
                const lastCandle = await db.collection('candles_1m')
                  .findOne({ symbol }, { sort: { t: -1 }, projection: { t: 1 } });
                if (lastCandle && lastCandle.t) {
                  endDate = new Date(lastCandle.t * 1000);
                }
              }
            }

            const startDate = new Date(endDate);
            startDate.setFullYear(startDate.getFullYear() - yearsBack);
            startMs = startDate.getTime();
            endMs = endDate.getTime();
          }

          try {
            await FetchStatus.updateOne(
              { symbol, timeframe },
              { $set: { status: 'in_progress', lastFetchedAt: new Date() } },
              { upsert: true }
            );

            console.log(`📊 [Download History] ${symbol} ${timeframe}: ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()}`);

            const chunkSize = 30 * 24 * 60 * 60 * 1000;
            let totalFetched = 0;
            let totalSaved = 0;
            let chunkStart = startMs;
            let oldestDate: Date | null = null;
            let newestDate: Date | null = null;

            while (chunkStart < endMs) {
              const chunkEnd = Math.min(chunkStart + chunkSize, endMs);
              
              try {
                const candles = await fetchFromMassive(symbol, timeframe, chunkStart, chunkEnd);
                totalFetched += candles.length;

                if (candles.length > 0) {
                  const config = TIMEFRAME_CONFIG[timeframe];
                  const firstCandleDate = new Date(alignTimestamp(candles[0].t, config.minutes));
                  const lastCandleDate = new Date(alignTimestamp(candles[candles.length - 1].t, config.minutes));
                  
                  if (!oldestDate || firstCandleDate < oldestDate) oldestDate = firstCandleDate;
                  if (!newestDate || lastCandleDate > newestDate) newestDate = lastCandleDate;

                  const documents = candles.map(c => ({
                    symbol,
                    timestamp: new Date(alignTimestamp(c.t, config.minutes)),
                    open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v || 0,
                  }));

                  const BATCH_SIZE = 1000;
                  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                    const batch = documents.slice(i, i + BATCH_SIZE);
                    const operations = batch.map(doc => ({
                      updateOne: {
                        filter: { symbol: doc.symbol, timestamp: doc.timestamp },
                        update: { $setOnInsert: doc },
                        upsert: true,
                      },
                    }));

                    try {
                      const result = await Model.bulkWrite(operations, { ordered: false });
                      totalSaved += result.upsertedCount || 0;
                    } catch {
                      // Ignore duplicate key errors
                    }
                  }
                }
              } catch (chunkError) {
                console.error(`⚠️ [Download History] Chunk error ${symbol} ${timeframe}: ${chunkError}`);
              }

              chunkStart = chunkEnd;
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            await FetchStatus.updateOne(
              { symbol, timeframe },
              { 
                $set: { 
                  status: 'completed',
                  oldestCandleDate: oldestDate,
                  newestCandleDate: newestDate,
                  totalCandles: totalFetched,
                  lastFetchedAt: new Date(),
                  lastError: null,
                }
              }
            );

            grandTotalFetched += totalFetched;
            grandTotalSaved += totalSaved;
            console.log(`✅ [Download History] ${symbol} ${timeframe}: fetched ${totalFetched}, saved ${totalSaved}`);

          } catch (error) {
            console.error(`❌ [Download History] Error ${symbol} ${timeframe}:`, error);
            await FetchStatus.updateOne(
              { symbol, timeframe },
              { $set: { status: 'failed', lastError: error instanceof Error ? error.message : 'Unknown error', lastFetchedAt: new Date() } },
              { upsert: true }
            );
          }
        }
      }

      const duration = Math.round((Date.now() - jobStartTime) / 1000);
      console.log(`🎉 [Download History] Background job ${jobId} completed in ${duration}s - Total: ${grandTotalFetched} fetched, ${grandTotalSaved} saved`);
    })();

    // Return immediately
    return NextResponse.json({
      success: true,
      message: `Download started in background for ${symbols.length} symbols × ${validTimeframes.length} timeframes (${yearsBack} years)`,
      jobId,
      note: 'Check server logs for progress. This may take several minutes.',
    });

  } catch (error) {
    console.error('Error starting download:', error);
    return NextResponse.json({ error: 'Download failed to start' }, { status: 500 });
  }
}

/**
 * DELETE - Reset download status (allows re-downloading)
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe');
    const deleteCandles = searchParams.get('deleteCandles') === 'true';

    if (symbol && timeframe) {
      // Reset specific symbol/timeframe
      await FetchStatus.deleteOne({ symbol, timeframe });
      
      if (deleteCandles) {
        const Model = getHistoricalModel(timeframe);
        if (Model) {
          await Model.deleteMany({ symbol });
        }
      }
      
      return NextResponse.json({ success: true, message: `Reset ${symbol} ${timeframe}` });
    }

    // Reset all
    const result = await FetchStatus.deleteMany({});
    
    if (deleteCandles) {
      for (const [tf, config] of Object.entries(TIMEFRAME_CONFIG)) {
        const Model = getHistoricalModel(tf);
        if (Model) {
          await Model.deleteMany({});
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${result.deletedCount} status records${deleteCandles ? ' and all candles' : ''}` 
    });

  } catch (error) {
    console.error('Error resetting download status:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
