import { Schema, model, models, type Document, type Model } from "mongoose";
import { ADMIN_SECTIONS, type AdminSection } from "./admin-employee.model";

export interface IAdminRoleTemplate extends Document {
  name: string;
  description: string;
  allowedSections: AdminSection[];
  isDefault: boolean; // Pre-made templates
  seededSections?: AdminSection[];
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
      default: "",
    },
    allowedSections: [
      {
        type: String,
        enum: ADMIN_SECTIONS,
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    // Reason: the code sections a default template has already been offered by
    // syncDefaultRoleTemplates. Only sections absent from here are added, so a section a
    // super admin removed stays removed while sections added to the code later still arrive.
    seededSections: [
      {
        type: String,
        enum: ADMIN_SECTIONS,
      },
    ],
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
  },
);

// Index
// Note: name already has unique index from schema definition (unique: true)
AdminRoleTemplateSchema.index({ isDefault: 1 });

export const AdminRoleTemplate: Model<IAdminRoleTemplate> =
  (models?.AdminRoleTemplate as Model<IAdminRoleTemplate>) ||
  model<IAdminRoleTemplate>("AdminRoleTemplate", AdminRoleTemplateSchema);

// Type for default templates (excludes Document properties and auto-generated timestamps)
type RoleTemplateInput = Omit<
  IAdminRoleTemplate,
  keyof Document | "createdAt" | "updatedAt"
>;

// Default role templates
export const DEFAULT_ROLE_TEMPLATES: RoleTemplateInput[] = [
  {
    name: "Full Admin",
    // Reason: owner decision, 3 Oct 2026 - an admin can do everything a super admin can,
    // employee management included. Derived from ADMIN_SECTIONS so every section added
    // later reaches it through syncDefaultRoleTemplates.
    description: "Full access to every admin section, like the super admin",
    allowedSections: [...ADMIN_SECTIONS],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Backoffice",
    description: "Access to user management, trading, and support functions",
    allowedSections: [
      "overview",
      "users",
      "badges",
      "customer-assignment",
      "competitions",
      "challenges",
      "trading-history",
      "analytics",
      "market",
      "symbols",
      "market-data",
      "kyc-history",
      "messaging",
      "round-inspector",
      "wiki",
      "tutorials",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Financial Officer",
    description: "Full access to all financial and payment sections",
    allowedSections: [
      "overview",
      "financial",
      "payments",
      "failed-deposits",
      "withdrawals",
      "pending-withdrawals",
      "invoices",
      "fees",
      "currency",
      "payment-providers",
      "vendors",
      "audit-logs",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Compliance Officer",
    description: "Access to KYC, fraud detection, and audit functions",
    allowedSections: [
      "overview",
      "users",
      "kyc-settings",
      "kyc-history",
      "fraud",
      "audit-logs",
      "incidents",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Support Agent",
    description: "Limited access for customer support tasks",
    allowedSections: [
      "overview",
      "users",
      "trading-history",
      "kyc-history",
      "messaging",
      "incidents",
      "wiki",
      "tutorials",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Content Manager",
    description: "Access to content and marketing sections",
    allowedSections: [
      "overview",
      "hero-page",
      "site-pages",
      "landing-pages",
      "cookie-consent",
      "system-announcements",
      "marketplace",
      "competitions",
      "challenges",
      "notifications",
      "email-templates",
      "branding",
      "terminology",
      "trading-page",
      "journey-map",
      "tutorials",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Developer",
    description: "Access to development and technical sections",
    allowedSections: [
      "overview",
      "dev-zone-menu",
      "server-monitor",
      "server-fleet",
      "server-options",
      "redis",
      "mdb-cluster",
      "data-cleanup",
      "data-maintenance",
      "dev-settings",
      "performance-simulator",
      "image-optimizer",
      "dependency-updates",
      "command-alerts",
      "database",
      "ai-agent",
      "ai-knowledge",
      "price-health",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Operations Manager",
    description: "Access to operations, monitoring, and incident management",
    allowedSections: [
      "overview",
      "price-health",
      "incidents",
      "market",
      "symbols",
      "market-data",
      "analytics",
      "provider-health",
      "game-performance",
      "round-inspector",
      "audit-logs",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Game Master Manager",
    description: "Access to Game Master management and related functions",
    allowedSections: [
      "overview",
      "gamemaster-dashboard",
      "gamemaster-management",
      "gm-competition-defaults",
      "users",
      "competitions",
      "challenges",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
  {
    name: "Games Manager",
    description: "Access to game providers, games, rounds and game performance",
    allowedSections: [
      "overview",
      "game-providers",
      "provider-health",
      "game-performance",
      "round-inspector",
      "competitions",
      "challenges",
      "badges",
      "journey-map",
      "gamification-wizard",
      "wiki",
      "profile",
    ],
    isDefault: true,
    isActive: true,
    createdBy: "system",
  },
];
