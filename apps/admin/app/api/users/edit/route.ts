import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

// Valid user roles
const VALID_ROLES = ['trader', 'admin', 'backoffice'] as const;
type UserRole = typeof VALID_ROLES[number];

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

    // Update user in Better Auth collection
    const result = await db.collection('user').updateOne(
      { id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
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
