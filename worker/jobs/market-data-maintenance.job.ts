/**
 * Market Data Maintenance Job
 * 
 * Handles automatic cleanup for candle data.
 * Supports two independent cleanup modes:
 * 1. Delete Oldest: Remove the oldest X days of data (maintains constant size)
 * 2. Keep Recent: Keep only last X days (removes old data)
 * 
 * Both can run simultaneously for precise database management.
 */

import { connectToDatabase } from '../../database/mongoose';
import mongoose from 'mongoose';

interface CleanupSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  hour: number; // 0-23 UTC
  minute?: number; // 0-59 UTC
  weekDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  monthWeek?: number; // 1-4 (which week of month)
  monthDay?: number; // 1-28 (day of month)
}

interface CleanupTypeConfig {
  enabled: boolean;
  days: number;
}

interface MarketDataSettings {
  cleanup: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    daysToKeep: number; // Legacy
    deleteOldest?: CleanupTypeConfig;
    keepRecent?: CleanupTypeConfig;
    includeHistorical?: boolean;
    lastRun: string | null;
    lastResults?: unknown;
    schedule: CleanupSchedule;
  };
  gapFill: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    lastRun: string | null;
  };
}

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
  'candles_historical_1w',
  'candles_historical_1M',
];

/**
 * Get market data settings from MongoDB
 */
async function getSettings(): Promise<MarketDataSettings | null> {
  try {
    const MarketDataSettingsModel = mongoose.models.MarketDataSettings;
    if (!MarketDataSettingsModel) return null;
    
    const settings = await MarketDataSettingsModel.findOne({ key: 'market_data_settings' });
    return settings;
  } catch {
    return null;
  }
}

/**
 * Check if cleanup should run based on schedule
 */
function shouldRunCleanup(schedule: CleanupSchedule, lastRun: Date | null): boolean {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentDate = now.getUTCDate();
  
  // Check if current hour matches (within the minute window)
  const scheduleMinute = schedule.minute ?? 0;
  if (currentHour !== schedule.hour) {
    return false;
  }
  
  // Only trigger in the first 5 minutes of the scheduled hour
  if (currentMinute > 5) {
    return false;
  }
  
  // Check if already ran today
  if (lastRun) {
    const lastRunDate = new Date(lastRun);
    const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastRun < 23) {
      return false; // Already ran within last 23 hours
    }
  }
  
  switch (schedule.type) {
    case 'daily':
      return true; // Runs every day at specified hour
      
    case 'weekly':
      // Check if today is one of the configured days
      return schedule.weekDays.includes(currentDay);
      
    case 'monthly':
      // Check if we're on the correct day of month
      if (schedule.monthDay && currentDate === schedule.monthDay) {
        return true;
      }
      // Or check week + day combination
      if (schedule.monthWeek) {
        const weekOfMonth = Math.ceil(currentDate / 7);
        if (weekOfMonth !== schedule.monthWeek) {
          return false;
        }
        return schedule.weekDays.includes(currentDay);
      }
      return false;
      
    default:
      return false;
  }
}

interface CleanupResult {
  success: boolean;
  deletedCount: number;
  collections: Record<string, { deleted: number; before: number; after: number }>;
}

/**
 * Run cleanup with both modes
 */
