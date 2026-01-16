import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// All collections to clean
const COLLECTIONS_TO_CLEAN = [
  'candles_1m',
  'candles_historical_1m',
  'candles_historical_5m',
  'candles_historical_15m',
  'candles_historical_30m',
  'candles_historical_1h',
  'candles_historical_4h',
  'candles_historical_1d',
];

/**
 * POST - Run candle cleanup
 * 
 * Two modes:
 * 1. mode='keepRecent' (default): Keep last X days, delete older (current behavior)
 * 2. mode='deleteOldest': Delete the oldest X days of data (new behavior)
 * 
 * Body: {
 *   days: number,           // Number of days to keep or delete
 *   mode: 'keepRecent' | 'deleteOldest'  // default: 'deleteOldest'
 *   includeHistorical: boolean  // Include historical collections (default: true)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      days, 
      daysToKeep,  // backward compatibility
      mode = 'deleteOldest',
      includeHistorical = true 
    } = body;
    
    // Support both old 'daysToKeep' and new 'days' parameter
    const daysValue = days ?? daysToKeep ?? 30;
    
    if (daysValue < 0) {
      return NextResponse.json({ error: 'days must be 0 or greater' }, { status: 400 });
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    
    console.log(`🧹 [Cleanup] Mode: ${mode}, Days: ${daysValue}, Include Historical: ${includeHistorical}`);
    console.log(`🧹 [Cleanup] Request body:`, JSON.stringify(body));
    
    // Determine which collections to clean
    const collectionsToClean = includeHistorical 
      ? COLLECTIONS_TO_CLEAN 
      : ['candles_1m'];
    
    let totalDeleted = 0;
    let totalBefore = 0;
    let totalAfter = 0;
    const results: Record<string, { 
      deleted: number; 
      before: number; 
      after: number;
      dataRange?: { oldest: string; newest: string };
      cutoff?: string;
    }> = {};
    
    for (const collectionName of collectionsToClean) {
      // Check if collection exists
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length === 0) continue;
      
      const collection = db.collection(collectionName);
      const countBefore = await collection.countDocuments();
      
      if (countBefore === 0) continue;
      
      totalBefore += countBefore;
      
      // Determine the timestamp field (candles_1m uses 't', historical uses 'timestamp')
      const isHistorical = collectionName.includes('historical');
      const timeField = isHistorical ? 'timestamp' : 't';
      
      let deleteQuery: Record<string, unknown>;
      let cutoffDescription: string;
      
      // Get oldest and newest documents for context
      const oldestDoc = await collection.findOne({}, { sort: { [timeField]: 1 } });
      const newestDoc = await collection.findOne({}, { sort: { [timeField]: -1 } });
      
      if (!oldestDoc || !newestDoc) continue;
      
      // Get timestamps
      let oldestTime: number;
      let newestTime: number;
      if (isHistorical) {
        oldestTime = new Date(oldestDoc.timestamp).getTime();
        newestTime = new Date(newestDoc.timestamp).getTime();
      } else {
        oldestTime = oldestDoc.t * 1000;
        newestTime = newestDoc.t * 1000;
      }
      
      console.log(`🧹 [Cleanup] ${collectionName}: Data range: ${new Date(oldestTime).toISOString()} to ${new Date(newestTime).toISOString()}`);
      
      if (mode === 'deleteOldest') {
        // DELETE OLDEST: Find the oldest data and delete X days from the start
        // Calculate cutoff: oldest + days to delete
        const cutoffTime = oldestTime + (daysValue * 24 * 60 * 60 * 1000);
        const cutoffDate = new Date(cutoffTime);
        
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: cutoffDate } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }
        
        cutoffDescription = `oldest ${daysValue} days (before ${cutoffDate.toISOString()})`;
        console.log(`🧹 [Cleanup] ${collectionName}: Will delete everything before ${cutoffDate.toISOString()}`);
        
      } else {
        // KEEP RECENT: Delete anything older than X days from now
        const cutoffTime = Date.now() - (daysValue * 24 * 60 * 60 * 1000);
        const cutoffDate = new Date(cutoffTime);
        
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: cutoffDate } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }
        
        cutoffDescription = `older than ${daysValue} days (before ${cutoffDate.toISOString()})`;
        console.log(`🧹 [Cleanup] ${collectionName}: Will delete everything before ${cutoffDate.toISOString()}`);
      }
      
      // Delete
      const result = await collection.deleteMany(deleteQuery);
      const countAfter = await collection.countDocuments();
      
      console.log(`🧹 [Cleanup] ${collectionName}: Deleted ${result.deletedCount} of ${countBefore} (${cutoffDescription})`);
      
      totalDeleted += result.deletedCount;
      totalAfter += countAfter;
      
      results[collectionName] = {
        deleted: result.deletedCount,
        before: countBefore,
        after: countAfter,
        dataRange: {
          oldest: new Date(oldestTime).toISOString(),
          newest: new Date(newestTime).toISOString(),
        },
        cutoff: cutoffDescription,
      };
    }
    
    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'cleanup.lastRun': new Date() } }
      );
    }
    
    // Estimate size (avg ~200 bytes per doc)
    const avgDocSize = 200;
    const freedSpace = totalDeleted * avgDocSize;
    
    console.log(`🧹 [Cleanup] Total: Deleted ${totalDeleted} candles, freed ~${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
    
    return NextResponse.json({
      success: true,
      cleanup: {
        mode,
        days: daysValue,
        deletedCount: totalDeleted,
        includeHistorical,
        before: {
          count: totalBefore,
          sizeMB: ((totalBefore * avgDocSize) / 1024 / 1024).toFixed(2),
        },
        after: {
          count: totalAfter,
          sizeMB: ((totalAfter * avgDocSize) / 1024 / 1024).toFixed(2),
        },
        freedMB: (freedSpace / 1024 / 1024).toFixed(2),
        collections: results,
      },
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
