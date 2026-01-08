import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { UserPresence } from '@/database/models/messaging/user-presence.model';
import { connectToDatabase } from '@/database/mongoose';

/**
 * POST /api/messaging/presence
 * Update user presence status
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (status && !['online', 'away', 'busy', 'offline'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    await MessagingService.setPresence(
      session.user.id,
      'user',
      status || 'online'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messaging/presence
 * Get online status for specific users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('userIds')?.split(',') || [];

    if (userIds.length === 0) {
      return NextResponse.json({ presences: [] });
    }

    await connectToDB();

    const presences = await UserPresence.find({
      participantId: { $in: userIds },
    }).select('participantId status lastSeen customStatus');

    return NextResponse.json({
      presences: presences.map(p => ({
        participantId: p.participantId,
        status: p.status,
        lastSeen: p.lastSeen,
        customStatus: p.customStatus,
      })),
    });
  } catch (error) {
    console.error('Error getting presence:', error);
    return NextResponse.json(
      { error: 'Failed to get presence' },
      { status: 500 }
    );
  }
}

