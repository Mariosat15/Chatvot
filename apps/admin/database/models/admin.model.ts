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
  },
  { 
    timestamps: true,
    strict: false, // Allow additional fields
  }
);

// Hash password before saving
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
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

