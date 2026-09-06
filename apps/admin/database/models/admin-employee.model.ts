import { Schema, model, models, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

// All available admin sections that can be controlled
export const ADMIN_SECTIONS = [
  // Dashboard
  "overview",
  // Content
  "hero-page",
  "site-pages",
  "landing-pages",
  "cookie-consent",
  "visitors",
  "marketplace",
  // Trading
  "competitions",
  "challenges",
  "trading-history",
  "analytics",
  "market",
  "symbols",
  "market-data",
  // Games (X6). ADD-ONLY: this array is a Mongoose enum on both `allowedSections` and
  // `customPermissions`, so removing a value orphans every employee document storing it.
  // Note "trading-menu" is deliberately absent - it is a collapsible menu parent that
  // renders no screen, and a grant mapping to no screen is where privilege widening starts.
  "game-providers",
  "provider-health",
  // The round inspector (X6). A separate grant from `game-providers` on purpose: registering a
  // provider is a configuration job, while voiding a player's round is a decision about that
  // player's contest, and the two are not the same trust.
  "round-inspector",
  // User Management
  "users",
  "badges",
  "customer-assignment",
  // Finance
  "financial",
  "payments",
  "failed-deposits",
  "withdrawals",
  "pending-withdrawals",
  // Security
  "kyc-settings",
  "kyc-history",
  "fraud",
  // Operations
  "price-health",
  "incidents",
  // Messaging
  "messaging",
  "messaging-settings",
  // Help
  "wiki",
  "tutorials",
  // Game Master
  "gamemaster-dashboard", // For game masters - their referrals, earnings, competitions
  "gamemaster-management", // For super admin - manage all game masters
  // AI & Automation
  "ai-agent",
  "ai-knowledge",
  // Settings (main + subsections)
  "settings",
  "credentials",
  "environment",
  "branding",
  "company",
  "invoices",
  "email-templates",
  "notifications",
  "trading-risk",
  "currency",
  "fees",
  "payment-providers",
  "database",
  "audit-logs",
  // Dev Zone (main + subsections)
  "dev-zone-menu",
  "server-monitor",
  "server-options",
  "redis",
  "dev-settings",
  "performance-simulator",
  "image-optimizer",
  "dependency-updates",
  // Admin (Super Admin only)
  "employees",
  // My Account
  "profile",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type EmployeeRole =
  | "admin"
  | "backoffice"
  | "payments"
  | "support"
  | "compliance"
  | "custom";
export type EmployeeStatus = "active" | "disabled" | "pending";

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
      enum: [
        "admin",
        "backoffice",
        "payments",
        "support",
        "compliance",
        "custom",
      ],
      default: "custom",
    },
    roleTemplateId: {
      type: String,
    },
    customPermissions: [
      {
        type: String,
        enum: ADMIN_SECTIONS,
      },
    ],
    allowedSections: [
      {
        type: String,
        enum: ADMIN_SECTIONS,
      },
    ],
    status: {
      type: String,
      enum: ["active", "disabled", "pending"],
      default: "pending",
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
  },
);

// Hash password before saving
AdminEmployeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

// Method to compare password
AdminEmployeeSchema.methods.comparePassword = async function (
  candidatePassword: string,
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
  model<IAdminEmployee>("AdminEmployee", AdminEmployeeSchema);
