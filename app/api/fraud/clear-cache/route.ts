import { NextResponse } from 'next/server';
import { clearFraudSettingsCache, getFraudSettings } from '@/lib/services/fraud-settings.service';

/**
 * POST /api/fraud/clear-cache
 * Force clear the fraud settings cache
 * Called by admin panel after saving settings
 */
export async function POST() {
  try {
    // Clear the cache
    clearFraudSettingsCache();
    
    // Fetch fresh settings to verify
    const settings = await getFraudSettings();
    
    console.log('🔄 Fraud settings cache cleared and refreshed:', {
      maxAccountsPerDevice: settings.maxAccountsPerDevice,
      multiAccountDetectionEnabled: settings.multiAccountDetectionEnabled,
      deviceFingerprintingEnabled: settings.deviceFingerprintingEnabled
    });

    return NextResponse.json({
      success: true,
      message: 'Cache cleared and settings refreshed',
      currentSettings: {
        maxAccountsPerDevice: settings.maxAccountsPerDevice,
        multiAccountDetectionEnabled: settings.multiAccountDetectionEnabled,
        deviceFingerprintingEnabled: settings.deviceFingerprintingEnabled
      }
    });
  } catch (error) {
    console.error('Error clearing fraud settings cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fraud/clear-cache
 * Get current fraud settings (bypassing cache for debugging)
 */
export async function GET() {
  try {
    // Clear cache first to get fresh values
    clearFraudSettingsCache();
    const settings = await getFraudSettings();

    return NextResponse.json({
      success: true,
      settings: {
        maxAccountsPerDevice: settings.maxAccountsPerDevice,
        multiAccountDetectionEnabled: settings.multiAccountDetectionEnabled,
        deviceFingerprintingEnabled: settings.deviceFingerprintingEnabled,
        vpnDetectionEnabled: settings.vpnDetectionEnabled,
        alertThreshold: settings.alertThreshold,
        entryBlockThreshold: settings.entryBlockThreshold
      }
    });
  } catch (error) {
    console.error('Error getting fraud settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

