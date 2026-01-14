/**
 * Market Data Maintenance Job
 * 
 * Handles automatic cleanup and gap filling for 1m candles.
 * Runs on a schedule or can be triggered manually.
 */

import { connectToDatabase } from '../../database/mongoose';
import Candle1m from '../../database/models/candle-1m.model';
import mongoose from 'mongoose';

const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3000';

interface MarketDataSettings {
  cleanup: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    daysToKeep: number;
    lastRun: string | null;
    autoRunTime: string;
  };
  gapFill: {
    enabled: boolean;
    mode: 'auto' | 'manual';
    maxGapMinutes: number;
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
 * Run cleanup - deletes old candles
 */
async function runCleanup(daysToKeep: number): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
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
    
    console.log(`🧹 [Market Data Cleanup] Deleted ${deletedCount} old candles`);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('❌ [Market Data Cleanup] Error:', error);
    return { success: false, deletedCount: 0 };
  }
}

/**
 * Run gap fill via API (delegates to main app)
 */
async function runGapFill(maxGapMinutes: number): Promise<{ success: boolean; filledCount: number }> {
  try {
    const response = await fetch(`${MAIN_APP_URL}/api/admin/market-data/gap-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxGapMinutes }),
    });
    
    if (!response.ok) {
      console.error('❌ [Market Data Gap Fill] API request failed');
      return { success: false, filledCount: 0 };
    }
    
    const data = await response.json();
    console.log(`🔧 [Market Data Gap Fill] Filled ${data.gapFill?.totalCandlesFilled || 0} candles`);
    
    return { 
      success: true, 
      filledCount: data.gapFill?.totalCandlesFilled || 0 
    };
  } catch (error) {
    console.error('❌ [Market Data Gap Fill] Error:', error);
    return { success: false, filledCount: 0 };
  }
}

/**
 * Main maintenance job - runs periodically
 */
export async function runMarketDataMaintenance(): Promise<void> {
  console.log('📊 [Market Data Maintenance] Starting...');
  
  try {
    await connectToDatabase();
    
    const settings = await getSettings();
    if (!settings) {
      console.log('⏭️ [Market Data Maintenance] No settings found, skipping');
      return;
    }
    
    // Check if cleanup should run (auto mode and correct time)
    if (settings.cleanup.enabled && settings.cleanup.mode === 'auto') {
      const now = new Date();
      const [targetHour, targetMinute] = settings.cleanup.autoRunTime.split(':').map(Number);
      
      // Run if within 5 minutes of target time
      if (now.getUTCHours() === targetHour && now.getUTCMinutes() >= targetMinute && now.getUTCMinutes() < targetMinute + 5) {
        // Check if already ran today
        const lastRun = settings.cleanup.lastRun ? new Date(settings.cleanup.lastRun) : null;
        const today = new Date().toDateString();
        
        if (!lastRun || lastRun.toDateString() !== today) {
          console.log('🧹 [Market Data Maintenance] Running auto cleanup...');
          await runCleanup(settings.cleanup.daysToKeep);
        }
      }
    }
    
    // Gap fill runs in background via API calls, not here
    // This prevents duplicate gap fills
    
    console.log('✅ [Market Data Maintenance] Complete');
  } catch (error) {
    console.error('❌ [Market Data Maintenance] Error:', error);
  }
}

export default runMarketDataMaintenance;
