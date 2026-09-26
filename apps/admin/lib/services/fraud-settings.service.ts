/**
 * Fraud Settings Service
 *
 * Centralized service to get fraud detection settings
 * with caching for performance
 */

import { connectToDatabase } from "@/database/mongoose";
import FraudSettings, {
  DEFAULT_FRAUD_SETTINGS,
  IFraudSettings,
} from "@/database/models/fraud/fraud-settings.model";

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
  if (cachedSettings && now - cacheTime < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    await connectToDatabase();

    let settings =
      (await FraudSettings.findOne().lean()) as IFraudSettings | null;

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
    console.error("Error fetching fraud settings, using defaults:", error);
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
 * Get the score at which an account is escalated for review.
 *
 * Reason: named `entryBlockThreshold` in the schema for backward compatibility,
 * but it no longer blocks anything. See the note on the model field.
 */
export async function getEntryBlockThreshold(): Promise<number> {
  const settings = await getFraudSettings();
  return settings.entryBlockThreshold;
}

// Reason: `shouldBlockEntry(riskScore)` was removed on 2 September 2026, in both
// apps together. It returned `riskScore > entryBlockThreshold`, encoding the
// silent, unliftable entry block that locked a real player out - see the long
// note in the main app's `fraud/entry-fraud-gate.service.ts` section 4. It was
// dead code when removed, which is why it was worth deleting: a plausibly-named
// helper is how a removed policy comes back.
//
// A suspicion score escalates for human review. It does not block. To block an
// account, create a `UserRestriction`, which is visible and can be lifted.

/**
 * Check if alert should be created based on risk score
 */
export async function shouldCreateAlert(riskScore: number): Promise<boolean> {
  const settings = await getFraudSettings();
  return riskScore > settings.alertThreshold;
}
