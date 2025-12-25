import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserRestriction from '@/database/models/user-restriction.model';
import AuditLog from '@/database/models/audit-log.model';
import UserNote from '@/database/models/user-notes.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    await connectToDatabase();

    const restrictions = await UserRestriction.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ restrictions });
  } catch (error) {
    console.error('Error fetching user restrictions:', error);
    return NextResponse.json({ error: 'Failed to fetch restrictions' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    await connectToDatabase();

    // Check if user already has an active restriction
    const existingRestriction = await UserRestriction.findOne({
      userId,
      isActive: true,
    });

    if (existingRestriction) {
      return NextResponse.json(
        { error: 'User already has an active restriction' },
        { status: 400 }
      );
    }

    // Determine blocked actions based on restriction type
    const isBanned = body.restrictionType === 'banned';
    const blockSettings = {
      canTrade: false,
      canEnterCompetitions: false,
      canDeposit: !isBanned, // Suspended users can still deposit
      canWithdraw: false,
    };

    // Create restriction
    const restriction = await UserRestriction.create({
      userId,
      restrictionType: body.restrictionType,
      reason: body.reason,
      customReason: body.customReason,
      ...blockSettings,
      restrictedAt: new Date(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      restrictedBy: session.id,
      isActive: true,
    });

    // Auto-add a note about the restriction
    await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || 'Admin',
      content: `User ${isBanned ? 'banned' : 'suspended'}. Reason: ${body.reason}${
        body.customReason ? `. Details: ${body.customReason}` : ''
      }`,
      category: 'ban',
      priority: 'high',
    });

    // Create audit log
    await AuditLog.create({
      adminId: session.id,
      adminName: session.name || session.email,
      action: isBanned ? 'user_banned' : 'user_suspended',
      targetType: 'user',
      targetId: userId,
      details: {
        restrictionType: body.restrictionType,
        reason: body.reason,
        customReason: body.customReason,
        expiresAt: body.expiresAt,
      },
    });

    return NextResponse.json({ restriction });
  } catch (error) {
    console.error('Error creating user restriction:', error);
    return NextResponse.json({ error: 'Failed to create restriction' }, { status: 500 });
  }
}

