import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

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
 * POST /api/user/profile/upload-image
 * Upload a profile image
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    // Try multiple possible locations for production compatibility
    const possibleDirs = [
      path.join(process.cwd(), 'public', 'uploads', 'profiles'),
      path.join('/var/www/chartvolt', 'public', 'uploads', 'profiles'),
    ];
    
    // Use the first directory that we can create successfully
    let uploadsDir = possibleDirs[0];
    for (const dir of possibleDirs) {
      try {
        await mkdir(dir, { recursive: true });
        uploadsDir = dir;
        break;
      } catch (err) {
        console.warn(`Could not create directory ${dir}:`, err);
      }
    }
    
    // Ensure the directory exists
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Generate public URL using API route (works in production without rebuild)
    const profileImageUrl = `/api/uploads/profiles/${fileName}?t=${Date.now()}`;

    // Update user in database
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    await db.collection('user').findOneAndUpdate(
      buildUserQuery(session.user.id),
      { 
        $set: { 
          profileImage: profileImageUrl,
          updatedAt: new Date() 
        } 
      }
    );

    console.log(`✅ Profile image uploaded for user: ${session.user.email}`, profileImageUrl);

    return NextResponse.json({ 
      success: true,
      profileImage: profileImageUrl 
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

