import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { customerAssignmentService } from '@/lib/services/customer-assignment.service';
import { dbConnect } from '@/database/connection';

interface RouteParams {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/customer-assignments/[customerId]
 * Get assignment for a specific customer
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await params;

    await dbConnect();
    const assignment = await customerAssignmentService.getAssignment(customerId);

    if (!assignment) {
      return NextResponse.json({
        success: true,
        assigned: false,
        assignment: null,
      });
    }

    return NextResponse.json({
      success: true,
      assigned: true,
      assignment,
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customer-assignments/[customerId]
 * Unassign a customer (Super Admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admin can unassign
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admin can unassign customers' },
        { status: 403 }
      );
    }

    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || undefined;

    await dbConnect();

    await customerAssignmentService.unassignCustomer(
      customerId,
      {
        employeeId: auth.adminId!,
        employeeName: auth.name || 'Admin',
        employeeEmail: auth.email!,
        employeeRole: auth.role || 'Super Admin',
        isSuperAdmin: auth.isSuperAdmin,
      },
      reason
    );

    return NextResponse.json({
      success: true,
      message: 'Customer unassigned successfully',
    });
  } catch (error: any) {
    console.error('Error unassigning customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unassign customer' },
      { status: 500 }
    );
  }
}

