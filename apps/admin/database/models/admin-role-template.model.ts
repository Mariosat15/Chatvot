import { Schema, model, models, type Document, type Model } from 'mongoose';
import { ADMIN_SECTIONS, type AdminSection } from './admin-employee.model';

export interface IAdminRoleTemplate extends Document {
  name: string;
  description: string;
  allowedSections: AdminSection[];
  isDefault: boolean; // Pre-made templates
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminRoleTemplateSchema = new Schema<IAdminRoleTemplate>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    allowedSections: [{
      type: String,
      enum: ADMIN_SECTIONS,
    }],
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index
// Note: name already has unique index from schema definition (unique: true)
AdminRoleTemplateSchema.index({ isDefault: 1 });

export const AdminRoleTemplate: Model<IAdminRoleTemplate> =
  (models?.AdminRoleTemplate as Model<IAdminRoleTemplate>) || 
  model<IAdminRoleTemplate>('AdminRoleTemplate', AdminRoleTemplateSchema);

// Default role templates
export const DEFAULT_ROLE_TEMPLATES: Omit<IAdminRoleTemplate, keyof Document>[] = [
  {
    name: 'Full Admin',
    description: 'Full access to all admin sections except employee management',
    allowedSections: ADMIN_SECTIONS.filter(s => s !== 'employees') as AdminSection[],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Backoffice',
    description: 'Access to user management, trading, and support functions',
    allowedSections: [
      'overview',
      'users',
      'badges',
      'competitions',
      'challenges',
      'trading-history',
      'analytics',
      'market',
      'symbols',
      'kyc-history',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Financial Officer',
    description: 'Full access to all financial and payment sections',
    allowedSections: [
      'overview',
      'financial',
      'payments',
      'failed-deposits',
      'withdrawals',
      'pending-withdrawals',
      'invoices',
      'fees',
      'currency',
      'payment-providers',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Compliance Officer',
    description: 'Access to KYC, fraud detection, and audit functions',
    allowedSections: [
      'overview',
      'users',
      'kyc-settings',
      'kyc-history',
      'fraud',
      'audit-logs',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Support Agent',
    description: 'Limited access for customer support tasks',
    allowedSections: [
      'overview',
      'users',
      'trading-history',
      'kyc-history',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Content Manager',
    description: 'Access to content and marketing sections',
    allowedSections: [
      'overview',
      'hero-page',
      'marketplace',
      'competitions',
      'challenges',
      'notifications',
      'email-templates',
      'branding',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
  {
    name: 'Developer',
    description: 'Access to development and technical sections',
    allowedSections: [
      'overview',
      'dev-zone-menu',
      'redis',
      'dev-settings',
      'performance-simulator',
      'dependency-updates',
      'database',
      'ai-agent',
      'wiki',
    ],
    isDefault: true,
    isActive: true,
    createdBy: 'system',
  },
];

