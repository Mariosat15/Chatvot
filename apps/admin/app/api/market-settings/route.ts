import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import MarketSettings from '@/database/models/market-settings.model';
import AuditLog from '@/database/models/audit-log.model';

// GET - Fetch market settings
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    let settings = await MarketSettings.findOne();
    if (!settings) {
      // Create default settings
      settings = await MarketSettings.create({});
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching market settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market settings' },
      { status: 500 }
    );
  }
}

// PUT - Update ALL market settings at once (mode, schedules, holidays, blocking rules)
export async function PUT(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    
    let settings = await MarketSettings.findOne();
    if (!settings) {
      settings = new MarketSettings();
    }

    // Track changes for audit log
    const changes: string[] = [];
    const oldMode = settings.mode;

    // Update mode
    if (body.mode !== undefined && body.mode !== settings.mode) {
      settings.mode = body.mode;
      changes.push(`mode: ${oldMode} → ${body.mode}`);
    }
    
    // Update automatic settings
    if (body.automaticSettings !== undefined) {
      settings.automaticSettings = { ...settings.automaticSettings, ...body.automaticSettings };
    }
    
    // Update asset schedules (full replacement for each provided schedule)
    if (body.assetSchedules !== undefined) {
      for (const [asset, schedule] of Object.entries(body.assetSchedules)) {
        if (schedule && typeof schedule === 'object') {
          (settings.assetSchedules as Record<string, unknown>)[asset] = schedule;
        }
      }
      settings.markModified('assetSchedules');
    }
    
    // Update holidays (full replacement - clean up temp IDs)
    if (body.holidays !== undefined) {
      const oldCount = settings.holidays?.length || 0;
      // Clean temporary IDs and prepare holidays for save
      settings.holidays = body.holidays.map((h: { _id?: string; name: string; date: string; affectedAssets: string[]; isRecurring: boolean }) => ({
        name: h.name,
        date: h.date,
        affectedAssets: h.affectedAssets,
        isRecurring: h.isRecurring,
        // Keep existing _id if it's a real MongoDB ID, otherwise MongoDB will generate one
        ...(h._id && !h._id.startsWith('temp_') ? { _id: h._id } : {}),
      }));
      settings.markModified('holidays');
      const newCount = settings.holidays.length;
      if (newCount !== oldCount) {
        changes.push(`holidays: ${oldCount} → ${newCount}`);
      }
    }
    
    // Update blocking rules
    if (body.blockTradingOnHolidays !== undefined) {
      if (body.blockTradingOnHolidays !== settings.blockTradingOnHolidays) {
        changes.push(`blockTrading: ${settings.blockTradingOnHolidays} → ${body.blockTradingOnHolidays}`);
      }
      settings.blockTradingOnHolidays = body.blockTradingOnHolidays;
    }
    if (body.blockCompetitionsOnHolidays !== undefined) {
      if (body.blockCompetitionsOnHolidays !== settings.blockCompetitionsOnHolidays) {
        changes.push(`blockCompetitions: ${settings.blockCompetitionsOnHolidays} → ${body.blockCompetitionsOnHolidays}`);
      }
      settings.blockCompetitionsOnHolidays = body.blockCompetitionsOnHolidays;
    }
    if (body.blockChallengesOnHolidays !== undefined) {
      if (body.blockChallengesOnHolidays !== settings.blockChallengesOnHolidays) {
        changes.push(`blockChallenges: ${settings.blockChallengesOnHolidays} → ${body.blockChallengesOnHolidays}`);
      }
      settings.blockChallengesOnHolidays = body.blockChallengesOnHolidays;
    }
    if (body.showHolidayWarning !== undefined) {
      settings.showHolidayWarning = body.showHolidayWarning;
    }

    await settings.save();

    // Reload to get proper IDs for new holidays
    settings = await MarketSettings.findOne();

    // Log action with detailed changes
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'market_settings_updated',
      actionCategory: 'settings',
      description: changes.length > 0 
        ? `Updated market settings: ${changes.join(', ')}`
        : `Updated market settings (mode: ${settings?.mode})`,
      targetType: 'settings',
      targetId: 'market',
      status: 'success',
      metadata: {
        mode: settings?.mode,
        holidayCount: settings?.holidays?.length || 0,
        blockTrading: settings?.blockTradingOnHolidays,
        blockCompetitions: settings?.blockCompetitionsOnHolidays,
        blockChallenges: settings?.blockChallengesOnHolidays,
      },
    });

    console.log('[Market Settings] Saved successfully:', {
      mode: settings?.mode,
      holidays: settings?.holidays?.length || 0,
      blockCompetitions: settings?.blockCompetitionsOnHolidays,
      blockChallenges: settings?.blockChallengesOnHolidays,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating market settings:', error);
    return NextResponse.json(
      { error: 'Failed to update market settings' },
      { status: 500 }
    );
  }
}

