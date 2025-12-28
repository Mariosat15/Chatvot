import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';

/**
 * Helper to find user by various ID formats
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findUserById(db: any, userId: string) {
  // Try by 'id' field first (better-auth uses this)
  let user = await db.collection('user').findOne({ id: userId });
  
  // If not found, try by '_id' as ObjectId
  if (!user && ObjectId.isValid(userId)) {
    try {
      user = await db.collection('user').findOne({ _id: new ObjectId(userId) });
    } catch {
      // Not a valid ObjectId
    }
  }
  
  // If still not found, try by '_id' as string
  if (!user) {
    user = await db.collection('user').findOne({ _id: userId });
  }
  
  return user;
}

/**
 * GET /api/user/profile/public?userId=xxx
 * Get public profile data for any user (limited fields)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user from database
    const user = await findUserById(db, userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return only public fields
    // Check both 'profileImage' (custom) and 'image' (better-auth default) fields
    const userImage = user.profileImage || user.image || null;
    
    return NextResponse.json({
      username: user.name || 'Trader',
      profileImage: userImage,
      bio: user.bio || null,
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

