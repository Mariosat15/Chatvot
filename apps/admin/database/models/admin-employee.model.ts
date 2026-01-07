import { Schema, model, models, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// All available admin sections that can be controlled
export const ADMIN_SECTIONS = [
  // Dashboard
  'overview',
  // Content
  'hero-page',
  'marketplace',
  // Trading
  'competitions',
  'challenges',
  'trading-history',
  'analytics',
  'market',
  'symbols',
  // User Management
  'users',
  'badges',
  // Finance
  'financial',
  'payments',
  'failed-deposits',
  'withdrawals',
  'pending-withdrawals',
  // Security
  'kyc-settings',
  'kyc-history',
  'fraud',
  // Help
  'wiki',
  // Settings
  'credentials',
  'email-templates',
  'notifications',
  'payment-providers',
  'fee',
  'invoicing',
  'reconciliation',
  'database',
  // Developer Zone
  'ai-agent',
  'whitelabel',
  'audit-logs',
  // Employees (Super Admin only)
  'employees',
] as const;

export type AdminSection = typeof ADMIN_SECTIONS[number];

export type EmployeeRole = 'admin' | 'backoffice' | 'payments' | 'support' | 'compliance' | 'custom';
export type EmployeeStatus = 'active' | 'disabled' | 'pending';

export interface IAdminEmployee extends Document {
  email: string;
  password: string;
  name: string;
  role: EmployeeRole;
  roleTemplateId?: string; // Reference to a role template
  customPermissions?: AdminSection[]; // Custom permissions if role is 'custom'
  allowedSections: AdminSection[];
  status: EmployeeStatus;
  isSuperAdmin: boolean;
  lastLogin?: Date;
  lastActivity?: Date;
  isOnline: boolean;
  createdBy: string; // Admin who created this employee
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt?: Date;
  mustChangePassword: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AdminEmployeeSchema = new Schema<IAdminEmployee>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'backoffice', 'payments', 'support', 'compliance', 'custom'],
      default: 'custom',
    },
    roleTemplateId: {
      type: String,
    },
    customPermissions: [{
      type: String,
      enum: ADMIN_SECTIONS,
    }],
    allowedSections: [{
      type: String,
      enum: ADMIN_SECTIONS,
    }],
    status: {
      type: String,
      enum: ['active', 'disabled', 'pending'],
      default: 'pending',
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    lastActivity: {
      type: Date,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
    passwordChangedAt: {
      type: Date,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
AdminEmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

// Method to compare password
AdminEmployeeSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for efficient lookups
// Note: email already has unique index from schema definition (unique: true)
AdminEmployeeSchema.index({ status: 1 });
AdminEmployeeSchema.index({ role: 1 });
AdminEmployeeSchema.index({ isOnline: 1 });

export const AdminEmployee: Model<IAdminEmployee> =
  (models?.AdminEmployee as Model<IAdminEmployee>) || 
  model<IAdminEmployee>('AdminEmployee', AdminEmployeeSchema);

