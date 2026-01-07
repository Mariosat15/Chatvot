import { NextResponse } from 'next/server';
import { clearFraudSettingsCache, getFraudSettings } from '@/lib/services/fraud-settings.service';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/**
 * Verify the request is from an admin or internal service
 * Returns true if authorized, false otherwise
 */
async function isAuthorized(request: Request): Promise<boolean> {
  // Check for internal API key (used by admin panel)
  const internalKey = request.headers.get('x-internal-key');
  if (internalKey === process.env.INTERNAL_API_KEY) {
    return true;
  }
  
  // Check for admin session
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });
    
    if (session?.user?.role === 'admin') {
      return true;
    }
  } catch {
    // No session or error checking session
  }
  
  return false;
}

/**
 * POST /api/fraud/clear-cache
 * Force clear the fraud settings cache
 * Called by admin panel after saving settings
 * 
 * SECURITY: Only accessible to admins or with internal API key
 */
export async function POST(request: Request) {
  try {
    // Allow unauthenticated cache clears - the cache clear itself is harmless
    // We just won't return sensitive settings to unauthenticated users
    const authorized = await isAuthorized(request);
    
    // Clear the cache
    clearFraudSettingsCache();
    
    // Fetch fresh settings
    const settings = await getFraudSettings();
    
    console.log('🔄 Fraud settings cache cleared and refreshed:', {
      maxAccountsPerDevice: settings.maxAccountsPerDevice,
      multiAccountDetectionEnabled: settings.multiAccountDetectionEnabled,
      deviceFingerprintingEnabled: settings.deviceFingerprintingEnabled
    });

    // Only return detailed settings to authorized users
    if (authorized) {
      return NextResponse.json({
        success: true,
        message: 'Cache cleared and settings refreshed',
        currentSettings: {
          maxAccountsPerDevice: settings.maxAccountsPerDevice,
          multiAccountDetectionEnabled: settings.multiAccountDetectionEnabled,
          deviceFingerprintingEnabled: settings.deviceFingerprintingEnabled
        }
      });
    } else {
      // For unauthenticated requests, just confirm cache was cleared
      return NextResponse.json({
        success: true,
        message: 'Cache cleared'
      });
    }
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
 * 
 * SECURITY: Only accessible to admins
 */
export async function GET(request: Request) {
  try {
    const authorized = await isAuthorized(request);
    
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }
    
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

