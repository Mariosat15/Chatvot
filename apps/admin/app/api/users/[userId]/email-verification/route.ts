import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/users/[userId]/email-verification
 * Get user's email verification status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAuth();

    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Find user - try multiple ID formats
    let user = await db.collection('user').findOne({ id: userId });
    if (!user && ObjectId.isValid(userId)) {
      user = await db.collection('user').findOne({ _id: new ObjectId(userId) });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      emailVerified: user.emailVerified === true,
      hasPendingVerification: !!user.emailVerificationToken,
      tokenExpiry: user.emailVerificationTokenExpiry,
    });
  } catch (error) {
    console.error('Error getting email verification status:', error);
    return NextResponse.json({ error: 'Failed to get verification status' }, { status: 500 });
  }
}

/**
 * POST /api/users/[userId]/email-verification
 * Admin action: verify or reset user email verification
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAuth();

    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const { action } = await request.json();

    if (!['verify', 'reset'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "verify" or "reset"' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Build query to find user
    const queries: Record<string, unknown>[] = [{ id: userId }];
    if (ObjectId.isValid(userId)) {
      queries.push({ _id: new ObjectId(userId) });
    }

    if (action === 'verify') {
      // Manually verify user's email
      const result = await db.collection('user').updateOne(
        { $or: queries },
        {
          $set: {
            emailVerified: true,
            updatedAt: new Date(),
          },
          $unset: {
            emailVerificationToken: '',
            emailVerificationTokenExpiry: '',
          },
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      console.log(`✅ Admin manually verified email for user ${userId}`);
      return NextResponse.json({ success: true, message: 'Email verified successfully' });
    } else if (action === 'reset') {
      // Reset verification status
      const result = await db.collection('user').updateOne(
        { $or: queries },
        {
          $set: {
            emailVerified: false,
            updatedAt: new Date(),
          },
          $unset: {
            emailVerificationToken: '',
            emailVerificationTokenExpiry: '',
          },
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      console.log(`✅ Admin reset email verification for user ${userId}`);
      return NextResponse.json({ success: true, message: 'Email verification reset successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating email verification:', error);
    return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
  }
}
