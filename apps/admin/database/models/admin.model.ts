import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface AdminDocument extends Document {
  email: string;
  password: string;
  name: string;
  isFirstLogin: boolean;
  // Employee management fields (optional for original admin)
  role?: string;
  roleTemplateId?: Types.ObjectId;
  allowedSections?: string[];
  isOnline?: boolean;
  lastLogin?: Date;
  lastActivity?: Date;
  status?: 'active' | 'disabled';
  // Force logout tracking
  forceLogoutAt?: Date;
  // Lockout - when true, employee cannot log in at all
  isLockedOut?: boolean;
  lockedOutAt?: Date;
  lockedOutBy?: string;
  lockedOutReason?: string;
  // Chat availability
  isAvailableForChat?: boolean;
  unavailableReason?: string;
  unavailableSince?: Date;
  unavailableUntil?: Date;
  // Temporary password tracking
  tempPasswordExpiresAt?: Date;
  passwordChangedAt?: Date;
  mustChangePassword?: boolean;
  // Profile fields
  avatar?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  department?: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AdminSchema = new Schema<AdminDocument>(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
    password: { 
      type: String, 
      required: true 
    },
    name: {
      type: String,
      default: 'Admin',
      trim: true
    },
    isFirstLogin: { 
      type: Boolean, 
      default: true 
    },
    // Employee management fields
    role: {
      type: String,
      default: undefined,
    },
    roleTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminRoleTemplate',
      default: undefined,
    },
    allowedSections: {
      type: [String],
      default: undefined,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: undefined,
    },
    lastActivity: {
      type: Date,
      default: undefined,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    // Force logout - if set, tokens issued before this time are invalid
    forceLogoutAt: {
      type: Date,
      default: undefined,
    },
    // Lockout - when true, employee cannot log in at all (toggle-based)
    isLockedOut: {
      type: Boolean,
      default: false,
    },
    lockedOutAt: {
      type: Date,
      default: undefined,
    },
    lockedOutBy: {
      type: String,
      default: undefined,
    },
    lockedOutReason: {
      type: String,
      default: undefined,
    },
    // Chat availability
    isAvailableForChat: {
      type: Boolean,
      default: true,
    },
    unavailableReason: {
      type: String,
      default: undefined,
    },
    unavailableSince: {
      type: Date,
      default: undefined,
    },
    unavailableUntil: {
      type: Date,
      default: undefined,
    },
    // Temporary password expiry (for auto-generated passwords)
    tempPasswordExpiresAt: {
      type: Date,
      default: undefined,
    },
    passwordChangedAt: {
      type: Date,
      default: undefined,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    // Profile fields
    avatar: {
      type: String,
      default: undefined,
    },
    phone: {
      type: String,
      default: undefined,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    language: {
      type: String,
      default: 'en',
    },
    bio: {
      type: String,
      default: undefined,
    },
    department: {
      type: String,
      default: undefined,
    },
    title: {
      type: String,
      default: undefined,
    },
  },
  { 
    timestamps: true,
    strict: false, // Allow additional fields
  }
);

// Hash password before saving
AdminSchema.pre('save', async function (next) {
  // Skip if password not modified AND not a new document
  if (!this.isModified('password') && !this.isNew) return next();
  
  // Skip if password is not set
  if (!this.password) return next();
  
  // Skip if already hashed (bcrypt hashes start with $2a$ or $2b$)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    console.log('⚠️ Password already hashed, skipping re-hash');
    return next();
  }
  
  console.log(`🔐 Hashing password for ${this.email} (length: ${this.password.length})`);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  console.log(`✅ Password hashed successfully (hash length: ${this.password.length})`);
  next();
});

// Method to compare password
AdminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Admin: Model<AdminDocument> =
  (models?.Admin as Model<AdminDocument>) || model<AdminDocument>('Admin', AdminSchema);

