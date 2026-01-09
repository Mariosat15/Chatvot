import { CustomerAssignment, ICustomerAssignment } from '@/database/models/customer-assignment.model';
import { AssignmentSettings, IAssignmentSettings, AssignmentStrategy } from '@/database/models/assignment-settings.model';
import { customerAuditService, PerformedBy, CustomerInfo } from './customer-audit.service';
import { connectToDatabase } from '@/database/mongoose';
import { Admin } from '@/database/models/admin.model';
import { getTransporter } from '@/lib/nodemailer';
import { getSettings } from '@/lib/services/settings.service';
import { employeeNotificationService } from './employee-notification.service';

export interface AssignCustomerParams {
  customerId: string;
  customerEmail: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  assignedBy: PerformedBy;
  assignmentType: 'auto' | 'admin' | 'self' | 'transfer' | 'reassign';
  reason?: string;
  strategy?: string;
}

export interface TransferCustomerParams {
  customerId: string;
  toEmployeeId: string;
  performedBy: PerformedBy;
  reason?: string;
}

class CustomerAssignmentService {
  /**
   * Get assignment settings (singleton)
   */
  async getSettings(): Promise<IAssignmentSettings> {
    await connectToDatabase();
    return (AssignmentSettings as any).getSettings();
  }
  
  /**
   * Update assignment settings
   */
  async updateSettings(
    updates: Partial<IAssignmentSettings>,
    updatedBy: { adminId: string; adminEmail: string; adminName: string }
  ): Promise<IAssignmentSettings> {
    await connectToDatabase();
    return (AssignmentSettings as any).updateSettings(updates, updatedBy);
  }
  
  /**
   * Get assignment for a customer
   */
  async getAssignment(customerId: string): Promise<ICustomerAssignment | null> {
    await connectToDatabase();
    return CustomerAssignment.findOne({ customerId, isActive: true });
  }
  
  /**
   * Get all assignments for an employee
   */
  async getEmployeeAssignments(employeeId: string): Promise<ICustomerAssignment[]> {
    await connectToDatabase();
    return CustomerAssignment.find({ employeeId, isActive: true }).sort({ assignedAt: -1 });
  }
  
  /**
   * Get employee customer count
   */
  async getEmployeeCustomerCount(employeeId: string): Promise<number> {
    await connectToDatabase();
    return CustomerAssignment.countDocuments({ employeeId, isActive: true });
  }
  
