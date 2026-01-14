import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

const MASSIVE_API_BASE_URL = 'https://api.massive.com';
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || process.env.NEXT_PUBLIC_MASSIVE_API_KEY;

// Candle1m schema (define locally to avoid cross-app imports)
const Candle1mSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  t: { type: Number, required: true },
  o: { type: Number, required: true },
  h: { type: Number, required: true },
  l: { type: Number, required: true },
  c: { type: Number, required: true },
  v: { type: Number, default: 0 },
}, { timestamps: false, collection: 'candles_1m' });

Candle1mSchema.index({ symbol: 1, t: 1 }, { unique: true });

const Candle1m = mongoose.models.Candle1m || mongoose.model('Candle1m', Candle1mSchema);

/**
 * Convert symbol format (EUR/USD) to Massive format (C:EURUSD)
 */
function symbolToMassiveFormat(symbol: string): string {
  const cleanSymbol = symbol.replace('/', '');
  return `C:${cleanSymbol}`;
}

/**
 * Fetch candles from Massive.com for a date range
 */
async function fetchCandlesFromMassive(
  symbol: string,
  fromMs: number,
  toMs: number
): Promise<Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>> {
  if (!MASSIVE_API_KEY) {
    throw new Error('MASSIVE_API_KEY is not configured');
  }

  const ticker = symbolToMassiveFormat(symbol);
  const endpoint = `/v2/aggs/ticker/${ticker}/range/1/minute/${fromMs}/${toMs}`;
  const url = `${MASSIVE_API_BASE_URL}${endpoint}?adjusted=true&sort=asc&limit=50000&apiKey=${MASSIVE_API_KEY}`;

  console.log(`🌐 [Massive API] Requesting: ${ticker} from ${new Date(fromMs).toISOString()} to ${new Date(toMs).toISOString()}`);

  const response = await fetch(url, { cache: 'no-store' });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Massive API] Error ${response.status}: ${errorText}`);
    throw new Error(`Massive.com API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.results && data.results.length > 0) {
    const firstResult = data.results[0];
    const lastResult = data.results[data.results.length - 1];
    console.log(`✅ [Massive API] Got ${data.results.length} candles`);
    console.log(`   First: ${new Date(firstResult.t).toISOString()}`);
    console.log(`   Last: ${new Date(lastResult.t).toISOString()}`);
  } else {
    console.log(`⚠️ [Massive API] No results returned for ${ticker}`);
  }
  
  return data.results || [];
}

