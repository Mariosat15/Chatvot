import mongoose, { Schema, Document } from 'mongoose';

export type AssignmentStrategy = 
  | 'least_customers'    // Assign to employee with fewest active customers
  | 'round_robin'        // Assign in rotating order
  | 'newest_employee'    // Assign to most recently added employee
  | 'oldest_employee'    // Assign to longest-serving employee
  | 'random';            // Random selection

export interface IAssignmentSettings extends Document {
  // Auto-assignment configuration
  autoAssignEnabled: boolean;
  assignmentStrategy: AssignmentStrategy;
  
  // Which roles can be assigned customers
  assignableRoles: string[];
  
  // Limits
  maxCustomersPerEmployee: number; // 0 = unlimited
  
  // Behavior
  autoReassignOnEmployeeDelete: boolean;
  reassignmentStrategy: AssignmentStrategy;
  notifyEmployeeOnAssignment: boolean;
  notifyCustomerOnAssignment: boolean;
  
  // Access control
  backofficeCanOnlyEditOwn: boolean;        // If true, backoffice can only edit assigned customers
  financeBypassAssignment: boolean;          // If true, finance can process any customer
  complianceBypassAssignment: boolean;       // If true, compliance can process any customer
  
  // Self-assignment
  allowSelfAssignment: boolean;              // Employees can assign themselves to customers
  requireApprovalForSelfAssign: boolean;     // Self-assignment needs admin approval
  
  // UI Settings
  showUnassignedFirst: boolean;              // In user list, show unassigned customers first
  highlightUnassigned: boolean;              // Highlight unassigned customers
  
  // Round robin state (for round_robin strategy)
  lastAssignedIndex: number;
  
  // Audit
  updatedAt: Date;
  updatedBy: {
    adminId: string;
    adminEmail: string;
    adminName: string;
  };
  
  createdAt: Date;
}

const AssignmentSettingsSchema = new Schema<IAssignmentSettings>(
  {
    // Auto-assignment configuration
    autoAssignEnabled: {
      type: Boolean,
      default: false,
    },
    assignmentStrategy: {
      type: String,
      enum: ['least_customers', 'round_robin', 'newest_employee', 'oldest_employee', 'random'],
      default: 'least_customers',
    },
    
    // Which roles can be assigned customers
    assignableRoles: {
      type: [String],
      default: ['Backoffice'],
    },
    
    // Limits
    maxCustomersPerEmployee: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    
    // Behavior
    autoReassignOnEmployeeDelete: {
      type: Boolean,
      default: true,
    },
    reassignmentStrategy: {
      type: String,
      enum: ['least_customers', 'round_robin', 'newest_employee', 'oldest_employee', 'random'],
      default: 'least_customers',
    },
    notifyEmployeeOnAssignment: {
      type: Boolean,
      default: true,
    },
    notifyCustomerOnAssignment: {
      type: Boolean,
      default: false,
    },
    
    // Access control
    backofficeCanOnlyEditOwn: {
      type: Boolean,
      default: true,
    },
    financeBypassAssignment: {
      type: Boolean,
      default: true,
    },
    complianceBypassAssignment: {
      type: Boolean,
      default: true,
    },
    
    // Self-assignment
    allowSelfAssignment: {
      type: Boolean,
      default: true,
    },
    requireApprovalForSelfAssign: {
      type: Boolean,
      default: false,
    },
    
    // UI Settings
    showUnassignedFirst: {
      type: Boolean,
      default: true,
    },
    highlightUnassigned: {
      type: Boolean,
      default: true,
    },
    
    // Round robin state
    lastAssignedIndex: {
      type: Number,
      default: 0,
    },
    
    // Audit
    updatedBy: {
      adminId: String,
      adminEmail: String,
      adminName: String,
    },
  },
  {
    timestamps: true,
    collection: 'assignment_settings',
  }
);

// Static method to get or create settings (singleton pattern)
AssignmentSettingsSchema.statics.getSettings = async function(): Promise<IAssignmentSettings> {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = await this.create({
      autoAssignEnabled: false,
      assignmentStrategy: 'least_customers',
      assignableRoles: ['Backoffice'],
      maxCustomersPerEmployee: 0,
      autoReassignOnEmployeeDelete: true,
      reassignmentStrategy: 'least_customers',
      notifyEmployeeOnAssignment: true,
      notifyCustomerOnAssignment: false,
      backofficeCanOnlyEditOwn: true,
      financeBypassAssignment: true,
      complianceBypassAssignment: true,
      allowSelfAssignment: true,
      requireApprovalForSelfAssign: false,
      showUnassignedFirst: true,
      highlightUnassigned: true,
      lastAssignedIndex: 0,
    });
  }
  
  return settings;
};

// Static method to update settings
AssignmentSettingsSchema.statics.updateSettings = async function(
  updates: Partial<IAssignmentSettings>,
  updatedBy: { adminId: string; adminEmail: string; adminName: string }
): Promise<IAssignmentSettings> {
  const settings = await this.getSettings();
  
  Object.assign(settings, updates, { updatedBy });
  await settings.save();
  
  return settings;
};

// Helper function to get strategy description
export function getStrategyDescription(strategy: AssignmentStrategy): string {
  const descriptions: Record<AssignmentStrategy, string> = {
    least_customers: 'Assign to employee with the fewest active customers (balance workload)',
    round_robin: 'Assign in rotating order (A → B → C → A → ...)',
    newest_employee: 'Assign to most recently added employee (training mode)',
    oldest_employee: 'Assign to longest-serving employee (experience priority)',
    random: 'Randomly select from available employees',
  };
  return descriptions[strategy];
}

export const AssignmentSettings = mongoose.models.AssignmentSettings || 
  mongoose.model<IAssignmentSettings>('AssignmentSettings', AssignmentSettingsSchema);

export default AssignmentSettings;