  /**
   * Get all active assignments
   */
  async getAllAssignments(options: { limit?: number; skip?: number } = {}): Promise<{ assignments: ICustomerAssignment[]; total: number }> {
    await connectToDatabase();
    
    const [assignments, total] = await Promise.all([
      CustomerAssignment.find({ isActive: true })
        .sort({ assignedAt: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 100)
        .lean(),
      CustomerAssignment.countDocuments({ isActive: true }),
    ]);
    
    return { assignments: assignments as ICustomerAssignment[], total };
  }
  
  /**
   * Assign customer to employee
   */
  async assignCustomer(params: AssignCustomerParams): Promise<ICustomerAssignment> {
    await connectToDatabase();
    
    // Check if customer already has assignment
    const existingAssignment = await CustomerAssignment.findOne({ 
      customerId: params.customerId, 
      isActive: true 
    });
    
    if (existingAssignment) {
      throw new Error('Customer already has an active assignment. Use transfer instead.');
    }
    
    // Check employee customer limit
    const settings = await this.getSettings();
    if (settings.maxCustomersPerEmployee > 0) {
      const currentCount = await this.getEmployeeCustomerCount(params.employeeId);
      if (currentCount >= settings.maxCustomersPerEmployee) {
        throw new Error(`Employee has reached maximum customer limit (${settings.maxCustomersPerEmployee})`);
      }
    }
    
    // Create assignment
    const assignment = await CustomerAssignment.create({
      customerId: params.customerId,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      employeeEmail: params.employeeEmail,
      employeeRole: params.employeeRole,
      assignedAt: new Date(),
      assignedBy: {
        type: params.assignmentType,
        adminId: params.assignedBy.employeeId,
        adminEmail: params.assignedBy.employeeEmail,
        adminName: params.assignedBy.employeeName,
        reason: params.reason,
        strategy: params.strategy,
      },
      isActive: true,
    });
    
    // Log to audit trail
    await customerAuditService.logCustomerAssigned(
      { customerId: params.customerId, customerEmail: params.customerEmail, customerName: params.customerName },
      params.assignedBy,
      { id: params.employeeId, name: params.employeeName, email: params.employeeEmail },
      params.assignmentType,
      { strategy: params.strategy, reason: params.reason }
    );
    
    console.log(`✅ [Assignment] Customer ${params.customerEmail} assigned to ${params.employeeEmail}`);
    
    // Send notifications if enabled (email + in-app for customer)
    await this.sendAssignmentNotifications(
      settings,
      {
        customerId: params.customerId,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
      },
      {
        employeeId: params.employeeId,
        employeeEmail: params.employeeEmail,
        employeeName: params.employeeName,
        employeeRole: params.employeeRole,
      }
    );
    
    // Create in-app notification for employee
    await employeeNotificationService.notifyCustomerAssigned(
      {
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        employeeEmail: params.employeeEmail,
      },
      {
        customerId: params.customerId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
      },
      params.assignedBy.employeeEmail || 'System'
    );
    
    return assignment;
  }
  
  /**
   * Transfer customer to another employee
   */
  async transferCustomer(params: TransferCustomerParams): Promise<ICustomerAssignment> {
    await connectToDatabase();
    
    // Get current assignment
    const currentAssignment = await CustomerAssignment.findOne({ 
      customerId: params.customerId, 
      isActive: true 
    });
    
    if (!currentAssignment) {
      throw new Error('Customer does not have an active assignment');
    }
    
    // Get target employee
    const toEmployee = await Admin.findById(params.toEmployeeId);
    if (!toEmployee) {
      throw new Error('Target employee not found');
    }
    
    // Check target employee limit
    const settings = await this.getSettings();
    if (settings.maxCustomersPerEmployee > 0) {
      const currentCount = await this.getEmployeeCustomerCount(params.toEmployeeId);
      if (currentCount >= settings.maxCustomersPerEmployee) {
        throw new Error(`Target employee has reached maximum customer limit (${settings.maxCustomersPerEmployee})`);
      }
    }
    
    // Save previous assignment info
    const previousEmployee = {
      employeeId: currentAssignment.employeeId,
      employeeName: currentAssignment.employeeName,
      employeeEmail: currentAssignment.employeeEmail,
      employeeRole: currentAssignment.employeeRole,
      assignedAt: currentAssignment.assignedAt,
      unassignedAt: new Date(),
    };
    
    // Update assignment
    currentAssignment.previousEmployee = previousEmployee;
    currentAssignment.employeeId = toEmployee._id.toString();
    currentAssignment.employeeName = toEmployee.name;
    currentAssignment.employeeEmail = toEmployee.email;
    currentAssignment.employeeRole = toEmployee.role || 'Backoffice';
    currentAssignment.assignedAt = new Date();
    currentAssignment.assignedBy = {
      type: 'transfer',
      adminId: params.performedBy.employeeId,
      adminEmail: params.performedBy.employeeEmail,
      adminName: params.performedBy.employeeName,
      reason: params.reason,
    };
    
    await currentAssignment.save();
    
    // Log to audit trail
    await customerAuditService.logCustomerTransferred(
      { 
        customerId: params.customerId, 
        customerEmail: currentAssignment.customerEmail, 
        customerName: currentAssignment.customerName 
      },
      params.performedBy,
      { id: previousEmployee.employeeId, name: previousEmployee.employeeName, email: previousEmployee.employeeEmail },
      { id: toEmployee._id.toString(), name: toEmployee.name, email: toEmployee.email },
      params.reason
    );
    
    console.log(`🔄 [Transfer] Customer ${currentAssignment.customerEmail} transferred from ${previousEmployee.employeeEmail} to ${toEmployee.email}`);
    
    // Send in-app notifications
    const customerInfo = {
      customerId: params.customerId,
      customerName: currentAssignment.customerName,
      customerEmail: currentAssignment.customerEmail,
    };
    
    // Notify the new employee (receiving the customer)
    await employeeNotificationService.notifyCustomerTransferredIn(
      {
        employeeId: toEmployee._id.toString(),
        employeeName: toEmployee.name,
        employeeEmail: toEmployee.email,
      },
      customerInfo,
      {
        employeeId: previousEmployee.employeeId.toString(),
        employeeName: previousEmployee.employeeName,
        employeeEmail: previousEmployee.employeeEmail,
      },
      params.performedBy.employeeEmail || 'System',
      params.reason
    );
    
    // Notify the old employee (losing the customer)
    await employeeNotificationService.notifyCustomerTransferredOut(
      {
        employeeId: previousEmployee.employeeId.toString(),
        employeeName: previousEmployee.employeeName,
        employeeEmail: previousEmployee.employeeEmail,
      },
      customerInfo,
      {
        employeeId: toEmployee._id.toString(),
        employeeName: toEmployee.name,
        employeeEmail: toEmployee.email,
      },
      params.performedBy.employeeEmail || 'System',
      params.reason
    );
    
    // Transfer all chat conversations for this customer to the new employee
    try {
      await this.transferCustomerChats(
        params.customerId,
        toEmployee._id.toString(),
        toEmployee.name || toEmployee.email.split('@')[0],
        toEmployee.profileImage,
        previousEmployee.employeeId.toString(),
        previousEmployee.employeeName
      );
      console.log(`💬 [Transfer] Chat conversations transferred for customer ${currentAssignment.customerEmail}`);
    } catch (chatError) {
      console.error('Error transferring chat conversations:', chatError);
      // Don't fail the whole transfer if chat transfer fails
    }
    
    return currentAssignment;
  }
  
  /**
   * Unassign customer
   */
  async unassignCustomer(
    customerId: string,
    performedBy: PerformedBy,
    reason?: string
  ): Promise<void> {
    await connectToDatabase();
    
    const assignment = await CustomerAssignment.findOne({ customerId, isActive: true });
    
    if (!assignment) {
      throw new Error('Customer does not have an active assignment');
    }
    
    const previousEmployee = {
      id: assignment.employeeId,
      name: assignment.employeeName,
      email: assignment.employeeEmail,
    };
    
    // Mark as inactive instead of deleting (for history)
    assignment.isActive = false;
    await assignment.save();
    
    // Log to audit trail
    await customerAuditService.logCustomerUnassigned(
      { customerId, customerEmail: assignment.customerEmail, customerName: assignment.customerName },
      performedBy,
      previousEmployee,
      reason
    );
    
    console.log(`❌ [Unassign] Customer ${assignment.customerEmail} unassigned from ${previousEmployee.email}`);
    
    // Send in-app notification to the employee
    await employeeNotificationService.notifyCustomerUnassigned(
      {
        employeeId: previousEmployee.id.toString(),
        employeeName: previousEmployee.name,
        employeeEmail: previousEmployee.email,
      },
      {
        customerId,
        customerName: assignment.customerName,
        customerEmail: assignment.customerEmail,
      },
      performedBy.employeeEmail || 'System',
      reason
    );
  }
  
  /**
   * Auto-assign customer using configured strategy
   */
  async autoAssignCustomer(
    customer: CustomerInfo,
    performedBy: PerformedBy
  ): Promise<ICustomerAssignment | null> {
    await connectToDatabase();
    
    const settings = await this.getSettings();
    
    if (!settings.autoAssignEnabled) {
      console.log('⏭️ [AutoAssign] Auto-assignment is disabled');
      return null;
    }
    
    // Get eligible employees
    const eligibleEmployees = await this.getEligibleEmployees(settings);
    
    if (eligibleEmployees.length === 0) {
      console.log('⚠️ [AutoAssign] No eligible employees found');
      return null;
    }
    
    // Select employee based on strategy
    const selectedEmployee = await this.selectEmployeeByStrategy(
      eligibleEmployees, 
      settings.assignmentStrategy,
      settings
    );
    
    if (!selectedEmployee) {
      console.log('⚠️ [AutoAssign] Could not select employee by strategy');
      return null;
    }
    
    // Assign customer
    return this.assignCustomer({
      customerId: customer.customerId,
      customerEmail: customer.customerEmail,
      customerName: customer.customerName,
      employeeId: selectedEmployee._id.toString(),
      employeeName: selectedEmployee.name,
      employeeEmail: selectedEmployee.email,
      employeeRole: selectedEmployee.role || 'Backoffice',
      assignedBy: performedBy,
      assignmentType: 'auto',
      strategy: settings.assignmentStrategy,
    });
  }
  
  /**
   * Get eligible employees for assignment
   */
  private async getEligibleEmployees(settings: IAssignmentSettings): Promise<any[]> {
    const query: any = {
      status: 'active',
    };
    
    // Filter by assignable roles if specified
    if (settings.assignableRoles && settings.assignableRoles.length > 0) {
      query.role = { $in: settings.assignableRoles };
    }
    
    const employees = await Admin.find(query).lean();
    
    // Filter out employees who have reached max customers
    if (settings.maxCustomersPerEmployee > 0) {
      const eligibleEmployees: any[] = [];
      for (const emp of employees) {
        const count = await this.getEmployeeCustomerCount(emp._id.toString());
        if (count < settings.maxCustomersPerEmployee) {
          eligibleEmployees.push({ ...emp, customerCount: count });
        }
      }
      return eligibleEmployees;
    }
    
    // Add customer counts
    const employeesWithCounts = await Promise.all(
      employees.map(async (emp) => ({
        ...emp,
        customerCount: await this.getEmployeeCustomerCount(emp._id.toString()),
      }))
    );
    
    return employeesWithCounts;
  }
  
  /**
   * Select employee based on strategy
   */
  private async selectEmployeeByStrategy(
    employees: any[],
    strategy: AssignmentStrategy,
    settings: IAssignmentSettings
  ): Promise<any | null> {
    if (employees.length === 0) return null;
    
    switch (strategy) {
      case 'least_customers':
        // Sort by customer count (ascending) and return first
        return employees.sort((a, b) => a.customerCount - b.customerCount)[0];
        
      case 'round_robin':
        // Get next employee in rotation
        const index = settings.lastAssignedIndex % employees.length;
        // Update index for next time
        await AssignmentSettings.updateOne({}, { $inc: { lastAssignedIndex: 1 } });
        return employees[index];
        
      case 'newest_employee':
        // Sort by createdAt (descending) and return first
        return employees.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        
      case 'oldest_employee':
        // Sort by createdAt (ascending) and return first
        return employees.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        
      case 'random':
        // Random selection
        return employees[Math.floor(Math.random() * employees.length)];
        
      default:
        return employees[0];
    }
  }
  
  /**
   * Reassign all customers from one employee to others (when employee is deleted)
   */
  async reassignEmployeeCustomers(
    deletedEmployeeId: string,
    deletedEmployeeName: string,
    deletedEmployeeEmail: string,
    performedBy: PerformedBy
  ): Promise<{ reassigned: number; failed: number }> {
    await connectToDatabase();
    
    const settings = await this.getSettings();
    
    if (!settings.autoReassignOnEmployeeDelete) {
      // Just unassign all customers
      const result = await CustomerAssignment.updateMany(
        { employeeId: deletedEmployeeId, isActive: true },
        { $set: { isActive: false } }
      );
      console.log(`❌ [Reassign] ${result.modifiedCount} customers unassigned (auto-reassign disabled)`);
      return { reassigned: 0, failed: result.modifiedCount };
    }
    
    // Get all customers assigned to deleted employee
    const assignments = await CustomerAssignment.find({ 
      employeeId: deletedEmployeeId, 
      isActive: true 
    });
    
    console.log(`🔄 [Reassign] Reassigning ${assignments.length} customers from deleted employee ${deletedEmployeeEmail}`);
    
    let reassigned = 0;
    let failed = 0;
    
    for (const assignment of assignments) {
      try {
        // Get eligible employees (excluding deleted one)
        const eligibleEmployees = (await this.getEligibleEmployees(settings))
          .filter(emp => emp._id.toString() !== deletedEmployeeId);
        
        if (eligibleEmployees.length === 0) {
          // No eligible employees - mark as unassigned
          assignment.isActive = false;
          await assignment.save();
          failed++;
          continue;
        }
        
        // Select new employee
        const newEmployee = await this.selectEmployeeByStrategy(
          eligibleEmployees,
          settings.reassignmentStrategy,
          settings
        );
        
        if (!newEmployee) {
          assignment.isActive = false;
          await assignment.save();
          failed++;
          continue;
        }
        
        // Save previous assignment
        assignment.previousEmployee = {
          employeeId: deletedEmployeeId,
          employeeName: deletedEmployeeName,
          employeeEmail: deletedEmployeeEmail,
          employeeRole: assignment.employeeRole,
          assignedAt: assignment.assignedAt,
          unassignedAt: new Date(),
        };
        
        // Update to new employee
        assignment.employeeId = newEmployee._id.toString();
        assignment.employeeName = newEmployee.name;
        assignment.employeeEmail = newEmployee.email;
        assignment.employeeRole = newEmployee.role || 'Backoffice';
        assignment.assignedAt = new Date();
        assignment.assignedBy = {
          type: 'reassign',
          adminId: performedBy.employeeId,
          adminEmail: performedBy.employeeEmail,
          adminName: performedBy.employeeName,
          reason: 'Employee deleted',
          strategy: settings.reassignmentStrategy,
        };
        
        await assignment.save();
        
        // Log audit
        await customerAuditService.logCustomerAutoReassigned(
          { 
            customerId: assignment.customerId, 
            customerEmail: assignment.customerEmail, 
            customerName: assignment.customerName 
          },
          performedBy,
          { id: deletedEmployeeId, name: deletedEmployeeName, email: deletedEmployeeEmail },
          { id: newEmployee._id.toString(), name: newEmployee.name, email: newEmployee.email },
          'Employee deleted'
        );
        
        reassigned++;
      } catch (error) {
        console.error(`❌ [Reassign] Failed to reassign customer ${assignment.customerEmail}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ [Reassign] Complete: ${reassigned} reassigned, ${failed} failed`);
    
    return { reassigned, failed };
  }
  
  /**
   * Check if employee can edit customer (based on assignment and settings)
   */
  async canEmployeeEditCustomer(
    employeeId: string,
    employeeRole: string,
    customerId: string,
    actionType: 'profile' | 'financial' | 'kyc' | 'fraud'
  ): Promise<{ canEdit: boolean; reason?: string }> {
    await connectToDatabase();
    
    const settings = await this.getSettings();
    const assignment = await this.getAssignment(customerId);
    
    // Super admin can always edit
    // (Note: This should be checked at a higher level with isSuperAdmin flag)
    
    // Check if action type bypasses assignment
    if (actionType === 'financial' && settings.financeBypassAssignment) {
      return { canEdit: true };
    }
    if ((actionType === 'kyc' || actionType === 'fraud') && settings.complianceBypassAssignment) {
      return { canEdit: true };
    }
    
    // For backoffice profile actions, check assignment
    if (actionType === 'profile' && settings.backofficeCanOnlyEditOwn) {
      if (!assignment) {
        // No assignment - allow (unassigned customer)
        return { canEdit: true };
      }
      
      if (assignment.employeeId === employeeId) {
        return { canEdit: true };
      }
      
      return { 
        canEdit: false, 
        reason: `Customer is assigned to ${assignment.employeeName}. You can only edit your assigned customers.` 
      };
    }
    
    return { canEdit: true };
  }
  
  /**
   * Send assignment notifications if enabled (email + in-app)
   */
  private async sendAssignmentNotifications(
    settings: IAssignmentSettings,
    customer: { customerId: string; customerEmail: string; customerName: string },
    employee: { employeeId: string; employeeEmail: string; employeeName: string; employeeRole: string }
  ): Promise<void> {
    const { customerId, customerEmail, customerName } = customer;
    const { employeeId, employeeEmail, employeeName, employeeRole } = employee;
    
    try {
      const appSettings = await getSettings();
      const companyName = appSettings?.appName || 'Our Platform';
      const fromEmail = appSettings?.nodemailerEmail || process.env.NODEMAILER_EMAIL;
      
      const transporter = await getTransporter();
      
      // Send EMAIL notification to employee if enabled
      if (settings.notifyEmployeeOnAssignment && fromEmail) {
        try {
          await transporter.sendMail({
            from: `"${companyName}" <${fromEmail}>`,
            to: employeeEmail,
            subject: `New Customer Assigned: ${customerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">👤 New Customer Assigned</h1>
                </div>
                <div style="background: #141414; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #30333A; border-top: none;">
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    Hello ${employeeName},
                  </p>
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    A new customer has been assigned to you:
                  </p>
                  <div style="background: #1E1E1E; border: 1px solid #30333A; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 8px 0; color: #CCDADC;"><strong style="color: #FDD458;">Name:</strong> ${customerName}</p>
                    <p style="margin: 8px 0; color: #CCDADC;"><strong style="color: #FDD458;">Email:</strong> ${customerEmail}</p>
                  </div>
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    Please log in to the admin panel to view the customer's details and manage their account.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Best regards,<br/>${companyName} Admin Team
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`📧 [Notification] Employee EMAIL sent to ${employeeEmail}`);
        } catch (emailError) {
          console.error(`❌ [Notification] Failed to send employee email:`, emailError);
        }
      }
      
      // Send EMAIL notification to customer if enabled
      if (settings.notifyCustomerOnAssignment && fromEmail) {
        try {
          await transporter.sendMail({
            from: `"${companyName}" <${fromEmail}>`,
            to: customerEmail,
            subject: `Your Dedicated Account Manager at ${companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Meet Your Account Manager</h1>
                </div>
                <div style="background: #141414; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #30333A; border-top: none;">
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    Hello ${customerName},
                  </p>
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    We're pleased to inform you that a dedicated account manager has been assigned to assist you with your account.
                  </p>
                  <div style="background: #1E1E1E; border: 1px solid #30333A; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 8px 0; color: #CCDADC;"><strong style="color: #FDD458;">Your Account Manager:</strong> ${employeeName}</p>
                    <p style="margin: 8px 0; color: #CCDADC;"><strong style="color: #FDD458;">Contact:</strong> ${employeeEmail}</p>
                  </div>
                  <p style="color: #CCDADC; font-size: 16px; line-height: 1.6;">
                    ${employeeName} will be your primary point of contact for any questions or assistance you may need.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Best regards,<br/>The ${companyName} Team
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`📧 [Notification] Customer EMAIL sent to ${customerEmail}`);
        } catch (emailError) {
          console.error(`❌ [Notification] Failed to send customer email:`, emailError);
        }
        
        // Also create in-app notification for customer
        try {
          const mongoose = await import('mongoose');
          const db = mongoose.default.connection.db;
          if (db) {
            const notificationsCollection = db.collection('notifications');
            await notificationsCollection.insertOne({
              userId: customerId,
              templateId: 'customer_assigned_employee',
              title: '👋 Welcome! Your Account Manager',
              message: `You have been assigned a dedicated account manager: ${employeeName}. They will be your primary contact for any questions or assistance you may need.`,
              type: 'info',
              category: 'account',
              isRead: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                employeeId,
                employeeName,
                employeeEmail,
                employeeRole,
              },
            });
            console.log(`📬 [Notification] Customer IN-APP notification created for ${customerEmail}`);
          }
        } catch (inAppError) {
          console.error(`❌ [Notification] Failed to create customer in-app notification:`, inAppError);
        }
      }
    } catch (error) {
      console.error('❌ [Notification] Failed to send assignment notifications:', error);
    }
  }
  
  /**
   * Get unassigned customers count
   */
  async getUnassignedCount(totalCustomers: number): Promise<number> {
    await connectToDatabase();
    const assignedCount = await CustomerAssignment.countDocuments({ isActive: true });
    return Math.max(0, totalCustomers - assignedCount);
  }
  
  /**
   * Get assignment statistics
   */
  async getAssignmentStats(): Promise<{
    totalAssigned: number;
    byEmployee: { employeeId: string; employeeName: string; employeeEmail: string; count: number }[];
    byRole: { role: string; count: number }[];
  }> {
    await connectToDatabase();
    
    const [totalAssigned, byEmployee, byRole] = await Promise.all([
      CustomerAssignment.countDocuments({ isActive: true }),
      CustomerAssignment.aggregate([
        { $match: { isActive: true } },
        { $group: { 
          _id: '$employeeId', 
          employeeName: { $first: '$employeeName' },
          employeeEmail: { $first: '$employeeEmail' },
          count: { $sum: 1 } 
        }},
        { $sort: { count: -1 } },
      ]),
      CustomerAssignment.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$employeeRole', count: { $sum: 1 } }},
        { $sort: { count: -1 } },
      ]),
    ]);
    
    return {
      totalAssigned,
      byEmployee: byEmployee.map(e => ({
        employeeId: e._id,
        employeeName: e.employeeName,
        employeeEmail: e.employeeEmail,
        count: e.count,
      })),
      byRole: byRole.map(r => ({
        role: r._id,
        count: r.count,
      })),
    };
  }
  
  /**
   * Transfer all chat conversations for a customer to a new employee
   * Called when customer is reassigned
   */
  async transferCustomerChats(
    customerId: string,
    toEmployeeId: string,
    toEmployeeName: string,
    toEmployeeAvatar?: string,
    fromEmployeeId?: string,
    fromEmployeeName?: string
  ): Promise<void> {
    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }
    
    // Find ALL support conversations for this customer (including archived)
    // When a customer is fully transferred, ALL history should go with them
    const conversations = await db.collection('conversations').find({
      type: 'user-to-support',
      'participants.id': customerId,
      'participants.type': 'user',
    }).toArray();
    
    console.log(`💬 [TransferChats] Found ${conversations.length} conversations for customer ${customerId}`);
    
    for (const conv of conversations) {
      // Update assignment - this is a FULL transfer, not a temporary chat transfer
      const updateData: any = {
        assignedEmployeeId: new mongoose.Types.ObjectId(toEmployeeId),
        assignedEmployeeName: toEmployeeName,
        isAIHandled: false, // Disable AI when has assigned employee
        // Clear any temporary chat transfer state - full transfer takes precedence
        isChatTransferred: false,
        chatTransferredTo: null,
        chatTransferredToName: null,
        chatTransferredFrom: null,
        chatTransferredFromName: null,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Track transfer in metadata
      const transferRecord = {
        fromEmployeeId: fromEmployeeId || conv.assignedEmployeeId?.toString(),
        fromEmployeeName: fromEmployeeName || conv.assignedEmployeeName || 'Unassigned',
        toEmployeeId,
        toEmployeeName,
        reason: 'Customer reassignment',
        transferredAt: new Date(),
      };
      
      // Check if new employee is already a participant
      const hasNewEmployee = conv.participants?.some((p: any) => p.id === toEmployeeId);
      
      if (hasNewEmployee) {
        // Just update assignment
        await db.collection('conversations').updateOne(
          { _id: conv._id },
          {
            $set: updateData,
            $push: { 'metadata.transferHistory': transferRecord }
          }
        );
      } else {
        // Add new employee as participant and update assignment
        await db.collection('conversations').updateOne(
          { _id: conv._id },
          {
            $set: updateData,
            $push: {
              'metadata.transferHistory': transferRecord,
              participants: {
                id: toEmployeeId,
                type: 'employee',
                name: toEmployeeName,
                avatar: toEmployeeAvatar,
                joinedAt: new Date(),
                isActive: true,
              }
            }
          }
        );
      }
      
      // Optionally deactivate old employee as participant (but keep in history)
      if (fromEmployeeId) {
        await db.collection('conversations').updateOne(
          { _id: conv._id, 'participants.id': fromEmployeeId },
          {
            $set: {
              'participants.$.isActive': false,
              'participants.$.leftAt': new Date(),
            }
          }
        );
      }
      
      // Add system message about the transfer
      const ticketNumber = conv.ticketNumber || 1;
      const isArchived = conv.isArchived || conv.status === 'archived';
      const systemContent = isArchived 
        ? `📋 Ticket #${ticketNumber} (archived) transferred to ${toEmployeeName}.`
        : `Your conversation has been transferred to ${toEmployeeName}.`;
      
      await db.collection('messages').insertOne({
        conversationId: conv._id,
        senderId: 'system',
        senderType: 'system',
        senderName: 'System',
        content: systemContent,
        messageType: 'system',
        status: 'sent',
        readBy: [],
        isDeleted: false,
        createdAt: new Date(),
      });
      
      // Update last message
      await db.collection('conversations').updateOne(
        { _id: conv._id },
        {
          $set: {
            lastMessage: {
              content: systemContent,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              timestamp: new Date(),
            }
          }
        }
      );
      
      console.log(`💬 [TransferChats] Ticket #${ticketNumber} ${isArchived ? '(archived) ' : ''}transferred to ${toEmployeeName}`);
    }
  }
}

// Export singleton instance
export const customerAssignmentService = new CustomerAssignmentService();

export default customerAssignmentService;

