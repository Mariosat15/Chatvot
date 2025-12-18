/**
 * Shared Services Package
 * 
 * Re-exports all business logic services for use across apps.
 * 
 * Usage:
 *   import { pnlCalculator, riskManager, notificationService } from '@/packages/services';
 */

// ============================================
// TRADING SERVICES
// ============================================
export * from '../../lib/services/pnl-calculator.service';
export * from '../../lib/services/risk-manager.service';
export * from '../../lib/services/real-forex-prices.service';
export * from '../../lib/services/margin-safety.service';
export * from '../../lib/services/competition-ranking.service';
export * from '../../lib/services/market-data.service';
export * from '../../lib/services/forex-historical.service';
export * from '../../lib/services/matchmaking.service';
export * from '../../lib/services/win-probability.service';

// ============================================
// NOTIFICATION SERVICES
// ============================================
export { notificationService } from '../../lib/services/notification.service';

// ============================================
// USER SERVICES
// ============================================
export * from '../../lib/services/xp-level.service';
export * from '../../lib/services/badge-evaluation.service';
export * from '../../lib/services/user-restriction.service';
export * from '../../lib/services/device-fingerprint.service';

// ============================================
// FRAUD DETECTION SERVICES
// ============================================
export * from '../../lib/services/fraud/alert-manager.service';
export * from '../../lib/services/fraud/behavioral-analysis.service';
export * from '../../lib/services/fraud/coordination-detection.service';
export * from '../../lib/services/fraud/fraud-history.service';
export * from '../../lib/services/fraud/mirror-trading.service';
export * from '../../lib/services/fraud/payment-fraud.service';
export * from '../../lib/services/fraud/similarity-detection.service';
export * from '../../lib/services/fraud/suspicion-scoring.service';
export * from '../../lib/services/fraud-settings.service';
export * from '../../lib/services/ip-detection.service';

// ============================================
// FINANCIAL SERVICES
// ============================================
export * from '../../lib/services/invoice.service';
export * from '../../lib/services/platform-financials.service';
export * from '../../lib/services/pdf-generator.service';

// ============================================
// CONFIG SERVICES
// ============================================
export * from '../../lib/services/settings.service';
export * from '../../lib/services/audit-log.service';
export * from '../../lib/services/xp-config.service';
export * from '../../lib/services/badge-config-seed.service';
export * from '../../lib/services/notification-seed.service';
export * from '../../lib/services/marketplace-seed.service';

// ============================================
// CHART SERVICES
// ============================================
export * from '../../lib/services/indicators.service';
export * from '../../lib/services/drawing-tools.service';
export * from '../../lib/services/strategy-signal.service';

// ============================================
// INFRASTRUCTURE SERVICES
// ============================================
export * from '../../lib/services/redis.service';

