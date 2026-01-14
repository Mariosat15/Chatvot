import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET - Get comprehensive market data statistics
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'candles_1m' }).toArray();
    if (collections.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalCandles: 0,
          storage: { bytes: 0, mb: '0', gb: '0', avgDocBytes: 0 },
          indexes: { count: 0, sizeMB: '0' },
          dateRange: { oldest: null, newest: null, daysOfData: 0 },
          growth: { candlesPerDay: 0, mbPerDay: '0', projectedMbPerMonth: '0', projectedGbPerYear: '0' },
          symbolCounts: [],
          health: { status: 'healthy', message: '✅ No candle data yet' },
        },
      });
    }
    
    // Get collection stats
    let stats;
    try {
      stats = await db.collection('candles_1m').stats();
    } catch {
      stats = { count: 0, size: 0, avgObjSize: 0, nindexes: 0, totalIndexSize: 0 };
    }
    
    // Get date range
    const oldestCandle = await db.collection('candles_1m').findOne({}, { sort: { t: 1 } });
    const newestCandle = await db.collection('candles_1m').findOne({}, { sort: { t: -1 } });
    
    // Count by symbol (top 10)
    const symbolCounts = await db.collection('candles_1m').aggregate([
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // Calculate days of data
    const daysOfData = oldestCandle && newestCandle 
      ? Math.round((newestCandle.t - oldestCandle.t) / 86400)
      : 0;
    
    // Calculate growth rate
    const candlesPerDay = daysOfData > 0 ? Math.round(stats.count / daysOfData) : 0;
    const mbPerDay = daysOfData > 0 ? (stats.size / daysOfData / 1024 / 1024).toFixed(2) : '0';
    
    return NextResponse.json({
      success: true,
      stats: {
        totalCandles: stats.count,
        storage: {
          bytes: stats.size,
          mb: (stats.size / 1024 / 1024).toFixed(2),
          gb: (stats.size / 1024 / 1024 / 1024).toFixed(3),
          avgDocBytes: Math.round(stats.avgObjSize || 0),
        },
        indexes: {
          count: stats.nindexes,
          sizeMB: ((stats.totalIndexSize || 0) / 1024 / 1024).toFixed(2),
        },
        dateRange: {
          oldest: oldestCandle ? new Date(oldestCandle.t * 1000).toISOString() : null,
          newest: newestCandle ? new Date(newestCandle.t * 1000).toISOString() : null,
          daysOfData,
        },
        growth: {
          candlesPerDay,
          mbPerDay,
          projectedMbPerMonth: (parseFloat(mbPerDay) * 30).toFixed(2),
          projectedGbPerYear: (parseFloat(mbPerDay) * 365 / 1024).toFixed(2),
        },
        symbolCounts: symbolCounts.map(s => ({
          symbol: s._id,
          count: s.count,
        })),
        health: {
          status: stats.count > 500000 ? 'warning' : 'healthy',
          message: stats.count > 500000 
            ? '⚠️ Consider running cleanup to reduce database size'
            : '✅ Database size is healthy',
        },
      },
    });
  } catch (error) {
    console.error('Error getting market data stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
