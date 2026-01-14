/**
 * Market Data Maintenance Job
 * 
 * Handles automatic cleanup for 1m candles.
 * Runs on a schedule configured by admin:
 * - Daily at specific hour
 * - Weekly on specific days (e.g., weekends)
 * - Monthly on specific week and days
 */

import { connectToDatabase } from '../../database/mongoose';
import mongoose from 'mongoose';

interface CleanupSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  hour: number; // 0-23 UTC
  weekDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  monthWeek: number; // 1-4 (which week of month)
}

interface MarketDataSettings {
  cleanup: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    daysToKeep: number;
    lastRun: string | null;
    schedule: CleanupSchedule;
  };
  gapFill: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    lastRun: string | null;
  };
}

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
  const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentDate = now.getUTCDate();
  
  // Check if current hour matches
  if (currentHour !== schedule.hour) {
    return false;
  }
  
  // Check if already ran today
  if (lastRun) {
    const lastRunDate = new Date(lastRun);
    if (lastRunDate.toDateString() === now.toDateString()) {
      return false; // Already ran today
    }
  }
  
  switch (schedule.type) {
    case 'daily':
      return true; // Runs every day at specified hour
      
    case 'weekly':
      // Check if today is one of the configured days
      return schedule.weekDays.includes(currentDay);
      
    case 'monthly':
      // Check if we're in the correct week and day
      const weekOfMonth = Math.ceil(currentDate / 7);
      if (weekOfMonth !== schedule.monthWeek) {
        return false;
      }
      return schedule.weekDays.includes(currentDay);
      
    default:
      return false;
  }
}

/**
 * Run cleanup - deletes old candles
 * Uses timestamp comparison: t < cutoffTime (Unix seconds)
 */
async function runCleanup(daysToKeep: number): Promise<{ success: boolean; deletedCount: number }> {
  try {
    // Calculate cutoff timestamp in seconds
    // t field stores Unix timestamp in seconds (e.g., 1768348800)
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    const cutoffDate = new Date(cutoffTime * 1000);
    
    console.log(`🧹 [Cleanup] Deleting candles older than ${cutoffDate.toISOString()} (${daysToKeep} days ago)`);
    console.log(`   Cutoff timestamp: ${cutoffTime} (comparing t < ${cutoffTime})`);
    
    const result = await mongoose.connection.db?.collection('candles_1m').deleteMany({
      t: { $lt: cutoffTime }
    });
    
    const deletedCount = result?.deletedCount || 0;
    
    // Update last run time
    const MarketDataSettingsModel = mongoose.models.MarketDataSettings;
    if (MarketDataSettingsModel) {
      await MarketDataSettingsModel.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'cleanup.lastRun': new Date() } }
      );
    }
    
    console.log(`🧹 [Market Data Cleanup] Deleted ${deletedCount} candles older than ${daysToKeep} days`);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('❌ [Market Data Cleanup] Error:', error);
    return { success: false, deletedCount: 0 };
  }
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
        await runCleanup(settings.cleanup.daysToKeep);
      }
    }
    
    // Gap fill runs in background via API calls during chart requests, not here
    // This prevents duplicate work and ensures gaps are filled when users need data
    
  } catch (error) {
    console.error('❌ [Market Data Maintenance] Error:', error);
  }
}

export default runMarketDataMaintenance;
