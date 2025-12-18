/**
 * Shared Utilities Package
 * 
 * Re-exports utility functions, constants, and types for use across apps.
 * 
 * Usage:
 *   import { cn, debounce, PERFORMANCE_INTERVALS } from '@/packages/shared';
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================
export { cn } from '../../lib/utils';
export { debounce, PERFORMANCE_INTERVALS } from '../../lib/utils/performance';

// ============================================
// CONSTANTS
// ============================================
export * from '../../lib/constants';
export * from '../../lib/constants/badges';
export * from '../../lib/constants/levels';

// ============================================
// TYPES
// ============================================
export type { ForexSymbol } from '../../lib/services/pnl-calculator.service';

// ============================================
// CONFIG
// ============================================
export * from '../../lib/config/sector-configs';

