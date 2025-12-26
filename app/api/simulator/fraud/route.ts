import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';

/**
 * POST /api/simulator/fraud
 * Simulator endpoint to test fraud detection patterns
 */
export async function POST(request: NextRequest) {
  // Only allow in development or with simulator mode header
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { 
      userId,
      fingerprintId,
      browser = 'SimBrowser',
      os = 'SimOS',
      screenResolution = '1920x1080',
      ipAddress,
    } = body;

    if (!userId || !fingerprintId) {
      return NextResponse.json(
        { success: false, error: 'userId and fingerprintId are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if this fingerprint already exists for another user
    const existingFingerprint = await DeviceFingerprint.findOne({ 
      fingerprintId,
      userId: { $ne: userId },
    });

    let riskScore = 0;
    const flags: string[] = [];

    if (existingFingerprint) {
      // Multiple accounts with same fingerprint - suspicious!
      riskScore = 85;
      flags.push('multi_account_suspected');
      flags.push('shared_device');
    }

    // Upsert the fingerprint record with all required fields
    await DeviceFingerprint.findOneAndUpdate(
      { fingerprintId, userId },
      {
        $set: {
          userId,
          fingerprintId,
          deviceType: 'desktop',
          browser,
          browserVersion: '1.0',
          os,
          osVersion: '1.0',
          screenResolution,
          colorDepth: 24,
          timezone: 'UTC',
          language: 'en',
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: 'SimulatorBot/1.0',
          riskScore,
          flags,
          lastSeen: new Date(),
        },
        $setOnInsert: {
          firstSeen: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // If shared fingerprint, link the users
    if (existingFingerprint) {
      await DeviceFingerprint.updateMany(
        { fingerprintId },
        { 
          $addToSet: { linkedUserIds: userId },
          $max: { riskScore },
        }
      );
    }

    return NextResponse.json({
      success: true,
      fraudDetected: riskScore > 50,
      riskScore,
      flags,
    });
  } catch (error) {
    console.error('Simulator fraud tracking error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

