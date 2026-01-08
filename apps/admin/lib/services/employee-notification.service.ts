import { EmployeeNotification, EmployeeNotificationType, IEmployeeNotification } from '@/database/models/employee-notification.model';
import { AssignmentSettings } from '@/database/models/assignment-settings.model';
import { connectToDatabase } from '@/database/mongoose';
import { Types } from 'mongoose';

interface CustomerInfo {
  customerId: string;
  customerName: string;
  customerEmail: string;
}

interface EmployeeInfo {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
}

class EmployeeNotificationService {
  constructor() {
    // Ensure database connection
    connectToDatabase();
  }

  /**
   * Check if employee notifications are enabled in settings
   */
  private async isNotificationEnabled(): Promise<boolean> {
    try {
      const settings = await AssignmentSettings.findOne();
      return settings?.notifyEmployeeOnAssignment ?? true; // Default to true
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Create a notification for an employee
   */
  async createNotification(
    employeeId: string,
    type: EmployeeNotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<IEmployeeNotification | null> {
    try {
      await connectToDatabase();
      
      const notification = await EmployeeNotification.create({
        employeeId: new Types.ObjectId(employeeId),
        type,
        title,
        message,
        metadata,
        isRead: false,
      });
      
      console.log(`📬 [EmployeeNotification] Created: ${type} for employee ${employeeId}`);
      return notification;
    } catch (error) {
      console.error('Error creating employee notification:', error);
      return null;
    }
  }

  /**
   * Notify employee when a customer is assigned to them
   */
  async notifyCustomerAssigned(
    employee: EmployeeInfo,
    customer: CustomerInfo,
    assignedBy: string
  ): Promise<void> {
    const enabled = await this.isNotificationEnabled();
    if (!enabled) {
      console.log(`⏭️ [EmployeeNotification] Notifications disabled, skipping customer_assigned`);
      return;
    }

    await this.createNotification(
      employee.employeeId,
      'customer_assigned',
      '👤 New Customer Assigned',
      `You have been assigned a new customer: ${customer.customerName} (${customer.customerEmail})`,
      {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        assignedBy,
      }
    );
  }

  /**
   * Notify employee when a customer is unassigned from them
   */
  async notifyCustomerUnassigned(
    employee: EmployeeInfo,
    customer: CustomerInfo,
    unassignedBy: string,
    reason?: string
  ): Promise<void> {
    const enabled = await this.isNotificationEnabled();
    if (!enabled) {
      console.log(`⏭️ [EmployeeNotification] Notifications disabled, skipping customer_unassigned`);
      return;
    }

    await this.createNotification(
      employee.employeeId,
      'customer_unassigned',
      '👤 Customer Unassigned',
      `Customer ${customer.customerName} (${customer.customerEmail}) has been unassigned from you.${reason ? ` Reason: ${reason}` : ''}`,
      {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        unassignedBy,
        reason,
      }
    );
  }

  /**
   * Notify employee when a customer is transferred TO them
   */
  async notifyCustomerTransferredIn(
    employee: EmployeeInfo,
    customer: CustomerInfo,
    fromEmployee: EmployeeInfo,
    transferredBy: string,
    reason?: string
  ): Promise<void> {
    const enabled = await this.isNotificationEnabled();
    if (!enabled) return;

    await this.createNotification(
      employee.employeeId,
      'customer_transferred_in',
      '🔄 Customer Transferred to You',
      `Customer ${customer.customerName} has been transferred to you from ${fromEmployee.employeeName}.${reason ? ` Reason: ${reason}` : ''}`,
      {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        previousEmployee: fromEmployee.employeeName,
        previousEmployeeEmail: fromEmployee.employeeEmail,
        transferredBy,
        reason,
      }
    );
  }

  /**
   * Notify employee when a customer is transferred FROM them
   */
  async notifyCustomerTransferredOut(
    employee: EmployeeInfo,
    customer: CustomerInfo,
    toEmployee: EmployeeInfo,
    transferredBy: string,
    reason?: string
  ): Promise<void> {
    const enabled = await this.isNotificationEnabled();
    if (!enabled) return;

    await this.createNotification(
      employee.employeeId,
      'customer_transferred_out',
      '🔄 Customer Transferred Away',
      `Customer ${customer.customerName} has been transferred from you to ${toEmployee.employeeName}.${reason ? ` Reason: ${reason}` : ''}`,
      {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        newEmployee: toEmployee.employeeName,
        newEmployeeEmail: toEmployee.employeeEmail,
        transferredBy,
        reason,
      }
    );
  }

  /**
   * Notify employee when their password is changed
   */
  async notifyPasswordChanged(
    employeeId: string,
    changedBy: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'password_changed',
      '🔐 Password Changed',
      changedBy === 'self' 
        ? 'You have successfully changed your password.'
        : `Your password has been reset by an administrator.`,
      { changedBy }
    );
  }

  /**
   * Notify employee when their profile is updated
   */
  async notifyProfileUpdated(
    employeeId: string,
    changes: string[],
    changedBy: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'profile_updated',
      '📝 Profile Updated',
      changedBy === 'self'
        ? `You have updated your profile: ${changes.join(', ')}`
        : `Your profile has been updated by an administrator: ${changes.join(', ')}`,
      { changes, changedBy }
    );
  }

  /**
   * Notify employee when their role changes
   */
  async notifyRoleChanged(
    employeeId: string,
    oldRole: string,
    newRole: string,
    changedBy: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'role_changed',
      '🎭 Role Changed',
      `Your role has been changed from ${oldRole} to ${newRole}.`,
      { oldRole, newRole, changedBy }
    );
  }

