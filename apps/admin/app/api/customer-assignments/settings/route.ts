import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { customerAssignmentService } from '@/lib/services/customer-assignment.service';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/customer-assignments/settings
 * Get assignment settings
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const settings = await customerAssignmentService.getSettings();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error fetching assignment settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/customer-assignments/settings
 * Update assignment settings (Super Admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admin can update settings
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admin can update assignment settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate assignable roles if provided
    if (body.assignableRoles && !Array.isArray(body.assignableRoles)) {
      return NextResponse.json(
        { error: 'assignableRoles must be an array' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    
    const settings = await customerAssignmentService.updateSettings(
      body,
      {
        adminId: auth.adminId!,
        adminEmail: auth.email!,
        adminName: auth.name || 'Admin',
      }
    );

    console.log(`✅ [Settings] Assignment settings updated by ${auth.email}`);

    return NextResponse.json({
      success: true,
      message: 'Assignment settings updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Error updating assignment settings:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment settings' },
      { status: 500 }
    );
  }
}

