import { Schema, model, models, Document } from 'mongoose';

export interface IFraudSettings extends Document {
  // Device Fingerprinting
  deviceFingerprintingEnabled: boolean;
  deviceFingerprintBlockThreshold: number; // 0-100, block entry if risk > this
  
  // VPN/Proxy Detection
  vpnDetectionEnabled: boolean;
  blockVPN: boolean;
  blockProxy: boolean;
  blockTor: boolean;
  vpnRiskScore: number; // Default: 30
  proxyRiskScore: number; // Default: 25
  torRiskScore: number; // Default: 50
  
  // Multi-Account Detection
  multiAccountDetectionEnabled: boolean;
  maxAccountsPerDevice: number; // Alert if more than this
  
  // Risk Scoring
  entryBlockThreshold: number; // Default: 70 - Block competition entry if risk > this
  alertThreshold: number; // Default: 40 - Create alert if risk > this
  
  // Auto-Actions
  autoSuspendEnabled: boolean;
  autoSuspendThreshold: number; // Default: 90 - Auto-suspend if risk > this
  
  // Duplicate KYC Detection
  duplicateKYCAutoSuspend: boolean; // Auto-suspend users when duplicate KYC detected
  duplicateKYCSuspendMessage: string; // Message shown to suspended users
  duplicateKYCAllowWithdrawals: boolean; // Allow withdrawals even when suspended
  duplicateKYCBlockDeposits: boolean; // Block deposits
  duplicateKYCBlockTrading: boolean; // Block trading
  duplicateKYCBlockCompetitions: boolean; // Block competition entry
  duplicateKYCBlockChallenges: boolean; // Block challenge entry
  
  // Rate Limiting
  maxSignupsPerHour: number; // Max accounts from same fingerprint per hour
  maxEntriesPerHour: number; // Max competition entries per hour
  
  // Whitelisting
  whitelistedIPs: string[];
  whitelistedFingerprints: string[];
  
  // Metadata
  updatedAt: Date;
  updatedBy?: string; // Admin user ID
}

const FraudSettingsSchema = new Schema<IFraudSettings>({
  // Device Fingerprinting
  deviceFingerprintingEnabled: { type: Boolean, default: true },
  deviceFingerprintBlockThreshold: { type: Number, default: 70, min: 0, max: 100 },
  
  // VPN/Proxy Detection
  vpnDetectionEnabled: { type: Boolean, default: true },
  blockVPN: { type: Boolean, default: false }, // Don't auto-block VPNs by default
  blockProxy: { type: Boolean, default: true },
  blockTor: { type: Boolean, default: true },
  vpnRiskScore: { type: Number, default: 30, min: 0, max: 100 },
  proxyRiskScore: { type: Number, default: 25, min: 0, max: 100 },
  torRiskScore: { type: Number, default: 50, min: 0, max: 100 },
  
  // Multi-Account Detection
  multiAccountDetectionEnabled: { type: Boolean, default: true },
  maxAccountsPerDevice: { type: Number, default: 3, min: 1 },
  
  // Risk Scoring
  entryBlockThreshold: { type: Number, default: 70, min: 0, max: 100 },
  alertThreshold: { type: Number, default: 40, min: 0, max: 100 },
  
  // Auto-Actions
  autoSuspendEnabled: { type: Boolean, default: false },
  autoSuspendThreshold: { type: Number, default: 90, min: 0, max: 100 },
  
  // Duplicate KYC Detection
  duplicateKYCAutoSuspend: { type: Boolean, default: true },
  duplicateKYCSuspendMessage: { 
    type: String, 
    default: 'Your account has been suspended due to a security concern with your identity verification. Please contact support for assistance.'
  },
  duplicateKYCAllowWithdrawals: { type: Boolean, default: true }, // Allow withdrawals by default
  duplicateKYCBlockDeposits: { type: Boolean, default: true },
  duplicateKYCBlockTrading: { type: Boolean, default: true },
  duplicateKYCBlockCompetitions: { type: Boolean, default: true },
  duplicateKYCBlockChallenges: { type: Boolean, default: true },
  
  // Rate Limiting
  maxSignupsPerHour: { type: Number, default: 10, min: 1 },
  maxEntriesPerHour: { type: Number, default: 50, min: 1 },
  
  // Whitelisting
  whitelistedIPs: { type: [String], default: [] },
  whitelistedFingerprints: { type: [String], default: [] },
  
  // Metadata
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String,
}, {
  timestamps: true
});

const FraudSettings = models.FraudSettings || model<IFraudSettings>('FraudSettings', FraudSettingsSchema);

export default FraudSettings;

// Default settings
export const DEFAULT_FRAUD_SETTINGS: Partial<IFraudSettings> = {
  deviceFingerprintingEnabled: true,
  deviceFingerprintBlockThreshold: 70,
  vpnDetectionEnabled: true,
  blockVPN: false,
  blockProxy: true,
  blockTor: true,
  vpnRiskScore: 30,
  proxyRiskScore: 25,
  torRiskScore: 50,
  multiAccountDetectionEnabled: true,
  maxAccountsPerDevice: 3,
  entryBlockThreshold: 70,
  alertThreshold: 40,
  autoSuspendEnabled: false,
  autoSuspendThreshold: 90,
  // Duplicate KYC defaults - auto-suspend enabled with withdrawals allowed
  duplicateKYCAutoSuspend: true,
  duplicateKYCSuspendMessage: 'Your account has been suspended due to a security concern with your identity verification. Please contact support for assistance.',
  duplicateKYCAllowWithdrawals: true,
  duplicateKYCBlockDeposits: true,
  duplicateKYCBlockTrading: true,
  duplicateKYCBlockCompetitions: true,
  duplicateKYCBlockChallenges: true,
  maxSignupsPerHour: 10,
  maxEntriesPerHour: 50,
  whitelistedIPs: [],
  whitelistedFingerprints: [],
};

