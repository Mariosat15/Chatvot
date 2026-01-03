import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import FraudSettings, { DEFAULT_FRAUD_SETTINGS } from '@/database/models/fraud/fraud-settings.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/fraud/settings
 * Get fraud detection settings (admin only)
 */
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Get settings (create default if doesn't exist)
    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    }

    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings))
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching fraud settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/fraud/settings
 * Update fraud detection settings (admin only)
 */
export async function PUT(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json();

    // Get or create settings
    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    }

    // Update settings
    Object.assign(settings, {
      ...body,
      updatedAt: new Date(),
      // TODO: Get admin user ID from session
      updatedBy: 'admin'
    });

    await settings.save();

    console.log('✅ Fraud settings updated:', {
      deviceFingerprinting: settings.deviceFingerprintingEnabled,
      vpnDetection: settings.vpnDetectionEnabled,
      entryBlockThreshold: settings.entryBlockThreshold
    });

    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
      message: 'Settings updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating fraud settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fraud/settings/reset
 * Reset to default settings AND clear all fraud-related data (admin only)
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Parse body to check if we should also clear fraud data
    const body = await request.json().catch(() => ({}));
    const clearFraudData = body.clearFraudData !== false; // Default to true

    let settings = await FraudSettings.findOne();
    
    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    } else {
      Object.assign(settings, DEFAULT_FRAUD_SETTINGS);
      settings.updatedAt = new Date();
      await settings.save();
    }

    let clearedData = {
      lockouts: 0,
      fraudAlerts: 0,
      deviceFingerprints: 0,
    };

    // Also clear all fraud-related data if requested
    if (clearFraudData) {
      try {
        // Clear all active account lockouts
        const AccountLockout = (await import('@/database/models/account-lockout.model')).default;
        const lockoutResult = await AccountLockout.updateMany(
          { isActive: true },
          { 
            $set: { 
              isActive: false, 
              unlockedAt: new Date(),
              unlockedReason: 'Admin fraud settings reset' 
            }
          }
        );
        clearedData.lockouts = lockoutResult.modifiedCount;
        console.log(`🔓 Cleared ${lockoutResult.modifiedCount} active lockouts`);

        // Clear pending fraud alerts (optional - mark as dismissed)
        const FraudAlert = (await import('@/database/models/fraud/fraud-alert.model')).default;
        const alertResult = await FraudAlert.updateMany(
          { status: 'pending' },
          { $set: { status: 'dismissed', resolvedAt: new Date(), resolvedBy: 'system_reset' } }
        );
        clearedData.fraudAlerts = alertResult.modifiedCount;
        console.log(`🚨 Dismissed ${alertResult.modifiedCount} pending fraud alerts`);

        // Note: Device fingerprints are NOT cleared as they're used for tracking
        // Only the risk scores could be reset if needed

      } catch (clearError) {
        console.error('Error clearing fraud data:', clearError);
        // Continue even if clearing fails
      }
    }

    console.log('✅ Fraud settings reset to defaults');

    return NextResponse.json({
      success: true,
      settings: JSON.parse(JSON.stringify(settings)),
      clearedData,
      message: clearFraudData 
        ? `Settings reset to defaults. Cleared ${clearedData.lockouts} lockouts and ${clearedData.fraudAlerts} fraud alerts.`
        : 'Settings reset to defaults'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error resetting fraud settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}

