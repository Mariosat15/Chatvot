import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IVendorPayment extends Document {
  vendorId: mongoose.Types.ObjectId;  // Reference to VendorSubscription
  vendorName: string;                  // Snapshot of vendor name at payment time
  serviceType: string;                 // Snapshot of service type
  
  // Payment details
  amount: number;                      // Amount paid
  currency: string;                    // Currency (EUR, USD, etc.)
  
  // Period tracking (optional - for recurring subscription payments)
  periodStart?: Date;
  periodEnd?: Date;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  
  // Payment status and tracking
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt?: Date;
  paidBy: string;                      // Admin user ID
  paidByEmail: string;
  
  // Reference and notes
  reference?: string;                  // Payment reference/receipt
  invoiceNumber?: string;              // Vendor's invoice number
  notes?: string;
  
  // For tracking against platform earnings
  deductedFromEarnings: boolean;       // True if deducted from platform net position
  
  createdAt: Date;
  updatedAt: Date;
}

const VendorPaymentSchema = new Schema<IVendorPayment>(
  {
    vendorId: { 
      type: Schema.Types.ObjectId, 
      ref: 'VendorSubscription',
      required: true,
    },
    vendorName: { type: String, required: true },
    serviceType: { type: String, required: true },
    
    // Payment details
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EUR', uppercase: true },
    
    // Period tracking
    periodStart: { type: Date },
    periodEnd: { type: Date },
    billingCycle: { 
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'one-time'],
    },
    
    // Status
    status: { 
      type: String, 
      enum: ['pending', 'paid', 'failed', 'refunded'], 
      default: 'paid',
    },
    paidAt: { type: Date },
    paidBy: { type: String, required: true },
    paidByEmail: { type: String, required: true },
    
    // Reference
    reference: { type: String },
    invoiceNumber: { type: String },
    notes: { type: String },
    
    // Earnings tracking
    deductedFromEarnings: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
VendorPaymentSchema.index({ vendorId: 1 });
VendorPaymentSchema.index({ status: 1 });
VendorPaymentSchema.index({ createdAt: -1 });
VendorPaymentSchema.index({ paidAt: -1 });

const VendorPayment: Model<IVendorPayment> = 
  mongoose.models.VendorPayment || 
  mongoose.model<IVendorPayment>('VendorPayment', VendorPaymentSchema);

export default VendorPayment;
