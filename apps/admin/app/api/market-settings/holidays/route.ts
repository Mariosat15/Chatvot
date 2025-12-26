import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import MarketSettings from '@/database/models/market-settings.model';
import AuditLog from '@/database/models/audit-log.model';

// GET - Fetch all holidays
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    let settings = await MarketSettings.findOne();
    if (!settings) {
      settings = await MarketSettings.create({});
    }

    return NextResponse.json({ holidays: settings.holidays || [] });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    );
  }
}

// POST - Add a new holiday
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    
    if (!body.name || !body.date) {
      return NextResponse.json(
        { error: 'Name and date are required' },
        { status: 400 }
      );
    }

    let settings = await MarketSettings.findOne();
    if (!settings) {
      settings = await MarketSettings.create({});
    }

    // Add holiday
    const newHoliday = {
      name: body.name,
      date: body.date, // YYYY-MM-DD format
      affectedAssets: body.affectedAssets || ['forex'],
      isRecurring: body.isRecurring || false,
      createdAt: new Date(),
    };

    settings.holidays.push(newHoliday);
    await settings.save();

    // Log action
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'holiday_added',
      actionCategory: 'settings',
      description: `Added market holiday: ${body.name} on ${body.date}`,
      targetType: 'settings',
      targetId: 'market_holiday',
      metadata: { holiday: newHoliday },
      status: 'success',
    });

    return NextResponse.json({ 
      success: true, 
      holiday: settings.holidays[settings.holidays.length - 1] 
    });
  } catch (error) {
    console.error('Error adding holiday:', error);
    return NextResponse.json(
      { error: 'Failed to add holiday' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a holiday
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const holidayId = searchParams.get('id');

    if (!holidayId) {
      return NextResponse.json(
        { error: 'Holiday ID is required' },
        { status: 400 }
      );
    }

    let settings = await MarketSettings.findOne();
    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not found' },
        { status: 404 }
      );
    }

    // Find and remove holiday
    const holidayIndex = settings.holidays.findIndex(
      (h: any) => h._id.toString() === holidayId
    );

    if (holidayIndex === -1) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      );
    }

    const removedHoliday = settings.holidays[holidayIndex];
    settings.holidays.splice(holidayIndex, 1);
    await settings.save();

    // Log action
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || 'Admin',
      userEmail: session.email || 'admin@system',
      userRole: 'admin',
      action: 'holiday_removed',
      actionCategory: 'settings',
      description: `Removed market holiday: ${removedHoliday.name}`,
      targetType: 'settings',
      targetId: 'market_holiday',
      metadata: { holiday: removedHoliday },
      status: 'success',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing holiday:', error);
    return NextResponse.json(
      { error: 'Failed to remove holiday' },
      { status: 500 }
    );
  }
}

