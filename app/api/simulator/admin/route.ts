import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * POST /api/simulator/admin
 * Simulator endpoint for admin actions (ban/suspend/unban users)
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
    const { action, userId, reason } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { success: false, error: 'action and userId are required' },
        { status: 400 }
      );
    }

    const mongooseConn = await connectToDatabase();
    
    // Wait for connection to be fully ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise<void>((resolve) => {
        mongoose.connection.once('connected', resolve);
        setTimeout(resolve, 5000); // Timeout after 5s
      });
    }
    
    const db = mongoose.connection.db || mongooseConn?.connection?.db;

    if (!db) {
      console.error('Simulator admin: Database connection not available');
      return NextResponse.json(
        { success: false, error: 'Database connection not available' },
        { status: 503 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'ban':
        updateData = {
          banned: true,
          bannedAt: new Date(),
          banReason: reason || 'Simulator test ban',
        };
        break;
      case 'unban':
        updateData = {
          banned: false,
          bannedAt: null,
          banReason: null,
        };
        break;
      case 'suspend':
        updateData = {
          suspended: true,
          suspendedAt: new Date(),
          suspendReason: reason || 'Simulator test suspension',
        };
        break;
      case 'unsuspend':
        updateData = {
          suspended: false,
          suspendedAt: null,
          suspendReason: null,
        };
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Try to update by 'id' field first (better-auth custom id)
    let result = await db.collection('user').updateOne(
      { id: userId },
      { $set: updateData }
    );

    // If not found, try by _id
    if (result.matchedCount === 0) {
      if (ObjectId.isValid(userId)) {
        result = await db.collection('user').updateOne(
          { _id: new ObjectId(userId) },
          { $set: updateData }
        );
      }
    }

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      userId,
    });
  } catch (error) {
    console.error('Simulator admin action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

