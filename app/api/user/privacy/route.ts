import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';

/**
 * Helper to build query filter for user
 */
function buildUserQuery(userId: string) {
  const queries: any[] = [{ id: userId }];
  
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });
  
  return { $or: queries };
}

/**
 * GET /api/user/privacy
 * Get user's privacy settings
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const user = await db.collection('user').findOne(buildUserQuery(session.user.id));

    return NextResponse.json({
      privacy: {
        allowFriendRequests: user?.settings?.privacy?.allowFriendRequests ?? true,
      },
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch privacy settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/privacy
 * Update user's privacy settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { allowFriendRequests } = body;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };
    
    if (typeof allowFriendRequests === 'boolean') {
      updateData['settings.privacy.allowFriendRequests'] = allowFriendRequests;
    }

    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return NextResponse.json(
        { error: 'No valid settings provided' },
        { status: 400 }
      );
    }

    const result = await db.collection('user').findOneAndUpdate(
      buildUserQuery(session.user.id),
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      privacy: {
        allowFriendRequests: result.settings?.privacy?.allowFriendRequests ?? true,
      },
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return NextResponse.json(
      { error: 'Failed to update privacy settings' },
      { status: 500 }
    );
  }
}
