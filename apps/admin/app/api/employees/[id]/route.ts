import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { AdminRoleTemplate } from '@/database/models/admin-role-template.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_SECTIONS, type AdminSection } from '@/database/models/admin-employee.model';
import { auditLogService } from '@/lib/services/audit-log.service';

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

    const previousRole = employee.role;
    await employee.save();

    // Audit log
    const adminInfo = {
      id: auth.adminId!,
      email: auth.email!,
      name: auth.name,
      role: auth.isSuperAdmin ? 'superadmin' as const : 'admin' as const,
    };

    const changes: Record<string, any> = {};
    if (name) changes.name = name;
    if (email && email !== employee.email) changes.email = email;
    if (roleTemplateId || customSections) changes.role = employee.role;

    await auditLogService.logEmployeeUpdated(adminInfo, id, employee.name, changes);

    if (previousRole !== employee.role) {
      await auditLogService.logEmployeeRoleChanged(adminInfo, id, employee.name, previousRole || 'None', employee.role || 'Custom');
    }

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
        status: employee.status,
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

    const deletedName = employee.name;
    const deletedEmail = employee.email;
    
    // Force logout before deletion (in case there's any caching)
    await Admin.updateOne(
      { _id: id },
      { forceLogoutAt: new Date(), isOnline: false, status: 'disabled' }
    );
    
    // Small delay to ensure the force logout is propagated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now delete the employee
    await Admin.findByIdAndDelete(id);

    // Audit log
    const adminInfo = {
      id: auth.adminId!,
      email: auth.email!,
      name: auth.name,
      role: auth.isSuperAdmin ? 'superadmin' as const : 'admin' as const,
    };
    await auditLogService.logEmployeeDeleted(adminInfo, id, deletedName, deletedEmail);

    console.log(`✅ Employee deleted: ${deletedEmail} (was force logged out first)`);

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
    const { action, password, reason } = body;

    // Admin info for audit logging
    const adminInfo = {
      id: auth.adminId!,
      email: auth.email!,
      name: auth.name,
      role: auth.isSuperAdmin ? 'superadmin' as const : 'admin' as const,
    };

    if (action === 'suspend') {
      // Suspend the employee - they can no longer log in
      employee.status = 'disabled';
      employee.isOnline = false; // Force offline
      await employee.save();
      
      await auditLogService.logEmployeeSuspended(adminInfo, id, employee.name, reason);
      
      return NextResponse.json({
        success: true,
        status: 'disabled',
        message: `Employee ${employee.name} has been suspended`,
      });
    }

    if (action === 'unsuspend') {
      // Unsuspend the employee - they can log in again
      employee.status = 'active';
      await employee.save();
      
      await auditLogService.logEmployeeUnsuspended(adminInfo, id, employee.name);
      
      return NextResponse.json({
        success: true,
        status: 'active',
        message: `Employee ${employee.name} has been unsuspended`,
      });
    }

    if (action === 'toggle_status') {
      // Toggle between active and disabled
      const newStatus = employee.status === 'disabled' ? 'active' : 'disabled';
      employee.status = newStatus;
      if (newStatus === 'disabled') {
        employee.isOnline = false; // Force offline when suspending
      }
      await employee.save();
      
      if (newStatus === 'disabled') {
        await auditLogService.logEmployeeSuspended(adminInfo, id, employee.name);
      } else {
        await auditLogService.logEmployeeUnsuspended(adminInfo, id, employee.name);
      }
      
      return NextResponse.json({
        success: true,
        status: newStatus,
        message: newStatus === 'active' ? 'Employee unsuspended' : 'Employee suspended',
      });
    }

    if (action === 'reset_password') {
      if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      // Set the password - it will be hashed by the pre-save hook
      employee.password = password;
      employee.isFirstLogin = true;
      // Clear temp password expiry when manually resetting
      employee.tempPasswordExpiresAt = undefined;
      
      // Force existing sessions to be invalidated
      employee.forceLogoutAt = new Date();
      
      await employee.save();

      await auditLogService.logEmployeePasswordReset(adminInfo, id, employee.name);

      console.log(`✅ Password reset for ${employee.email}, forceLogoutAt set to invalidate old sessions`);

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. Employee will need to log in again.',
      });
    }

    if (action === 'force_logout') {
      // Set forceLogoutAt to now - any tokens issued before this are invalid
      employee.forceLogoutAt = new Date();
      employee.isOnline = false;
      await employee.save();

      await auditLogService.log({
        admin: adminInfo,
        action: 'employee_force_logout',
        category: 'system',
        description: `Force logged out employee: ${employee.name}`,
        targetType: 'user',
        targetId: id,
        targetName: employee.name,
      });

      console.log(`✅ Force logout for ${employee.email}`);

      return NextResponse.json({
        success: true,
        message: `${employee.name} has been logged out`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error patching employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

