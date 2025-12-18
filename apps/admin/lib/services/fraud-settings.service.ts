/**
 * Fraud Settings Service
 * 
 * Centralized service to get fraud detection settings
 * with caching for performance
 */

import { connectToDatabase } from '@/database/mongoose';
import FraudSettings, { DEFAULT_FRAUD_SETTINGS, IFraudSettings } from '@/database/models/fraud/fraud-settings.model';

// Cache settings for 5 minutes
let cachedSettings: IFraudSettings | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get fraud detection settings (with caching)
 */
export async function getFraudSettings(): Promise<IFraudSettings> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTime) < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    await connectToDatabase();
    
    let settings = await FraudSettings.findOne().lean() as IFraudSettings | null;
    
    // Create default settings if none exist
    if (!settings) {
      const created = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
      settings = created.toObject() as IFraudSettings;
    }

    // Update cache
    cachedSettings = settings;
    cacheTime = now;

    return cachedSettings;
  } catch (error) {
    console.error('Error fetching fraud settings, using defaults:', error);
    return DEFAULT_FRAUD_SETTINGS as IFraudSettings;
  }
}

/**
 * Clear settings cache (call after updating settings)
 */
export function clearFraudSettingsCache() {
  cachedSettings = null;
  cacheTime = 0;
}

/**
 * Check if device fingerprinting is enabled
 */
export async function isDeviceFingerprintingEnabled(): Promise<boolean> {
  const settings = await getFraudSettings();
  return settings.deviceFingerprintingEnabled;
}

/**
 * Check if VPN detection is enabled
 */
export async function isVPNDetectionEnabled(): Promise<boolean> {
  const settings = await getFraudSettings();
  return settings.vpnDetectionEnabled;
}

/**
 * Get entry block threshold
 */
export async function getEntryBlockThreshold(): Promise<number> {
  const settings = await getFraudSettings();
  return settings.entryBlockThreshold;
}

/**
 * Check if entry should be blocked based on risk score
 */
export async function shouldBlockEntry(riskScore: number): Promise<boolean> {
  const settings = await getFraudSettings();
  return riskScore > settings.entryBlockThreshold;
}

/**
 * Check if alert should be created based on risk score
 */
export async function shouldCreateAlert(riskScore: number): Promise<boolean> {
  const settings = await getFraudSettings();
  return riskScore > settings.alertThreshold;
}

