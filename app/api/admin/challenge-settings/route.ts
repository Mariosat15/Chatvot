import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import ChallengeSettings from '@/database/models/trading/challenge-settings.model';
import { requireAdminAuth, getAdminSession } from '@/lib/admin/auth';

// GET - Get challenge settings
export async function GET(_request: NextRequest) {
  try {
    await requireAdminAuth();

    await connectToDatabase();

    const settings = await ChallengeSettings.getSingleton();

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching challenge settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge settings' },
      { status: 500 }
    );
  }
}

// PUT - Update challenge settings
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Get existing settings
    const settings = await ChallengeSettings.getSingleton();

    // Update fields - Trading settings & ranking rules come from universal settings
    const allowedFields = [
      'platformFeePercentage',
      'minEntryFee',
      'maxEntryFee',
      'defaultStartingCapital',
      'minStartingCapital',
      'maxStartingCapital',
      'minDurationMinutes',
      'maxDurationMinutes',
      'defaultDurationMinutes',
      'acceptDeadlineMinutes',
      'defaultAssetClasses',
      'challengesEnabled',
      'requireBothOnline',
      'allowChallengeWhileInCompetition',
      'challengeCooldownMinutes',
      'maxPendingChallenges',
      'maxActiveChallenges',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (settings as any)[field] = body[field];
      }
    }

    // Handle NaN values that could come from empty input fields
    if (isNaN(settings.platformFeePercentage)) settings.platformFeePercentage = 10;
    if (isNaN(settings.minEntryFee)) settings.minEntryFee = 5;
    if (isNaN(settings.maxEntryFee)) settings.maxEntryFee = 1000;
    if (isNaN(settings.defaultStartingCapital)) settings.defaultStartingCapital = 10000;
    if (isNaN(settings.minStartingCapital)) settings.minStartingCapital = 1000;
    if (isNaN(settings.maxStartingCapital)) settings.maxStartingCapital = 100000;
    if (isNaN(settings.minDurationMinutes)) settings.minDurationMinutes = 15;
    if (isNaN(settings.maxDurationMinutes)) settings.maxDurationMinutes = 1440;
    if (isNaN(settings.defaultDurationMinutes)) settings.defaultDurationMinutes = 60;
    if (isNaN(settings.acceptDeadlineMinutes)) settings.acceptDeadlineMinutes = 30;
    if (isNaN(settings.challengeCooldownMinutes)) settings.challengeCooldownMinutes = 5;
    if (isNaN(settings.maxPendingChallenges)) settings.maxPendingChallenges = 5;
    if (isNaN(settings.maxActiveChallenges)) settings.maxActiveChallenges = 3;

    await settings.save();

    // Log audit
    try {
      const { auditLogService } = await import('@/lib/services/audit-log.service');
      const adminSession = await getAdminSession();
      if (adminSession) {
        await auditLogService.logSettingsUpdated(
          { id: adminSession.id, email: adminSession.email, name: adminSession.name },
          'challenge_settings',
          null,
          body
        );
      }
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Challenge settings updated',
      settings,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Error updating challenge settings:', error);
    
    // Handle Mongoose validation errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyError = error as any;
    if (anyError.name === 'ValidationError' && anyError.errors) {
      const validationMessages = Object.keys(anyError.errors).map((field) => {
        const err = anyError.errors[field];
        return `${field}: ${err.message}`;
      });
      return NextResponse.json(
        { error: `Validation failed: ${validationMessages.join(', ')}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update challenge settings' },
      { status: 500 }
    );
  }
}

