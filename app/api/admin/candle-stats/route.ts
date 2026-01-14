import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Get candle database statistics
 * Use this to monitor database growth
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    // Get collection stats
    const stats = await db.collection('candles_1m').stats();
    
    // Get date range
    const oldestCandle = await db.collection('candles_1m').findOne({}, { sort: { t: 1 } });
    const newestCandle = await db.collection('candles_1m').findOne({}, { sort: { t: -1 } });
    
    // Count by symbol
    const symbolCounts = await db.collection('candles_1m').aggregate([
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    return NextResponse.json({
      totalCandles: stats.count,
      storage: {
        bytes: stats.size,
        mb: (stats.size / 1024 / 1024).toFixed(2),
        avgDocBytes: Math.round(stats.avgObjSize || 0),
      },
      indexes: {
        count: stats.nindexes,
        sizeBytes: stats.totalIndexSize,
        sizeMB: (stats.totalIndexSize / 1024 / 1024).toFixed(2),
      },
      dateRange: {
        oldest: oldestCandle ? new Date(oldestCandle.t * 1000).toISOString() : null,
        newest: newestCandle ? new Date(newestCandle.t * 1000).toISOString() : null,
        daysOfData: oldestCandle && newestCandle 
          ? Math.round((newestCandle.t - oldestCandle.t) / 86400) 
          : 0,
      },
      symbolCounts: symbolCounts.slice(0, 10), // Top 10 symbols
      projectedGrowth: {
        perDay: '~9.5 MB',
        perMonth: '~285 MB',
        perYear: '~3.4 GB',
      },
      recommendation: stats.count > 500000 
        ? '⚠️ Consider running cleanup script to remove old candles'
        : '✅ Database size is healthy',
    });
  } catch (error) {
    console.error('Error getting candle stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
