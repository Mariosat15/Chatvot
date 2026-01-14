import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * POST - Run candle cleanup (delete old candles)
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { daysToKeep } = body;
    
    // Allow 0 to delete ALL history
    if (daysToKeep === undefined || daysToKeep === null || daysToKeep < 0) {
      return NextResponse.json({ error: 'daysToKeep must be 0 or greater' }, { status: 400 });
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'candles_1m' }).toArray();
    if (collections.length === 0) {
      return NextResponse.json({
        success: true,
        cleanup: {
          deletedCount: 0,
          cutoffDate: new Date().toISOString(),
          daysKept: daysToKeep,
          before: { count: 0, sizeMB: '0' },
          after: { count: 0, sizeMB: '0' },
          freedMB: '0',
        },
      });
    }
    
    // Get count before cleanup (use countDocuments instead of deprecated stats)
    const countBefore = await db.collection('candles_1m').countDocuments();
    
    // Calculate cutoff timestamp (in seconds)
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    const cutoffDate = new Date(cutoffTime * 1000);
    
    // Debug: Log what we're about to delete
    console.log(`🧹 [Cleanup] Database: ${db.databaseName}`);
    console.log(`🧹 [Cleanup] Candles before: ${countBefore}`);
    console.log(`🧹 [Cleanup] Days to keep: ${daysToKeep}`);
    console.log(`🧹 [Cleanup] Cutoff time: ${cutoffTime} (${cutoffDate.toISOString()})`);
    
    // Check a sample candle to see its timestamp format
    const sampleCandle = await db.collection('candles_1m').findOne({});
    if (sampleCandle) {
      console.log(`🧹 [Cleanup] Sample candle: t=${sampleCandle.t}, date=${new Date(sampleCandle.t * 1000).toISOString()}`);
      console.log(`🧹 [Cleanup] Will delete: t < ${cutoffTime} (${sampleCandle.t < cutoffTime ? 'YES this sample would be deleted' : 'NO this sample would be kept'})`);
    }
    
    // Count how many WILL be deleted (before actually deleting)
    const toDeleteCount = await db.collection('candles_1m').countDocuments({
      t: { $lt: cutoffTime }
    });
    console.log(`🧹 [Cleanup] Candles matching delete criteria: ${toDeleteCount}`);
    
    // Delete old candles
    const result = await db.collection('candles_1m').deleteMany({
      t: { $lt: cutoffTime }
    });
    
    console.log(`🧹 [Cleanup] Delete result: acknowledged=${result.acknowledged}, deletedCount=${result.deletedCount}`);
    
    // Get count after cleanup
    const countAfter = await db.collection('candles_1m').countDocuments();
    
    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'cleanup.lastRun': new Date() } }
      );
    }
    
    // Estimate size based on average document size (~200 bytes)
    const avgDocSize = 200;
    const sizeBefore = countBefore * avgDocSize;
    const sizeAfter = countAfter * avgDocSize;
    const freedSpace = (countBefore - countAfter) * avgDocSize;
    
    console.log(`🧹 [Cleanup] Deleted ${result.deletedCount} candles older than ${cutoffDate.toISOString()}`);
    console.log(`📊 [Cleanup] Freed ~${(freedSpace / 1024 / 1024).toFixed(2)} MB (estimated)`);
    
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
