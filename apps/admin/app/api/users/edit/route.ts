import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { getAdminSession } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

// Valid user roles
const VALID_ROLES = ['trader', 'admin', 'backoffice'] as const;
type UserRole = typeof VALID_ROLES[number];

/**
 * PATCH /api/admin/users/edit
 * Edit user information including role
 */
export async function PATCH(request: Request) {
  try {
    const { userId, name, email, role } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!name && !email && !role) {
      return NextResponse.json(
        { success: false, message: 'At least one field (name, email, or role) is required' },
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

    // Build update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
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

