import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IVATPayment extends Document {
  periodStart: Date;
  periodEnd: Date;
  vatAmount: number;        // Total VAT collected in period
  vatAmountEUR: number;     // EUR equivalent
  transactionCount: number; // Number of transactions with VAT
  status: 'pending' | 'paid';
  paidAt?: Date;
  paidBy?: string;          // Admin user ID
  paidByEmail?: string;
  reference?: string;       // Payment reference/receipt number
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VATPaymentSchema = new Schema<IVATPayment>(
  {
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    vatAmount: { type: Number, required: true, default: 0 },
    vatAmountEUR: { type: Number, required: true, default: 0 },
    transactionCount: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ['pending', 'paid'], 
      default: 'pending' 
    },
    paidAt: { type: Date },
    paidBy: { type: String },
    paidByEmail: { type: String },
    reference: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// Indexes
VATPaymentSchema.index({ periodStart: 1, periodEnd: 1 });
VATPaymentSchema.index({ status: 1 });
VATPaymentSchema.index({ createdAt: -1 });

const VATPayment: Model<IVATPayment> = mongoose.models.VATPayment || mongoose.model<IVATPayment>('VATPayment', VATPaymentSchema);

export default VATPayment;

