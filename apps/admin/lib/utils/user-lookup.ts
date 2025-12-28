import { connectToDatabase } from '@/database/mongoose';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  bio?: string;
  role?: string; // 'trader', 'admin', 'backoffice'
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

/**
 * Get user information from better-auth user collection by userId
 * Users are stored in a native MongoDB 'user' collection by better-auth
 */
export async function getUserById(userId: string): Promise<UserInfo | null> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('Database connection not found');
      return null;
    }

    // Try finding by 'id' field first (better-auth uses this)
    let user = await db.collection('user').findOne({ id: userId });
    
    // If not found, try by _id as ObjectId
    if (!user) {
      try {
        const { ObjectId } = await import('mongodb');
        user = await db.collection('user').findOne({ _id: new ObjectId(userId) });
      } catch {
        // Not a valid ObjectId, skip
      }
    }

    // If still not found, try as string _id
    if (!user) {
      user = await db.collection('user').findOne({ _id: userId as any });
    }

    if (!user) {
      return null;
    }

    return {
      id: user.id || user._id?.toString() || userId,
      email: user.email || 'unknown',
      name: user.name || user.email || 'Unknown User',
      profileImage: user.profileImage || user.image,  // Check both profileImage and image (better-auth)
      bio: user.bio,
      role: user.role || 'trader',
      country: user.country,
      address: user.address,
      city: user.city,
      postalCode: user.postalCode,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Get ALL traders from the database (only users with role='trader' or no role set)
 * Identifies traders by EMAIL and ROLE field (not by name)
 * Returns an array of all trader users, deduplicated by email
 */
export async function getAllUsers(): Promise<UserInfo[]> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('Database connection not found');
      return [];
    }

    // Get admin email to exclude it
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';

    // Get ONLY traders - filter by ROLE field (the proper way to identify user types)
    // Include: role='trader', no role field (legacy), null role
    // Exclude: role='admin', role='backoffice'
    const users = await db.collection('user').find({
      $and: [
        // Must have email
        { email: { $exists: true, $ne: null } },
        { email: { $nin: [''] } },
        // Role filter - only traders
        {
          $or: [
            { role: 'trader' },  // Explicitly set as trader
            { role: { $exists: false } },  // No role field = legacy user, treat as trader
            { role: null },  // Null role = treat as trader
          ]
        },
        // Exclude admin email (extra safety check)
        ...(adminEmail ? [{ email: { $ne: adminEmail } }] : [])
      ]
    }).toArray();
    
    // Deduplicate by EMAIL (not by name) - email is the unique identifier
    const uniqueUsersMap = new Map<string, UserInfo>();
    
    for (const user of users) {
      const id = user.id || user._id?.toString() || '';
      const email = user.email?.toLowerCase() || '';
      
      if (!id || !email) continue;
      
      // Skip if we already have this user by email (dedupe by email)
      if (uniqueUsersMap.has(email)) continue;
      
      // Double-check role: skip if explicitly set to non-trader
      const role = user.role || 'trader'; // Default to trader if no role
      if (role !== 'trader') continue;
      
      // Skip admin email (extra safety)
      if (adminEmail && email === adminEmail) continue;
      
      uniqueUsersMap.set(email, {
        id,
        email,
        name: user.name || email.split('@')[0] || 'Unknown User', // Name is for display only
        profileImage: user.profileImage || user.image,  // Check both profileImage and image (better-auth)
        bio: user.bio,
        role: 'trader',
        country: user.country,
        address: user.address,
        city: user.city,
        postalCode: user.postalCode,
      });
    }
    
    return Array.from(uniqueUsersMap.values());
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

/**
 * Get multiple users by their IDs
 * Returns a Map keyed by the original userIds passed in
 */
export async function getUsersByIds(userIds: string[]): Promise<Map<string, UserInfo>> {
  const userMap = new Map<string, UserInfo>();
  
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('Database connection not found');
      return userMap;
    }

    const { ObjectId } = await import('mongodb');

    // Process each userId individually to ensure correct key mapping
    for (const originalId of userIds) {
      if (userMap.has(originalId)) continue; // Already found
      
      let user = null;
      
      // Try finding by 'id' field first (better-auth uses this)
      user = await db.collection('user').findOne({ id: originalId });
      
      // If not found, try by _id as ObjectId
      if (!user && ObjectId.isValid(originalId)) {
        try {
          user = await db.collection('user').findOne({ _id: new ObjectId(originalId) });
        } catch {
          // Not a valid ObjectId, skip
        }
      }

      // If still not found, try as string _id
      if (!user) {
        user = await db.collection('user').findOne({ _id: originalId as any });
      }

      if (user) {
        // Key by the ORIGINAL id that was passed in, so lookups work
        userMap.set(originalId, {
          id: user.id || user._id?.toString() || originalId,
          email: user.email || 'unknown',
          name: user.name || user.email || 'Unknown User',
          profileImage: user.profileImage || user.image,  // Check both profileImage and image (better-auth)
          bio: user.bio,
          role: user.role || 'trader',
          country: user.country,
          address: user.address,
          city: user.city,
          postalCode: user.postalCode,
        });
      }
    }

    return userMap;
  } catch (error) {
    console.error('Error fetching users:', error);
    return userMap;
  }
}

