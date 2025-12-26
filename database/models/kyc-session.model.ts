import { Schema, model, models, Document } from 'mongoose';

export interface IKYCSession extends Document {
  userId: string;
  userEmail?: string;
  userName?: string;
  
  // Veriff Session Data
  veriffSessionId: string;
  veriffSessionUrl: string;
  
  // Status
  status: 'created' | 'started' | 'submitted' | 'approved' | 'declined' | 'resubmission_requested' | 'expired' | 'abandoned';
  
  // Verification Result
  verificationCode?: number;
  verificationReason?: string;
  verificationReasonCode?: number;
  decisionTime?: Date;
  
  // Person Data (from Veriff)
  personData?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    idNumber?: string;
  };
  
  // Document Data (from Veriff)
  documentData?: {
    type?: string;
    number?: string;
    country?: string;
    validFrom?: string;
    validUntil?: string;
  };
  
  // Document Fingerprint for duplicate detection
  documentFingerprint?: string;  // Hash of document number + country + type
  faceFingerprint?: string;      // Veriff face similarity hash if available
  
  // Address Data (from Veriff)
  addressData?: {
    fullAddress?: string;
    street?: string;
    houseNumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Risk & Fraud
  riskScore?: number;
  fraudCheckResult?: 'pass' | 'fail' | 'review';
  fraudCheckDetails?: string[];
  
  // Data Retention (Veriff deletes session data after this date)
  dataRetentionExpiresAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  completedAt?: Date;
}

const KYCSessionSchema = new Schema<IKYCSession>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
    },
    userName: {
      type: String,
    },
    veriffSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    veriffSessionUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['created', 'started', 'submitted', 'approved', 'declined', 'resubmission_requested', 'expired', 'abandoned'],
      default: 'created',
    },
    verificationCode: Number,
    verificationReason: String,
    verificationReasonCode: Number,
    decisionTime: Date,
    personData: {
      firstName: String,
      lastName: String,
      fullName: String,
      dateOfBirth: String,
      gender: String,
      nationality: String,
      idNumber: String,
    },
    documentData: {
      type: { type: String },
      number: String,
      country: String,
      validFrom: String,
      validUntil: String,
    },
    documentFingerprint: {
      type: String,
      index: true,
    },
    faceFingerprint: {
      type: String,
      index: true,
    },
    addressData: {
      fullAddress: String,
      street: String,
      houseNumber: String,
      postcode: String,
      city: String,
      state: String,
      country: String,
    },
    riskScore: Number,
    fraudCheckResult: {
      type: String,
      enum: ['pass', 'fail', 'review'],
    },
    fraudCheckDetails: [String],
    dataRetentionExpiresAt: Date,
    submittedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
KYCSessionSchema.index({ userId: 1, status: 1 });
// Note: veriffSessionId index is created by 'unique: true' on the field
KYCSessionSchema.index({ status: 1, createdAt: -1 });
// Indexes for duplicate detection
KYCSessionSchema.index({ documentFingerprint: 1, status: 1 });
KYCSessionSchema.index({ 'documentData.number': 1, 'documentData.country': 1 });
KYCSessionSchema.index({ 'personData.idNumber': 1 });

const KYCSession = models?.KYCSession || model<IKYCSession>('KYCSession', KYCSessionSchema);

export default KYCSession;

