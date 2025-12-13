import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import FraudSettings from '@/database/models/fraud/fraud-settings.model';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/admin/debug-fraud
 * Debug fraud detection system - shows all fingerprints, alerts, and settings
 */
export async function GET() {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    // Get fraud settings
    const settings = await FraudSettings.findOne();
    
    // Get all device fingerprints
    const fingerprints = await DeviceFingerprint.find({}).sort({ createdAt: -1 }).limit(20);
    
    // Get all fraud alerts
    const alerts = await FraudAlert.find({}).sort({ createdAt: -1 }).limit(20);
    
    // Count statistics
    const totalFingerprints = await DeviceFingerprint.countDocuments();
    const totalAlerts = await FraudAlert.countDocuments();
    const fingerprintsWithMultipleAccounts = await DeviceFingerprint.countDocuments({
      linkedUserIds: { $exists: true, $not: { $size: 0 } }
    });

    return NextResponse.json({
      success: true,
      debug: {
        settings: {
          enabled: {
            deviceFingerprinting: settings?.deviceFingerprintingEnabled ?? true,
            multiAccountDetection: settings?.multiAccountDetectionEnabled ?? true,
            vpnDetection: settings?.vpnDetectionEnabled ?? true
          },
          thresholds: {
            maxAccountsPerDevice: settings?.maxAccountsPerDevice ?? 3,
            alertThreshold: settings?.alertThreshold ?? 40,
            entryBlockThreshold: settings?.entryBlockThreshold ?? 70
          }
        },
        statistics: {
          totalFingerprints,
          totalAlerts,
          fingerprintsWithMultipleAccounts
        },
        recentFingerprints: fingerprints.map(fp => ({
          id: fp._id,
          fingerprintId: fp.fingerprintId.substring(0, 16) + '...',
          userId: fp.userId,
          device: `${fp.browser} on ${fp.os}`,
          linkedUserIds: fp.linkedUserIds,
          linkedAccountsCount: fp.linkedUserIds.length,
          riskScore: fp.riskScore,
          isVPN: fp.isVPN,
          isProxy: fp.isProxy,
          isTor: fp.isTor,
          createdAt: fp.createdAt
        })),
        recentAlerts: alerts.map(alert => ({
          id: alert._id,
          alertType: alert.alertType,
          severity: alert.severity,
          primaryUserId: alert.primaryUserId,
          suspiciousUserIds: alert.suspiciousUserIds,
          status: alert.status,
          title: alert.title,
          description: alert.description,
          createdAt: alert.createdAt
        }))
      }
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error debugging fraud system:', error);
    return NextResponse.json(
      { error: 'Failed to debug fraud system', details: error.message },
      { status: 500 }
    );
  }
}

