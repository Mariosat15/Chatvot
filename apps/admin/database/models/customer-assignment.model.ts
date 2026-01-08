import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomerAssignment extends Document {
  customerId: string;
  customerEmail: string;
  customerName: string;
  
  // Current assignment
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  
  // Assignment metadata
  assignedAt: Date;
  assignedBy: {
    type: 'auto' | 'admin' | 'self' | 'transfer' | 'reassign';
    adminId?: string;
    adminEmail?: string;
    adminName?: string;
    reason?: string;
    strategy?: string;
  };
  
  // Previous assignment (for transfer tracking)
  previousEmployee?: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeeRole: string;
    assignedAt: Date;
    unassignedAt: Date;
  };
  
  isActive: boolean;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const CustomerAssignmentSchema = new Schema<ICustomerAssignment>(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    
    // Current assignment
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    employeeRole: {
      type: String,
      required: true,
    },
    
    // Assignment metadata
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: {
        type: String,
        enum: ['auto', 'admin', 'self', 'transfer', 'reassign'],
        required: true,
      },
      adminId: String,
      adminEmail: String,
      adminName: String,
      reason: String,
      strategy: String,
    },
    
    // Previous assignment
    previousEmployee: {
      employeeId: String,
      employeeName: String,
      employeeEmail: String,
      employeeRole: String,
      assignedAt: Date,
      unassignedAt: Date,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: String,
  },
  {
    timestamps: true,
    collection: 'customer_assignments',
  }
);

// Compound indexes
CustomerAssignmentSchema.index({ customerId: 1, isActive: 1 });
CustomerAssignmentSchema.index({ employeeId: 1, isActive: 1 });
CustomerAssignmentSchema.index({ customerEmail: 1 });

// Static methods
CustomerAssignmentSchema.statics.findByCustomer = function(customerId: string) {
  return this.findOne({ customerId, isActive: true });
};

CustomerAssignmentSchema.statics.findByEmployee = function(employeeId: string) {
  return this.find({ employeeId, isActive: true });
};

CustomerAssignmentSchema.statics.countByEmployee = function(employeeId: string) {
  return this.countDocuments({ employeeId, isActive: true });
};

CustomerAssignmentSchema.statics.getUnassignedCustomers = async function(userModel: any) {
  const assignedCustomerIds = await this.distinct('customerId', { isActive: true });
  return userModel.find({ _id: { $nin: assignedCustomerIds } });
};

// Prevent duplicate assignments
CustomerAssignmentSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existing = await (this.constructor as any).findOne({
      customerId: this.customerId,
      isActive: true,
    });
    if (existing) {
      throw new Error('Customer already has an active assignment');
    }
  }
  next();
});

export const CustomerAssignment = mongoose.models.CustomerAssignment || 
  mongoose.model<ICustomerAssignment>('CustomerAssignment', CustomerAssignmentSchema);

export default CustomerAssignment;

