import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { AdminRoleTemplate } from '@/database/models/admin-role-template.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_SECTIONS, type AdminSection } from '@/database/models/admin-employee.model';

// Check if an admin is the original/super admin
async function isOriginalAdmin(admin: any): Promise<boolean> {
  const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
  const isDefaultEmail = admin.email.toLowerCase() === defaultAdminEmail;
  
  const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id');
  const isFirstAdmin = oldestAdmin && oldestAdmin._id.toString() === admin._id.toString();
  
  return isDefaultEmail || isFirstAdmin;
}

// GET - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    const employee = await Admin.findById(id).select('-password').lean();
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      employee: {
        ...employee,
        id: employee._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

// PUT - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin || !(await isOriginalAdmin(currentAdmin))) {
      return NextResponse.json({ error: 'Only super admin can manage employees' }, { status: 403 });
    }

    const employee = await Admin.findById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Prevent modifying the original/super admin
    const isEmployeeOriginal = await isOriginalAdmin(employee);
    if (isEmployeeOriginal && employee._id.toString() !== currentAdmin._id.toString()) {
      return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, roleTemplateId, customSections, isOnline } = body;

    // Update fields
    if (name) employee.name = name;
    if (email && email !== employee.email) {
      // Check if new email is taken
      const existing = await Admin.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
      employee.email = email.toLowerCase();
    }

    // Update role and sections
    if (roleTemplateId) {
      const template = await AdminRoleTemplate.findById(roleTemplateId);
      if (template) {
        employee.roleTemplateId = roleTemplateId;
        employee.role = template.name;
        employee.allowedSections = template.allowedSections;
      }
    } else if (customSections && Array.isArray(customSections)) {
      employee.roleTemplateId = undefined;
      employee.role = 'Custom';
      employee.allowedSections = customSections.filter((s: string) => 
        ADMIN_SECTIONS.includes(s as AdminSection)
      );
    }

    if (typeof isOnline === 'boolean') {
      employee.isOnline = isOnline;
    }

    await employee.save();

    return NextResponse.json({
      success: true,
      employee: {
        id: employee._id.toString(),
        email: employee.email,
        name: employee.name,
        role: employee.role,
        allowedSections: employee.allowedSections,
        isOnline: employee.isOnline,
        lastLogin: employee.lastLogin,
      },
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE - Delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin || !(await isOriginalAdmin(currentAdmin))) {
      return NextResponse.json({ error: 'Only super admin can manage employees' }, { status: 403 });
    }

    const employee = await Admin.findById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Prevent deleting the original/super admin
    if (await isOriginalAdmin(employee)) {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
    }

    // Prevent self-deletion
    if (employee._id.toString() === currentAdmin._id.toString()) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    await Admin.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}

// PATCH - Toggle employee status or reset password
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Get current admin
    const currentAdmin = await Admin.findById(auth.adminId);
    if (!currentAdmin || !(await isOriginalAdmin(currentAdmin))) {
      return NextResponse.json({ error: 'Only super admin can manage employees' }, { status: 403 });
    }

    const employee = await Admin.findById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Prevent modifying the original/super admin
    const isEmployeeOriginal = await isOriginalAdmin(employee);
    if (isEmployeeOriginal && employee._id.toString() !== currentAdmin._id.toString()) {
      return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 403 });
    }

    const body = await request.json();
    const { action, password } = body;

    if (action === 'toggle_status') {
      // Toggle isOnline status (enable/disable)
      // For now, we'll use a simple flag approach
      // In production, you might want a separate 'status' field
      employee.isOnline = !employee.isOnline;
      await employee.save();
      
      return NextResponse.json({
        success: true,
        isOnline: employee.isOnline,
        message: employee.isOnline ? 'Employee enabled' : 'Employee disabled',
      });
    }

    if (action === 'reset_password') {
      if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      employee.password = password;
      employee.isFirstLogin = true;
      await employee.save();

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error patching employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