/**
 * GET - Get seeding status/info
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    // Check API key
    const hasApiKey = !!MASSIVE_API_KEY;
    
    // Get current candle stats per symbol
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const symbolStats = await db.collection('candles_1m').aggregate([
      { 
        $group: { 
          _id: '$symbol', 
          count: { $sum: 1 },
          oldest: { $min: '$t' },
          newest: { $max: '$t' }
        } 
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    return NextResponse.json({
      success: true,
      hasApiKey,
      symbolStats: symbolStats.map(s => ({
        symbol: s._id,
        count: s.count,
        oldest: s.oldest ? new Date(s.oldest * 1000).toISOString() : null,
        newest: s.newest ? new Date(s.newest * 1000).toISOString() : null,
        daysOfData: s.oldest && s.newest ? Math.round((s.newest - s.oldest) / 86400) : 0,
      })),
    });
  } catch (error) {
    console.error('Error getting seed info:', error);
    return NextResponse.json({ error: 'Failed to get seed info' }, { status: 500 });
  }
}

/**
 * POST - Seed historical data for selected symbols
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    if (!MASSIVE_API_KEY) {
      return NextResponse.json({ error: 'MASSIVE_API_KEY is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { symbols, fromDate, toDate } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array is required' }, { status: 400 });
    }

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 });
    }

    const fromMs = new Date(fromDate).getTime();
    const toMs = new Date(toDate).getTime();

    if (fromMs >= toMs) {
      return NextResponse.json({ error: 'fromDate must be before toDate' }, { status: 400 });
    }

    // Calculate date range in days
    const days = Math.ceil((toMs - fromMs) / (1000 * 60 * 60 * 24));
    
    console.log(`📥 [Seed History] Starting: ${symbols.length} symbols, ${days} days`);
    console.log(`📥 [Seed History] From: ${fromDate} (${fromMs}ms = ${new Date(fromMs).toISOString()})`);
    console.log(`📥 [Seed History] To: ${toDate} (${toMs}ms = ${new Date(toMs).toISOString()})`);

    const results: Array<{
      symbol: string;
      fetched: number;
      inserted: number;
      skipped: number;
      error?: string;
    }> = [];

    // Process each symbol
    for (const symbol of symbols) {
      try {
        console.log(`📊 [Seed History] Processing ${symbol}...`);
        
        // Fetch from Massive.com in chunks (1 week at a time to avoid API limits)
        let totalFetched = 0;
        let totalInserted = 0;
        let totalSkipped = 0;

        const chunkSize = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        let chunkStart = fromMs;

        while (chunkStart < toMs) {
          const chunkEnd = Math.min(chunkStart + chunkSize, toMs);
          
          const candles = await fetchCandlesFromMassive(symbol, chunkStart, chunkEnd);
          totalFetched += candles.length;

          if (candles.length > 0) {
            // Debug: Log first candle time
            const firstCandle = candles[0];
            const firstTimeSeconds = Math.floor(firstCandle.t / 1000);
            console.log(`📊 [Seed Debug] First candle: t=${firstCandle.t}ms = ${firstTimeSeconds}s = ${new Date(firstCandle.t).toISOString()}`);
            
            // Check if this candle already exists
            const existingCheck = await mongoose.connection.db?.collection('candles_1m').findOne({
              symbol,
              t: firstTimeSeconds,
            });
            console.log(`📊 [Seed Debug] Existing check for ${symbol} t=${firstTimeSeconds}: ${existingCheck ? 'FOUND' : 'NOT FOUND'}`);
            
            if (existingCheck) {
              console.log(`📊 [Seed Debug] Existing candle: ${JSON.stringify(existingCheck)}`);
            }
            
            // Bulk upsert to MongoDB
            const bulkOps = candles.map((c) => ({
              updateOne: {
                filter: { symbol, t: Math.floor(c.t / 1000) },
                update: {
                  $setOnInsert: { symbol },
                  $set: {
                    o: c.o,
                    h: c.h,
                    l: c.l,
                    c: c.c,
                    v: c.v || 0,
                  },
                },
                upsert: true,
              },
            }));

            const result = await Candle1m.bulkWrite(bulkOps, { ordered: false });
            
            // Debug: Log the actual result object
            console.log(`📊 [Seed Debug] BulkWrite result: upserted=${result.upsertedCount}, matched=${result.matchedCount}, modified=${result.modifiedCount}`);
            
            totalInserted += result.upsertedCount || 0;
            // Only count as skipped if it was matched (already existed)
            totalSkipped += result.matchedCount || 0;
          }

          chunkStart = chunkEnd;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ [Seed History] ${symbol}: fetched ${totalFetched}, inserted ${totalInserted}, skipped ${totalSkipped}`);
        
        results.push({
          symbol,
          fetched: totalFetched,
          inserted: totalInserted,
          skipped: totalSkipped,
        });

      } catch (symbolError) {
        console.error(`❌ [Seed History] Error for ${symbol}:`, symbolError);
        results.push({
          symbol,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          error: symbolError instanceof Error ? symbolError.message : 'Unknown error',
        });
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
    
    console.log(`📥 [Seed History] Complete: ${totalFetched} fetched, ${totalInserted} inserted`);

    return NextResponse.json({
      success: true,
      summary: {
        symbols: symbols.length,
        days,
        totalFetched,
        totalInserted,
      },
      results,
    });

  } catch (error) {
    console.error('Error seeding history:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
