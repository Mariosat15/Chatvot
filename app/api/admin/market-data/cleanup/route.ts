import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * Helper to get collection stats without deprecated .stats() method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCollectionStats(collection: any) {
  const count = await collection.countDocuments();
  let size = 0;
  
  try {
    const collStats = await collection.aggregate([
      { $collStats: { storageStats: {} } }
    ]).toArray();
    
    if (collStats.length > 0 && collStats[0].storageStats) {
      size = collStats[0].storageStats.size || 0;
    }
  } catch {
    // Fallback: estimate based on count
    size = count * 100;
  }
  
  return { count, size };
}

/**
 * POST - Run candle cleanup (delete old candles)
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { daysToKeep } = body;
    
    // Allow 0 days to delete all
    if (daysToKeep === undefined || daysToKeep < 0) {
      return NextResponse.json({ error: 'daysToKeep must be 0 or greater' }, { status: 400 });
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    const collection = db.collection('candles_1m');
    
    // Get stats before cleanup
    const { count: countBefore, size: sizeBefore } = await getCollectionStats(collection);
    
    // Calculate cutoff timestamp (in seconds)
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    const cutoffDate = new Date(cutoffTime * 1000);
    
    // Delete old candles
    const result = await collection.deleteMany({
      t: { $lt: cutoffTime }
    });
    
    // Get stats after cleanup
    const { count: countAfter, size: sizeAfter } = await getCollectionStats(collection);
    
    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'cleanup.lastRun': new Date() } }
      );
    }
    
    const freedSpace = sizeBefore - sizeAfter;
    
    console.log(`🧹 [Cleanup] Deleted ${result.deletedCount} candles older than ${cutoffDate.toISOString()}`);
    console.log(`📊 [Cleanup] Freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
    
    return NextResponse.json({
      success: true,
      cleanup: {
        deletedCount: result.deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        daysKept: daysToKeep,
        before: {
          count: countBefore,
          sizeMB: (sizeBefore / 1024 / 1024).toFixed(2),
        },
        after: {
          count: countAfter,
          sizeMB: (sizeAfter / 1024 / 1024).toFixed(2),
        },
        freedMB: (freedSpace / 1024 / 1024).toFixed(2),
      },
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
