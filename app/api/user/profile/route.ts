import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  bio?: string;
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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
 * Helper to build query filter for user
 */
function buildUserQuery(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: any[] = [{ id: userId }];
  
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });
  
  return { $or: queries };
}

/**
 * GET /api/user/profile
 * Get current user's profile data
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user from database (try multiple ID formats)
    const user = await findUserById(db, session.user.id);
    
    if (!user) {
      console.error(`User not found for ID: ${session.user.id}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log all user fields to debug missing data
    console.log(`📋 Profile API - User found:`, {
      id: user.id || user._id?.toString(),
      email: user.email,
      name: user.name,
      country: user.country,
      address: user.address,
      city: user.city,
      postalCode: user.postalCode,
      allKeys: Object.keys(user),
    });

    // Check both 'profileImage' (custom) and 'image' (better-auth default) fields
    const userImage = user.profileImage || user.image || '';
    
    const profile: UserProfile = {
      id: user.id || user._id?.toString(),
      name: user.name || '',
      email: user.email || '',
      profileImage: userImage,
      bio: user.bio || '',
      country: user.country || '',
      address: user.address || '',
      city: user.city || '',
      postalCode: user.postalCode || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile
 * Update current user's profile data
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, profileImage, bio, country, address, city, postalCode } = body;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Build update object (only update provided fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateFields.name = name.trim();
    if (profileImage !== undefined) updateFields.profileImage = profileImage;
    if (bio !== undefined) updateFields.bio = bio.trim();
    if (country !== undefined) updateFields.country = country;
    if (address !== undefined) updateFields.address = address.trim();
    if (city !== undefined) updateFields.city = city.trim();
    if (postalCode !== undefined) updateFields.postalCode = postalCode.trim();

    console.log(`📝 Profile Update - Fields to update:`, updateFields);

    // Update user in database (try multiple ID formats)
    const result = await db.collection('user').findOneAndUpdate(
      buildUserQuery(session.user.id),
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      console.error(`User not found for update, ID: ${session.user.id}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`✅ User profile updated: ${session.user.email}`, {
      country: result.country,
      address: result.address,
      city: result.city,
      postalCode: result.postalCode,
    });

    // Check both 'profileImage' (custom) and 'image' (better-auth default) fields
    const updatedUserImage = result.profileImage || result.image || '';
    
    const updatedProfile: UserProfile = {
      id: result.id || result._id?.toString(),
      name: result.name || '',
      email: result.email || '',
      profileImage: updatedUserImage,
      bio: result.bio || '',
      country: result.country || '',
      address: result.address || '',
      city: result.city || '',
      postalCode: result.postalCode || '',
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };

    return NextResponse.json({ user: updatedProfile });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

