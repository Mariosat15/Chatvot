import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';
import { ObjectId } from 'mongodb';

// Valid user roles (includes legacy roles for backwards compatibility)
// Active roles: trader, affiliate (coming soon), gamemaster (coming soon)
// Legacy roles: admin, backoffice (kept for existing users but no longer assignable via UI)
const VALID_ROLES = ['trader', 'affiliate', 'gamemaster', 'admin', 'backoffice'] as const;
type UserRole = typeof VALID_ROLES[number];

/**
 * Build a query that matches user by various ID formats
 * Better-auth uses 'id' field, but MongoDB also has '_id'
 */
function buildUserQuery(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: any[] = [{ id: userId }];
  
  // Try as ObjectId if valid
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  
  // Also try as string _id
  queries.push({ _id: userId });
  
  return { $or: queries };
}

/**
 * PATCH /api/admin/users/edit
 * Edit user information including role and address details
 */
export async function PATCH(request: Request) {
  try {
    const { 
      userId, 
      name, 
      email, 
      role,
      country,
      city,
      address,
      postalCode,
      phone,
    } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if at least one field is being updated
    const hasBasicFields = name || email || role;
    const hasAddressFields = country !== undefined || city !== undefined || 
                            address !== undefined || postalCode !== undefined || 
                            phone !== undefined;

    if (!hasBasicFields && !hasAddressFields) {
      return NextResponse.json(
        { success: false, message: 'At least one field is required to update' },
        { status: 400 }
      );
    }

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get mongoose connection for Better Auth collections
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Build update object - only include fields that were explicitly provided
    const updateData: Record<string, any> = {};
    
    // Basic fields
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    
    // Address fields - allow empty strings to clear values
    if (country !== undefined) updateData.country = country;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (phone !== undefined) updateData.phone = phone;
    
    updateData.updatedAt = new Date();

    // Update user in Better Auth collection (try multiple ID formats)
    const query = buildUserQuery(userId);
    console.log(`🔍 Searching for user with query:`, JSON.stringify(query));
    
    const result = await db.collection('user').updateOne(
      query,
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      console.error(`❌ User not found with ID: ${userId}`);
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Updated user ${userId}:`, updateData);

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logUserUpdated(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: 'admin',
          },
          userId,
          name || email || userId,
          updateData
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      updated: updateData,
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
