/**
 * Shared Database Package
 * 
 * Re-exports all MongoDB models for use across apps.
 * Both main app, admin app, and worker can import from here.
 * 
 * Usage:
 *   import { User, Competition, TradingPosition } from '@/packages/database';
 */

// ============================================
// DATABASE CONNECTION
// ============================================
export { connectToDatabase } from '../../database/mongoose';

// ============================================
// USER & AUTH MODELS
// ============================================
export { Admin } from '../../database/models/admin.model';
export { default as UserBadge } from '../../database/models/user-badge.model';
export { default as UserLevel } from '../../database/models/user-level.model';
export { default as UserNotificationPreferences } from '../../database/models/user-notification-preferences.model';
export { default as UserPresence } from '../../database/models/user-presence.model';
export { default as UserRestriction } from '../../database/models/user-restriction.model';

// ============================================
// TRADING MODELS
// ============================================
export { default as Competition } from '../../database/models/trading/competition.model';
export { default as CompetitionParticipant } from '../../database/models/trading/competition-participant.model';
export { default as Challenge } from '../../database/models/trading/challenge.model';
export { default as ChallengeParticipant } from '../../database/models/trading/challenge-participant.model';
export { default as ChallengeSettings } from '../../database/models/trading/challenge-settings.model';
export { default as TradingPosition } from '../../database/models/trading/trading-position.model';
export { default as TradingOrder } from '../../database/models/trading/trading-order.model';
export { default as TradeHistory } from '../../database/models/trading/trade-history.model';
export { default as CreditWallet } from '../../database/models/trading/credit-wallet.model';
export { default as WalletTransaction } from '../../database/models/trading/wallet-transaction.model';
export { default as PriceLog } from '../../database/models/trading/price-log.model';

// ============================================
// SETTINGS MODELS
// ============================================
export { default as AppSettings } from '../../database/models/app-settings.model';
export { default as CompanySettings } from '../../database/models/company-settings.model';
export { default as CompetitionRules } from '../../database/models/competition-rules.model';
export { default as TradingRiskSettings } from '../../database/models/trading-risk-settings.model';
export { default as CreditConversionSettings } from '../../database/models/credit-conversion-settings.model';
export { default as HeroSettings } from '../../database/models/hero-settings.model';
export { default as InvoiceSettings } from '../../database/models/invoice-settings.model';

// ============================================
// NOTIFICATION MODELS
// ============================================
export { default as Notification } from '../../database/models/notification.model';
export { default as NotificationTemplate } from '../../database/models/notification-template.model';
export { default as EmailTemplate } from '../../database/models/email-template.model';

// ============================================
// FRAUD DETECTION MODELS
// ============================================
export { default as FraudAlert } from '../../database/models/fraud/fraud-alert.model';
export { FraudHistory } from '../../database/models/fraud/fraud-history.model';
export { default as FraudSettings } from '../../database/models/fraud/fraud-settings.model';
export { default as DeviceFingerprint } from '../../database/models/fraud/device-fingerprint.model';
export { default as PaymentFingerprint } from '../../database/models/fraud/payment-fingerprint.model';
export { default as SuspicionScore } from '../../database/models/fraud/suspicion-score.model';
export { default as BehavioralSimilarity } from '../../database/models/fraud/behavioral-similarity.model';
export { default as TradingBehaviorProfile } from '../../database/models/fraud/trading-behavior-profile.model';

// ============================================
// MARKETPLACE MODELS
// ============================================
export { MarketplaceItem } from '../../database/models/marketplace/marketplace-item.model';
export { UserPurchase } from '../../database/models/marketplace/user-purchase.model';

// ============================================
// FINANCIAL MODELS
// ============================================
export { default as Invoice } from '../../database/models/invoice.model';
export { default as VatPayment } from '../../database/models/vat-payment.model';
export { default as PaymentProvider } from '../../database/models/payment-provider.model';
export { PlatformTransaction, PlatformBalanceSnapshot } from '../../database/models/platform-financials.model';

// ============================================
// CONFIG MODELS
// ============================================
export { default as BadgeConfig } from '../../database/models/badge-config.model';
export { default as XpConfig } from '../../database/models/xp-config.model';
export { default as AuditLog } from '../../database/models/audit-log.model';
export { WhiteLabel } from '../../database/models/whitelabel.model';

