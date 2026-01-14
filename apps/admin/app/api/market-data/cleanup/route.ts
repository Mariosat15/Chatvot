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
    
    if (!daysToKeep || daysToKeep < 1) {
      return NextResponse.json({ error: 'daysToKeep must be at least 1' }, { status: 400 });
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
    
    // Delete old candles
    const result = await db.collection('candles_1m').deleteMany({
      t: { $lt: cutoffTime }
    });
    
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