  /**
   * Notify employee when their sections are updated
   */
  async notifySectionsUpdated(
    employeeId: string,
    sectionsCount: number,
    changedBy: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'sections_updated',
      '📋 Access Permissions Updated',
      `Your access permissions have been updated. You now have access to ${sectionsCount} sections.`,
      { sectionsCount, changedBy }
    );
  }

  /**
   * Notify employee when their account is suspended
   */
  async notifyAccountSuspended(
    employeeId: string,
    suspendedBy: string,
    reason?: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'account_suspended',
      '⛔ Account Suspended',
      `Your account has been suspended.${reason ? ` Reason: ${reason}` : ''}`,
      { suspendedBy, reason }
    );
  }

  /**
   * Notify employee when their account is activated
   */
  async notifyAccountActivated(
    employeeId: string,
    activatedBy: string
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'account_activated',
      '✅ Account Activated',
      'Your account has been activated. You can now access the admin panel.',
      { activatedBy }
    );
  }

  /**
   * Send system message to employee
   */
  async sendSystemMessage(
    employeeId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.createNotification(
      employeeId,
      'system_message',
      title,
      message,
      metadata
    );
  }

  /**
   * Get notifications for an employee
   */
  async getNotifications(
    employeeId: string,
    options: { limit?: number; skip?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: IEmployeeNotification[]; total: number; unreadCount: number }> {
    await connectToDatabase();
    
    const query: any = { employeeId: new Types.ObjectId(employeeId) };
    if (options.unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      EmployeeNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 50)
        .lean(),
      EmployeeNotification.countDocuments(query),
      EmployeeNotification.countDocuments({ 
        employeeId: new Types.ObjectId(employeeId), 
        isRead: false 
      }),
    ]);

    return {
      notifications: notifications as IEmployeeNotification[],
      total,
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await connectToDatabase();
    await EmployeeNotification.updateOne(
      { _id: new Types.ObjectId(notificationId) },
      { isRead: true, readAt: new Date() }
    );
  }

  /**
   * Mark all notifications as read for an employee
   */
  async markAllAsRead(employeeId: string): Promise<void> {
    await connectToDatabase();
    await EmployeeNotification.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    await connectToDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await EmployeeNotification.deleteMany({
      createdAt: { $lt: cutoffDate },
    });
    
    return result.deletedCount;
  }
}

export const employeeNotificationService = new EmployeeNotificationService();
export default employeeNotificationService;