async function runCleanup(
  deleteOldest: CleanupTypeConfig,
  keepRecent: CleanupTypeConfig,
  includeHistorical: boolean
): Promise<CleanupResult> {
  const db = mongoose.connection.db;
  if (!db) {
    return { success: false, deletedCount: 0, collections: {} };
  }
  
  console.log(`🧹 [Auto Cleanup] Starting...`);
  console.log(`   Delete Oldest: ${deleteOldest.enabled ? `${deleteOldest.days} days` : 'OFF'}`);
  console.log(`   Keep Recent: ${keepRecent.enabled ? `${keepRecent.days} days` : 'OFF'}`);
  console.log(`   Include Historical: ${includeHistorical}`);
  
  const collectionsToClean = includeHistorical ? COLLECTIONS_TO_CLEAN : ['candles_1m'];
  let totalDeleted = 0;
  const results: Record<string, { deleted: number; before: number; after: number }> = {};
  
  for (const collectionName of collectionsToClean) {
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length === 0) continue;
      
      const collection = db.collection(collectionName);
      const countBefore = await collection.countDocuments();
      if (countBefore === 0) continue;
      
      const isHistorical = collectionName.includes('historical');
      const timeField = isHistorical ? 'timestamp' : 't';
      
      // Get oldest document for deleteOldest calculation
      const oldestDoc = await collection.findOne({}, { sort: { [timeField]: 1 } });
      if (!oldestDoc) continue;
      
      let oldestTime: number;
      if (isHistorical) {
        oldestTime = new Date(oldestDoc.timestamp).getTime();
      } else {
        oldestTime = oldestDoc.t * 1000;
      }
      
      let collectionDeleted = 0;
      
      // Delete Oldest operation
      if (deleteOldest.enabled && deleteOldest.days > 0) {
        const cutoffTime = oldestTime + (deleteOldest.days * 24 * 60 * 60 * 1000);
        let deleteQuery: Record<string, unknown>;
        
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: new Date(cutoffTime) } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }
        
        const result = await collection.deleteMany(deleteQuery);
        collectionDeleted += result.deletedCount;
        console.log(`   ${collectionName}: Deleted oldest ${deleteOldest.days} days = ${result.deletedCount} records`);
      }
      
      // Keep Recent operation
      if (keepRecent.enabled && keepRecent.days >= 0) {
        const cutoffTime = Date.now() - (keepRecent.days * 24 * 60 * 60 * 1000);
        let deleteQuery: Record<string, unknown>;
        
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: new Date(cutoffTime) } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }
        
        const result = await collection.deleteMany(deleteQuery);
        collectionDeleted += result.deletedCount;
        console.log(`   ${collectionName}: Keep recent ${keepRecent.days} days = ${result.deletedCount} records removed`);
      }
      
      const countAfter = await collection.countDocuments();
      totalDeleted += collectionDeleted;
      
      results[collectionName] = {
        deleted: collectionDeleted,
        before: countBefore,
        after: countAfter,
      };
      
    } catch (error) {
      console.error(`   ${collectionName}: Error - ${error}`);
    }
  }
  
  // Update settings with results
  const MarketDataSettingsModel = mongoose.models.MarketDataSettings;
  if (MarketDataSettingsModel) {
    await MarketDataSettingsModel.findOneAndUpdate(
      { key: 'market_data_settings' },
      { 
        $set: { 
          'cleanup.lastRun': new Date(),
          'cleanup.lastResults': {
            success: true,
            deleteOldest,
            keepRecent,
            includeHistorical,
            deletedCount: totalDeleted,
            collections: results,
            timestamp: new Date().toISOString(),
          },
        } 
      }
    );
  }
  
  console.log(`🧹 [Auto Cleanup] Complete: Deleted ${totalDeleted} total records`);
  
  return { success: true, deletedCount: totalDeleted, collections: results };
}

/**
 * Main maintenance job - runs periodically (every 5 minutes by default)
 * Checks if cleanup should run based on admin-configured schedule
 */
export async function runMarketDataMaintenance(): Promise<void> {
  try {
    await connectToDatabase();
    
    const settings = await getSettings();
    if (!settings) {
      return; // No settings, skip silently
    }
    
    // Check if auto cleanup should run
    if (settings.cleanup.enabled && settings.cleanup.mode === 'auto') {
      const lastRun = settings.cleanup.lastRun ? new Date(settings.cleanup.lastRun) : null;
      
      if (shouldRunCleanup(settings.cleanup.schedule, lastRun)) {
        console.log('🧹 [Market Data Maintenance] Schedule triggered, running auto cleanup...');
        console.log(`   Schedule: ${settings.cleanup.schedule.type} at ${settings.cleanup.schedule.hour}:00 UTC`);
        if (settings.cleanup.schedule.type !== 'daily') {
          console.log(`   Days: ${settings.cleanup.schedule.weekDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`);
        }
        
        // Use new cleanup config if available, fallback to legacy
        const deleteOldest = settings.cleanup.deleteOldest ?? { enabled: true, days: settings.cleanup.daysToKeep };
        const keepRecent = settings.cleanup.keepRecent ?? { enabled: false, days: 365 };
        const includeHistorical = settings.cleanup.includeHistorical ?? true;
        
        await runCleanup(deleteOldest, keepRecent, includeHistorical);
      }
    }
    
  } catch (error) {
    console.error('❌ [Market Data Maintenance] Error:', error);
  }
}

export default runMarketDataMaintenance;
