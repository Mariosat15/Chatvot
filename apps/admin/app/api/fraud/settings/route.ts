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

// Note: POST for reset is now at /api/fraud/settings/reset/route.ts

