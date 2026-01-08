import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { AdminRoleTemplate, DEFAULT_ROLE_TEMPLATES } from '@/database/models/admin-role-template.model';
import mongoose from 'mongoose';

/**
 * POST /api/admin/reset-all-employees
 * DANGER: Deletes ALL employee accounts (except super admin) and ALL related employee data
 * Includes: employees, custom role templates, customer assignments, audit trails
 * Keeps: Super admin, default role templates, user data, trading data
 * Requires explicit confirmation to prevent accidental data loss
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth();
    
    const body = await request.json();
    const { confirmation } = body;
    
    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_EMPLOYEES') {
      return NextResponse.json(
        { error: 'Invalid confirmation. You must type "DELETE_ALL_EMPLOYEES" exactly.' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    console.log('🚨 [ADMIN] Starting FULL EMPLOYEE DATA RESET...');
    
    const results: Record<string, number> = {};
    
    // 1. Find and protect the super admin
    const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@email.com').toLowerCase();
    const oldestAdmin = await Admin.findOne({}).sort({ createdAt: 1 }).select('_id email');
    
    // Super admin is either the one with default email or the oldest admin
    const superAdminIds: string[] = [];
    
    if (oldestAdmin) {
      superAdminIds.push(oldestAdmin._id.toString());
    }
    
    const defaultEmailAdmin = await Admin.findOne({ email: defaultAdminEmail }).select('_id');
    if (defaultEmailAdmin && !superAdminIds.includes(defaultEmailAdmin._id.toString())) {
      superAdminIds.push(defaultEmailAdmin._id.toString());
    }
    
    console.log(`   🛡️ Protecting super admin(s): ${superAdminIds.length} account(s)`);
    
    // 2. Delete all employees except super admin(s)
    const deleteEmployeesResult = await Admin.deleteMany({
      _id: { $nin: superAdminIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    results['employees'] = deleteEmployeesResult.deletedCount;
    console.log(`   ✅ Deleted ${deleteEmployeesResult.deletedCount} employee accounts`);
    
    // 3. Delete custom role templates (keep defaults)
    const deleteCustomTemplatesResult = await AdminRoleTemplate.deleteMany({
      isDefault: { $ne: true }
    });
    results['customRoleTemplates'] = deleteCustomTemplatesResult.deletedCount;
    console.log(`   ✅ Deleted ${deleteCustomTemplatesResult.deletedCount} custom role templates`);
    
    // 4. Reset/ensure default role templates exist
    for (const template of DEFAULT_ROLE_TEMPLATES) {
      try {
        await AdminRoleTemplate.findOneAndUpdate(
          { name: template.name },
          { 
            $set: { 
              ...template,
              isDefault: true,
              isActive: true,
            } 
          },
          { upsert: true }
        );
      } catch (templateError) {
        console.log(`   ⚠️ Could not reset template ${template.name}:`, templateError);
      }
    }
    console.log(`   ✅ Reset ${DEFAULT_ROLE_TEMPLATES.length} default role templates`);
    
    // 5. Delete all customer assignments (collection name: customer_assignments)
    try {
      const customerAssignmentsCollection = db.collection('customer_assignments');
      const assignmentsResult = await customerAssignmentsCollection.deleteMany({});
      results['customerAssignments'] = assignmentsResult.deletedCount;
      if (assignmentsResult.deletedCount > 0) {
        console.log(`   ✅ Deleted ${assignmentsResult.deletedCount} customer assignments`);
      }
    } catch (e) {
      results['customerAssignments'] = 0;
    }
    
    // 6. Delete all customer audit trails (collection name: customer_audit_trail)
    try {
      const customerAuditTrailCollection = db.collection('customer_audit_trail');
      const auditTrailResult = await customerAuditTrailCollection.deleteMany({});
      results['customerAuditTrails'] = auditTrailResult.deletedCount;
      if (auditTrailResult.deletedCount > 0) {
        console.log(`   ✅ Deleted ${auditTrailResult.deletedCount} customer audit trail entries`);
      }
    } catch (e) {
      results['customerAuditTrails'] = 0;
    }
    
    // 7. Reset assignment settings to defaults
    try {
      const assignmentSettingsCollection = db.collection('assignment_settings');
      await assignmentSettingsCollection.deleteMany({});
      results['assignmentSettings'] = 1;
      console.log(`   ✅ Reset assignment settings`);
    } catch (e) {
      results['assignmentSettings'] = 0;
    }
    
    // 8. Delete audit logs related to employees (but keep general audit logs)
    try {
      const auditLogCollection = db.collection('auditlogs');
      const employeeAuditResult = await auditLogCollection.deleteMany({
        $or: [
          { action: { $regex: /^employee_/ } },
          { actionCategory: 'employee' },
          { targetType: 'employee' },
        ]
      });
      results['employeeAuditLogs'] = employeeAuditResult.deletedCount;
      if (employeeAuditResult.deletedCount > 0) {
        console.log(`   ✅ Deleted ${employeeAuditResult.deletedCount} employee audit log entries`);
      }
    } catch (e) {
      results['employeeAuditLogs'] = 0;
    }
    
    // Calculate total
    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);
    
    console.log(`🚨 [ADMIN] EMPLOYEE DATA RESET COMPLETE - ${totalDeleted} total items affected`);
    
    // Log this action for audit purposes
    try {
      const AuditLog = (await import('@/database/models/audit-log.model')).default;
      await AuditLog.create({
        action: 'reset_all_employees',
        actionCategory: 'system',
        description: `Full employee data reset - deleted ${totalDeleted} items, protected ${superAdminIds.length} super admin(s)`,
        metadata: results,
        status: 'success',
        userId: auth.adminId || 'admin',
        userName: auth.name || 'Admin',
        userEmail: auth.email || 'admin@system',
        userRole: 'superadmin',
        timestamp: new Date(),
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${results['employees']} employees, ${results['customerAssignments']} assignments, ${results['customerAuditTrails']} audit trails. Super admin(s) preserved.`,
      details: results,
      protectedSuperAdmins: superAdminIds.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error resetting employee data:', error);
    return NextResponse.json(
      { error: 'Failed to reset employee data' },
      { status: 500 }
    );
  }
}

