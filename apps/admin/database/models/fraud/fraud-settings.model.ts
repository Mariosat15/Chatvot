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
  
  // ============================================
  // REGISTRATION SECURITY (Anti-Fraud/Anti-Bot)
  // ============================================
  
  // Registration Rate Limiting
  registrationRateLimitEnabled: boolean;
  maxRegistrationsPerIPPerHour: number; // Limit registrations from same IP
  maxRegistrationsPerIPPerDay: number; // Daily limit per IP
  registrationCooldownMinutes: number; // Cooldown between registrations from same fingerprint
  
  // Disposable Email Protection
  blockDisposableEmails: boolean; // Block temp email services
  disposableEmailDomains: string[]; // Custom list of blocked temp email domains
  
  // Email Domain Blocking
  blockedEmailDomains: string[]; // Specific domains to block (e.g., competitors)
  
  // Bot Protection
  honeypotEnabled: boolean; // Hidden field that bots fill out
  registrationChallengeEnabled: boolean; // Require CAPTCHA/challenge
  registrationChallengeProvider: string; // 'none' | 'recaptcha' | 'turnstile' | 'hcaptcha'
  registrationChallengeKey: string; // Public site key for challenge
  
  // Suspicious Pattern Detection
  blockSuspiciousPatterns: boolean; // Detect and block suspicious registration patterns
  suspiciousNamePatterns: string[]; // Regex patterns for suspicious names (e.g., 'test123', 'asdf')
  blockNumericOnlyNames: boolean; // Block names that are numbers only
  blockSingleCharacterNames: boolean; // Block single character names
  minNameLength: number; // Minimum name length
  
  // IP Intelligence
  blockDatacenterIPs: boolean; // Block known datacenter/hosting IPs
  blockKnownBadIPs: boolean; // Block IPs from threat intelligence lists
  
  // Account Enumeration Protection
  genericErrorMessages: boolean; // Don't reveal if email exists
  
  // ============================================
  // LOGIN SECURITY (Brute Force Protection)
  // ============================================
  
  loginRateLimitEnabled: boolean;
  maxLoginAttemptsPerHour: number; // Per IP
  maxFailedLoginsBeforeLockout: number; // Before account lockout
  loginLockoutDurationMinutes: number; // How long to lock account
  loginCooldownAfterFailedAttempts: number; // Cooldown in seconds after X failed attempts
  failedLoginAlertThreshold: number; // Alert admin after X failed attempts
  trackFailedLogins: boolean; // Store failed login attempts
  
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
  duplicateKYCAllowWithdrawals: { type: Boolean, default: true },
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
  
  // ============================================
  // REGISTRATION SECURITY (Anti-Fraud/Anti-Bot)
  // ============================================
  
  // Registration Rate Limiting
  registrationRateLimitEnabled: { type: Boolean, default: true },
  maxRegistrationsPerIPPerHour: { type: Number, default: 5, min: 1, max: 100 },
  maxRegistrationsPerIPPerDay: { type: Number, default: 10, min: 1, max: 500 },
  registrationCooldownMinutes: { type: Number, default: 1, min: 0, max: 60 },
  
  // Disposable Email Protection
  blockDisposableEmails: { type: Boolean, default: true },
  disposableEmailDomains: { 
    type: [String], 
    default: [
      'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
      'mailinator.com', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com',
      'getnada.com', 'mohmal.com', 'tempail.com', 'dispostable.com',
      'mailnesia.com', 'trashmail.com', 'sharklasers.com', 'guerrillamail.info',
      'grr.la', 'spam4.me', 'mytemp.email', 'tempr.email', 'discard.email',
      'dropmail.me', 'emailondeck.com', 'getairmail.com', 'crazymailing.com'
    ]
  },
  
  // Email Domain Blocking
  blockedEmailDomains: { type: [String], default: [] },
  
  // Bot Protection
  honeypotEnabled: { type: Boolean, default: true },
  registrationChallengeEnabled: { type: Boolean, default: false },
  registrationChallengeProvider: { type: String, default: 'none', enum: ['none', 'recaptcha', 'turnstile', 'hcaptcha'] },
  registrationChallengeKey: { type: String, default: '' },
  
  // Suspicious Pattern Detection
  blockSuspiciousPatterns: { type: Boolean, default: true },
  suspiciousNamePatterns: { 
    type: [String], 
    default: ['^test[0-9]*$', '^user[0-9]*$', '^asdf', '^qwerty', '^admin', '^root']
  },
  blockNumericOnlyNames: { type: Boolean, default: true },
  blockSingleCharacterNames: { type: Boolean, default: true },
  minNameLength: { type: Number, default: 2, min: 1, max: 10 },
  
  // IP Intelligence
  blockDatacenterIPs: { type: Boolean, default: false },
  blockKnownBadIPs: { type: Boolean, default: true },
  
  // Account Enumeration Protection
  genericErrorMessages: { type: Boolean, default: true },
  
  // ============================================
  // LOGIN SECURITY (Brute Force Protection)
  // ============================================
  
  loginRateLimitEnabled: { type: Boolean, default: true },
  maxLoginAttemptsPerHour: { type: Number, default: 20, min: 5, max: 100 },
  maxFailedLoginsBeforeLockout: { type: Number, default: 5, min: 3, max: 20 },
  loginLockoutDurationMinutes: { type: Number, default: 15, min: 1, max: 1440 },
  loginCooldownAfterFailedAttempts: { type: Number, default: 3, min: 0, max: 60 },
  failedLoginAlertThreshold: { type: Number, default: 10, min: 1, max: 100 },
  trackFailedLogins: { type: Boolean, default: true },
  
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
  // Duplicate KYC defaults
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
  
  // Registration Security defaults
  registrationRateLimitEnabled: true,
  maxRegistrationsPerIPPerHour: 5,
  maxRegistrationsPerIPPerDay: 10,
  registrationCooldownMinutes: 1,
  blockDisposableEmails: true,
  disposableEmailDomains: [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com',
    'getnada.com', 'mohmal.com', 'tempail.com', 'dispostable.com',
    'mailnesia.com', 'trashmail.com', 'sharklasers.com', 'guerrillamail.info',
    'grr.la', 'spam4.me', 'mytemp.email', 'tempr.email', 'discard.email',
    'dropmail.me', 'emailondeck.com', 'getairmail.com', 'crazymailing.com'
  ],
  blockedEmailDomains: [],
  honeypotEnabled: true,
  registrationChallengeEnabled: false,
  registrationChallengeProvider: 'none',
  registrationChallengeKey: '',
  blockSuspiciousPatterns: true,
  suspiciousNamePatterns: ['^test[0-9]*$', '^user[0-9]*$', '^asdf', '^qwerty', '^admin', '^root'],
  blockNumericOnlyNames: true,
  blockSingleCharacterNames: true,
  minNameLength: 2,
  blockDatacenterIPs: false,
  blockKnownBadIPs: true,
  genericErrorMessages: true,
  
  // Login Security defaults
  loginRateLimitEnabled: true,
  maxLoginAttemptsPerHour: 20,
  maxFailedLoginsBeforeLockout: 5,
  loginLockoutDurationMinutes: 15,
  loginCooldownAfterFailedAttempts: 3,
  failedLoginAlertThreshold: 10,
  trackFailedLogins: true,
};
