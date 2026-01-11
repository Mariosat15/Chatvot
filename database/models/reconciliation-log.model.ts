import mongoose, { Schema, Document } from 'mongoose';

export interface IReconciliationIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  userId?: string;
  userEmail?: string;
  details: {
    expected?: number;
    actual?: number;
    difference?: number;
    transactionId?: string;
    withdrawalId?: string;
    description: string;
  };
  fixed?: boolean;
  fixedAt?: Date;
  fixedBy?: string;
}

export interface IReconciliationLog extends Document {
  runAt: Date;
  runBy: string;
  runByEmail: string;
  duration: number;
  summary: {
    totalUsersChecked: number;
    totalTransactionsChecked: number;
    totalWithdrawalsChecked: number;
    issuesFound: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  balanceCheck: {
    usersWithMismatch: number;
    totalDiscrepancy: number;
  };
  issues: IReconciliationIssue[];
  healthy: boolean;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

const ReconciliationIssueSchema = new Schema({
  type: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  userId: { type: String },
  userEmail: { type: String },
  details: {
    expected: { type: Number },
    actual: { type: Number },
    difference: { type: Number },
    transactionId: { type: String },
    withdrawalId: { type: String },
    description: { type: String, required: true },
  },
  fixed: { type: Boolean, default: false },
  fixedAt: { type: Date },
  fixedBy: { type: String },
}, { _id: false });

const ReconciliationLogSchema = new Schema<IReconciliationLog>({
  runAt: { type: Date, required: true, default: Date.now },
  runBy: { type: String, required: true },
  runByEmail: { type: String, required: true },
  duration: { type: Number, required: true },
  summary: {
    totalUsersChecked: { type: Number, default: 0 },
    totalTransactionsChecked: { type: Number, default: 0 },
    totalWithdrawalsChecked: { type: Number, default: 0 },
    issuesFound: { type: Number, default: 0 },
    criticalIssues: { type: Number, default: 0 },
    warningIssues: { type: Number, default: 0 },
    infoIssues: { type: Number, default: 0 },
  },
  balanceCheck: {
    usersWithMismatch: { type: Number, default: 0 },
    totalDiscrepancy: { type: Number, default: 0 },
  },
  issues: [ReconciliationIssueSchema],
  healthy: { type: Boolean, required: true },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  errorMessage: { type: String },
}, {
  timestamps: true,
});

// Indexes
ReconciliationLogSchema.index({ runAt: -1 });
ReconciliationLogSchema.index({ runBy: 1 });
ReconciliationLogSchema.index({ healthy: 1 });

export default mongoose.models.ReconciliationLog || 
  mongoose.model<IReconciliationLog>('ReconciliationLog', ReconciliationLogSchema);

