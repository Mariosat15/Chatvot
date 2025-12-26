import { Schema, model, models, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface AdminDocument extends Document {
  email: string;
  password: string;
  name: string;
  isFirstLogin: boolean;
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
  },
  { 
    timestamps: true 
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

