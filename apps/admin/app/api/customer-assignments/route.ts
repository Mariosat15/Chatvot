import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { customerAssignmentService } from '@/lib/services/customer-assignment.service';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import mongoose from 'mongoose';

/**
 * GET /api/customer-assignments
 * Get all assignments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    const employeeId = searchParams.get('employeeId');
    const includeStats = searchParams.get('includeStats') === 'true';

    await connectToDatabase();

    let result;
    
    if (employeeId) {
      // Get assignments for specific employee
      const assignments = await customerAssignmentService.getEmployeeAssignments(employeeId);
      result = { assignments, total: assignments.length };
    } else {
      // Get all assignments
      result = await customerAssignmentService.getAllAssignments({ limit, skip });
    }

    // Get stats if requested
    let stats = null;
    if (includeStats) {
      const db = mongoose.connection.db;
      if (db) {
        const totalCustomers = await db.collection('user').countDocuments();
        const assignmentStats = await customerAssignmentService.getAssignmentStats();
        const unassignedCount = await customerAssignmentService.getUnassignedCount(totalCustomers);
        
        stats = {
          ...assignmentStats,
          totalCustomers,
          unassignedCount,
        };
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      stats,
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customer-assignments
 * Create a new assignment (manual assignment by admin or self-assignment)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, employeeId, reason } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get customer info from the user collection
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const customer = await db.collection('user').findOne({ 
      _id: new mongoose.Types.ObjectId(customerId) 
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get settings to check permissions
    const settings = await customerAssignmentService.getSettings();
    
    // Determine assignment type and target employee
    let targetEmployeeId = employeeId;
    let assignmentType: 'admin' | 'self' | 'auto' = 'admin';

    if (!targetEmployeeId) {
      // Self-assignment
      if (!settings.allowSelfAssignment && !auth.isSuperAdmin) {
        return NextResponse.json(
          { error: 'Self-assignment is not allowed' },
          { status: 403 }
        );
      }
      targetEmployeeId = auth.adminId;
      assignmentType = 'self';
    } else if (targetEmployeeId !== auth.adminId && !auth.isSuperAdmin) {
      // Assigning to someone else - requires super admin
      return NextResponse.json(
        { error: 'Only super admin can assign customers to other employees' },
        { status: 403 }
      );
    }

    // Get target employee info
    const employee = await Admin.findById(targetEmployeeId);
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check if employee role is in assignable roles
    if (!auth.isSuperAdmin && settings.assignableRoles.length > 0) {
      if (!settings.assignableRoles.includes(employee.role || 'Backoffice')) {
        return NextResponse.json(
          { error: `Role "${employee.role}" is not allowed to be assigned customers` },
          { status: 403 }
        );
      }
    }

    // Create assignment
    const assignment = await customerAssignmentService.assignCustomer({
      customerId: customer._id.toString(),
      customerEmail: customer.email,
      customerName: customer.name,
      employeeId: employee._id.toString(),
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeRole: employee.role || 'Backoffice',
      assignedBy: {
        employeeId: auth.adminId!,
        employeeName: auth.name || 'Admin',
        employeeEmail: auth.email!,
        employeeRole: auth.role || 'Super Admin',
        isSuperAdmin: auth.isSuperAdmin,
      },
      assignmentType,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Customer assigned to ${employee.name}`,
      assignment,
    });
  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
