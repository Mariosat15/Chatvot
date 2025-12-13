import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import UserPresence from '@/database/models/user-presence.model';

// GET - Get current user's presence or list of online users
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const listOnline = searchParams.get('online') === 'true';

    if (listOnline) {
      // Return list of online users who accept challenges
      const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes

      const onlineUsers = await UserPresence.find({
        status: 'online',
        lastHeartbeat: { $gte: threshold },
        userId: { $ne: session.user.id }, // Exclude self
      })
        .select('userId username status acceptingChallenges lastSeen isInChallenge isInCompetition')
        .lean();

      return NextResponse.json({ users: onlineUsers });
    }

    // Return current user's presence
    const presence = await UserPresence.findOne({ userId: session.user.id }).lean();
    return NextResponse.json({ presence });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presence' },
      { status: 500 }
    );
  }
}

// POST - Update presence (heartbeat)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Check for action=offline query parameter (handles going offline without body)
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'offline') {
      // Go offline - no body needed
      await UserPresence.findOneAndUpdate(
        { userId: session.user.id },
        { $set: { status: 'offline', lastSeen: new Date() } }
      );
      return NextResponse.json({ success: true, status: 'offline' });
    }

    // Parse body safely - default to empty object if no body
    let body: { currentPage?: string; acceptingChallenges?: boolean } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body or invalid JSON - that's okay, use defaults
    }
    
    const { currentPage, acceptingChallenges } = body;

    const now = new Date();
    const updateData: any = {
      lastHeartbeat: now,
      lastSeen: now,
      status: 'online',
    };

    if (currentPage !== undefined) {
      updateData.currentPage = currentPage;
    }

    if (acceptingChallenges !== undefined) {
      updateData.acceptingChallenges = acceptingChallenges;
    }

    const presence = await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: updateData,
        $setOnInsert: {
          userId: session.user.id,
          username: session.user.name || 'Unknown',
        },
      },
      { upsert: true, new: true }
    );

    // Mark stale users as offline (run periodically)
    await UserPresence.updateMany(
      {
        status: { $ne: 'offline' },
        lastHeartbeat: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      { $set: { status: 'offline' } }
    );

    return NextResponse.json({
      success: true,
      presence: {
        status: presence.status,
        acceptingChallenges: presence.acceptingChallenges,
      },
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}

// PUT - Toggle accepting challenges
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { acceptingChallenges } = body;

    const presence = await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: { acceptingChallenges },
      },
      { new: true }
    );

    if (!presence) {
      return NextResponse.json({ error: 'Presence not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      acceptingChallenges: presence.acceptingChallenges,
    });
  } catch (error) {
    console.error('Error toggling accepting challenges:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// DELETE - Go offline
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    await UserPresence.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { status: 'offline', lastSeen: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error going offline:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

