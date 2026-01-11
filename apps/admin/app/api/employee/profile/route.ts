import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import bcrypt from 'bcryptjs';
import { employeeNotificationService } from '@/lib/services/employee-notification.service';

/**
 * GET /api/employee/profile
 * Get the current employee's profile
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const employee = await Admin.findById(auth.adminId).select(
      '-password -forceLogoutAt -tempPasswordExpiresAt'
    ).lean();

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: employee._id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        avatar: employee.avatar || null,
        phone: employee.phone || null,
        timezone: employee.timezone || 'UTC',
        language: employee.language || 'en',
        bio: employee.bio || null,
        department: employee.department || null,
        title: employee.title || null,
        isOnline: employee.isOnline,
        lastLogin: employee.lastLogin,
        lastActivity: employee.lastActivity,
        createdAt: employee.createdAt,
        isSuperAdmin: auth.isSuperAdmin,
        mustChangePassword: employee.mustChangePassword || false,
      },
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employee/profile
 * Update the current employee's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, timezone, language, bio, department, title, avatar } = body;

    await connectToDatabase();

    // Build update object with only provided fields
    const updateFields: Record<string, any> = {};
    const changedFields: string[] = [];

    if (name !== undefined && name.trim()) {
      updateFields.name = name.trim();
      changedFields.push('name');
    }
    if (phone !== undefined) {
      updateFields.phone = phone || null;
      changedFields.push('phone');
    }
    if (timezone !== undefined) {
      updateFields.timezone = timezone;
      changedFields.push('timezone');
    }
    if (language !== undefined) {
      updateFields.language = language;
      changedFields.push('language');
    }
    if (bio !== undefined) {
      updateFields.bio = bio || null;
      changedFields.push('bio');
    }
    if (department !== undefined) {
      updateFields.department = department || null;
      changedFields.push('department');
    }
    if (title !== undefined) {
      updateFields.title = title || null;
      changedFields.push('title');
    }
    if (avatar !== undefined) {
      updateFields.avatar = avatar || null;
      changedFields.push('avatar');
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updateFields.updatedAt = new Date();

    const updatedEmployee = await Admin.findByIdAndUpdate(
      auth.adminId,
      { $set: updateFields },
      { new: true, select: '-password -forceLogoutAt -tempPasswordExpiresAt' }
    ).lean();

    if (!updatedEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Send notification about profile update
    if (changedFields.length > 0) {
      await employeeNotificationService.notifyProfileUpdated(
        auth.adminId!,
        changedFields,
        'self'
      );
    }

    console.log(`✅ Employee profile updated: ${auth.email} - Fields: ${changedFields.join(', ')}`);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedEmployee._id,
        email: updatedEmployee.email,
        name: updatedEmployee.name,
        role: updatedEmployee.role,
        avatar: updatedEmployee.avatar || null,
        phone: updatedEmployee.phone || null,
        timezone: updatedEmployee.timezone || 'UTC',
        language: updatedEmployee.language || 'en',
        bio: updatedEmployee.bio || null,
        department: updatedEmployee.department || null,
        title: updatedEmployee.title || null,
      },
    });
  } catch (error) {
    console.error('Error updating employee profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

