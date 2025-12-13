'use server';

import { unstable_cache, unstable_noStore as noStore } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import { DEFAULT_MARGIN_THRESHOLDS, type MarginThresholds } from '@/lib/services/margin-safety.service';

/**
 * Load margin thresholds from database (SERVER ACTION)
 * This must be called from server components or as a server action
 * 
 * IMPORTANT: Always returns valid thresholds (defaults on error)
 * This ensures admin settings failures don't break the trading platform
 * 
 * NO CACHE: Always fetches fresh data to apply admin changes immediately
 */
export async function getMarginThresholds(): Promise<MarginThresholds> {
  noStore(); // Disable caching - always fetch fresh data
  
  try {
    await connectToDatabase();
    const settings = await TradingRiskSettings.getSingleton();
    
    // Validate that settings are valid numbers
    if (
      typeof settings.marginLiquidation !== 'number' ||
      typeof settings.marginCall !== 'number' ||
      typeof settings.marginWarning !== 'number' ||
      typeof settings.marginSafe !== 'number'
    ) {
      console.error('⚠️ Invalid margin threshold values in database, using defaults');
      return DEFAULT_MARGIN_THRESHOLDS;
    }
    
    return {
      LIQUIDATION: settings.marginLiquidation,
      MARGIN_CALL: settings.marginCall,
      WARNING: settings.marginWarning,
      SAFE: settings.marginSafe,
    };
  } catch (error) {
    console.error('⚠️ Failed to load margin thresholds from database, using defaults:', error);
    return DEFAULT_MARGIN_THRESHOLDS;
  }
}

/**
 * Load all trading risk settings from database (SERVER ACTION)
 * 
 * IMPORTANT: Always returns valid settings (defaults on error)
 * This ensures admin settings failures don't break the trading platform
 * 
 * NO CACHE: Always fetches fresh data to apply admin changes immediately
 */
export async function getTradingRiskSettings() {
  noStore(); // Disable caching - always fetch fresh data
  
  try {
    await connectToDatabase();
    const settings = await TradingRiskSettings.getSingleton();
    
    return {
      // Margin Levels
      marginLiquidation: settings.marginLiquidation,
      marginCall: settings.marginCall,
      marginWarning: settings.marginWarning,
      marginSafe: settings.marginSafe,
      
      // Position Limits
      maxOpenPositions: settings.maxOpenPositions,
      maxPositionSize: settings.maxPositionSize,
      
      // Leverage Limits
      minLeverage: settings.minLeverage,
      maxLeverage: settings.maxLeverage,
      defaultLeverage: settings.defaultLeverage,
      
      // Risk Limits
      maxDrawdownPercent: settings.maxDrawdownPercent,
      dailyLossLimit: settings.dailyLossLimit,
    };
  } catch (error) {
    console.error('⚠️ Failed to load trading risk settings from database, using defaults:', error);
    return {
      marginLiquidation: 50,
      marginCall: 100,
      marginWarning: 150,
      marginSafe: 200,
      maxOpenPositions: 10,
      maxPositionSize: 100,
      minLeverage: 1,
      maxLeverage: 500,
      defaultLeverage: 10,
      maxDrawdownPercent: 50,
      dailyLossLimit: 20,
    };
  }
}

