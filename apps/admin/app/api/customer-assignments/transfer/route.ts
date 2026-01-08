import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { customerAssignmentService } from '@/lib/services/customer-assignment.service';
import { dbConnect } from '@/database/connection';

/**
 * POST /api/customer-assignments/transfer
 * Transfer a customer from one employee to another
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, toEmployeeId, reason } = body;

    if (!customerId || !toEmployeeId) {
      return NextResponse.json(
        { error: 'customerId and toEmployeeId are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Get current assignment to check permissions
    const currentAssignment = await customerAssignmentService.getAssignment(customerId);
    
    if (!currentAssignment) {
      return NextResponse.json(
        { error: 'Customer does not have an active assignment' },
        { status: 400 }
      );
    }

    // Check permissions:
    // - Super admin can transfer anyone
    // - Current assigned employee can transfer to someone else (if allowed by settings)
    const settings = await customerAssignmentService.getSettings();
    const isCurrentOwner = currentAssignment.employeeId === auth.adminId;
    
    if (!auth.isSuperAdmin && !isCurrentOwner) {
      return NextResponse.json(
        { error: 'You can only transfer your own assigned customers' },
        { status: 403 }
      );
    }

    // Perform transfer
    const assignment = await customerAssignmentService.transferCustomer({
      customerId,
      toEmployeeId,
      performedBy: {
        employeeId: auth.adminId!,
        employeeName: auth.name || 'Admin',
        employeeEmail: auth.email!,
        employeeRole: auth.role || 'Super Admin',
        isSuperAdmin: auth.isSuperAdmin,
      },
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Customer transferred to ${assignment.employeeName}`,
      assignment,
    });
  } catch (error: any) {
    console.error('Error transferring customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transfer customer' },
      { status: 500 }
    );
  }
}

