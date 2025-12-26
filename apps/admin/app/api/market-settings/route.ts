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

// PUT - Update market settings
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

    // Update fields
    if (body.mode !== undefined) settings.mode = body.mode;
    if (body.automaticSettings !== undefined) {
      settings.automaticSettings = { ...settings.automaticSettings, ...body.automaticSettings };
    }
    if (body.assetSchedules !== undefined) {
      settings.assetSchedules = { ...settings.assetSchedules, ...body.assetSchedules };
    }
    if (body.blockTradingOnHolidays !== undefined) settings.blockTradingOnHolidays = body.blockTradingOnHolidays;
    if (body.blockCompetitionsOnHolidays !== undefined) settings.blockCompetitionsOnHolidays = body.blockCompetitionsOnHolidays;
    if (body.blockChallengesOnHolidays !== undefined) settings.blockChallengesOnHolidays = body.blockChallengesOnHolidays;
    if (body.showHolidayWarning !== undefined) settings.showHolidayWarning = body.showHolidayWarning;

    await settings.save();

    // Log action
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'market_settings_updated',
      actionCategory: 'settings',
      description: `Updated market settings (mode: ${settings.mode})`,
      targetType: 'settings',
      targetId: 'market',
      status: 'success',
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

