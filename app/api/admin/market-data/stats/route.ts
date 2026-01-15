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
    
    const collection = db.collection('candles_1m');
    
    // Get collection stats using countDocuments and $collStats (stats() is deprecated)
    let totalCount = 0;
    let storageSize = 0;
    let avgObjSize = 0;
    let indexCount = 0;
    let totalIndexSize = 0;
    
    try {
      totalCount = await collection.countDocuments();
      
      const collStats = await collection.aggregate([
        { $collStats: { storageStats: {} } }
      ]).toArray();
      
      if (collStats.length > 0 && collStats[0].storageStats) {
        storageSize = collStats[0].storageStats.size || 0;
        avgObjSize = collStats[0].storageStats.avgObjSize || 0;
        indexCount = collStats[0].storageStats.nindexes || 0;
        totalIndexSize = collStats[0].storageStats.totalIndexSize || 0;
      }
    } catch {
      // Collection might not exist yet or $collStats failed
      totalCount = 0;
      storageSize = 0;
    }
    
    // Get date range
    const oldestCandle = await collection.findOne({}, { sort: { t: 1 } });
    const newestCandle = await collection.findOne({}, { sort: { t: -1 } });
    
    // Count by symbol (top 10)
    const symbolCounts = await collection.aggregate([
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // Calculate days of data
    const daysOfData = oldestCandle && newestCandle 
      ? Math.round((newestCandle.t - oldestCandle.t) / 86400)
      : 0;
    
    // Calculate growth rate
    const candlesPerDay = daysOfData > 0 ? Math.round(totalCount / daysOfData) : 0;
    const mbPerDay = daysOfData > 0 ? (storageSize / daysOfData / 1024 / 1024).toFixed(2) : '0';
    
    return NextResponse.json({
      success: true,
      stats: {
        totalCandles: totalCount,
        storage: {
          bytes: storageSize,
          mb: (storageSize / 1024 / 1024).toFixed(2),
          gb: (storageSize / 1024 / 1024 / 1024).toFixed(3),
          avgDocBytes: Math.round(avgObjSize),
        },
        indexes: {
          count: indexCount,
          sizeMB: (totalIndexSize / 1024 / 1024).toFixed(2),
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
          status: totalCount > 500000 ? 'warning' : 'healthy',
          message: totalCount > 500000 
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
