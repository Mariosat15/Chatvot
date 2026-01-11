import { Schema, model, models, Document } from 'mongoose';

/**
 * Trading Symbol Settings
 * 
 * Controls which forex pairs are available for trading
 * and their individual settings (pip values, lot sizes, etc.)
 */

export interface ITradingSymbol extends Document {
  symbol: string;           // 'EUR/USD'
  name: string;             // 'Euro vs US Dollar'
  category: 'major' | 'cross' | 'exotic' | 'custom';
  enabled: boolean;         // Whether traders can see/trade this symbol
  
  // Trading specifications (from pnl-calculator.service.ts)
  pip: number;              // 0.0001 or 0.01 for JPY pairs
  contractSize: number;     // 100000 (standard lot)
  
  // Position limits
  minLotSize: number;       // Minimum trade size (e.g., 0.01)
  maxLotSize: number;       // Maximum trade size (e.g., 100)
  lotStep: number;          // Lot increment (e.g., 0.01)
  
  // Display/simulation settings
  defaultSpread: number;    // Spread in pips
  commission: number;       // Commission per lot (in USD)
  
  // UI settings
  popular: boolean;         // Show in "Popular" section
  sortOrder: number;        // Custom ordering within category
  icon: string;             // Emoji or icon identifier
  
  // Margin override (optional - uses global if not set)
  marginRequirement?: number; // Margin percentage override
  
  createdAt: Date;
  updatedAt: Date;
}

const TradingSymbolSchema = new Schema<ITradingSymbol>(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['major', 'cross', 'exotic', 'custom'],
      required: true,
      default: 'custom',
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    pip: {
      type: Number,
      required: true,
      default: 0.0001,
    },
    contractSize: {
      type: Number,
      required: true,
      default: 100000,
    },
    minLotSize: {
      type: Number,
      required: true,
      default: 0.01,
      min: 0.01,
    },
    maxLotSize: {
      type: Number,
      required: true,
      default: 100,
      min: 0.01,
    },
    lotStep: {
      type: Number,
      required: true,
      default: 0.01,
      min: 0.01,
    },
    defaultSpread: {
      type: Number,
      required: true,
      default: 1.5, // 1.5 pips
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    popular: {
      type: Boolean,
      required: true,
      default: false,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
    icon: {
      type: String,
      default: '💱',
    },
    marginRequirement: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (symbol unique index already created by schema definition)
TradingSymbolSchema.index({ enabled: 1, category: 1 });
TradingSymbolSchema.index({ category: 1, sortOrder: 1 });
TradingSymbolSchema.index({ popular: 1, enabled: 1 });

// Default forex pairs data (matches pnl-calculator.service.ts)
export const DEFAULT_FOREX_PAIRS = {
  // Major Pairs
  'EUR/USD': { name: 'Euro vs US Dollar', pip: 0.0001, category: 'major' as const, popular: true, sortOrder: 1 },
  'GBP/USD': { name: 'British Pound vs US Dollar', pip: 0.0001, category: 'major' as const, popular: true, sortOrder: 2 },
  'USD/JPY': { name: 'US Dollar vs Japanese Yen', pip: 0.01, category: 'major' as const, popular: true, sortOrder: 3 },
  'USD/CHF': { name: 'US Dollar vs Swiss Franc', pip: 0.0001, category: 'major' as const, popular: false, sortOrder: 4 },
  'AUD/USD': { name: 'Australian Dollar vs US Dollar', pip: 0.0001, category: 'major' as const, popular: true, sortOrder: 5 },
  'USD/CAD': { name: 'US Dollar vs Canadian Dollar', pip: 0.0001, category: 'major' as const, popular: false, sortOrder: 6 },
  'NZD/USD': { name: 'New Zealand Dollar vs US Dollar', pip: 0.0001, category: 'major' as const, popular: false, sortOrder: 7 },
  
  // Cross Pairs
  'EUR/GBP': { name: 'Euro vs British Pound', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 1 },
  'EUR/JPY': { name: 'Euro vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: true, sortOrder: 2 },
  'EUR/CHF': { name: 'Euro vs Swiss Franc', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 3 },
  'EUR/AUD': { name: 'Euro vs Australian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 4 },
  'EUR/CAD': { name: 'Euro vs Canadian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 5 },
  'EUR/NZD': { name: 'Euro vs New Zealand Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 6 },
  'GBP/JPY': { name: 'British Pound vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: true, sortOrder: 7 },
  'GBP/CHF': { name: 'British Pound vs Swiss Franc', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 8 },
  'GBP/AUD': { name: 'British Pound vs Australian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 9 },
  'GBP/CAD': { name: 'British Pound vs Canadian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 10 },
  'GBP/NZD': { name: 'British Pound vs New Zealand Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 11 },
  'AUD/JPY': { name: 'Australian Dollar vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: false, sortOrder: 12 },
  'AUD/CHF': { name: 'Australian Dollar vs Swiss Franc', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 13 },
  'AUD/CAD': { name: 'Australian Dollar vs Canadian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 14 },
  'AUD/NZD': { name: 'Australian Dollar vs New Zealand Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 15 },
  'CAD/JPY': { name: 'Canadian Dollar vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: false, sortOrder: 16 },
  'CAD/CHF': { name: 'Canadian Dollar vs Swiss Franc', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 17 },
  'CHF/JPY': { name: 'Swiss Franc vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: false, sortOrder: 18 },
  'NZD/JPY': { name: 'New Zealand Dollar vs Japanese Yen', pip: 0.01, category: 'cross' as const, popular: false, sortOrder: 19 },
  'NZD/CHF': { name: 'New Zealand Dollar vs Swiss Franc', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 20 },
  'NZD/CAD': { name: 'New Zealand Dollar vs Canadian Dollar', pip: 0.0001, category: 'cross' as const, popular: false, sortOrder: 21 },
  
  // Exotic Pairs
  'USD/MXN': { name: 'US Dollar vs Mexican Peso', pip: 0.0001, category: 'exotic' as const, popular: false, sortOrder: 1 },
  'USD/ZAR': { name: 'US Dollar vs South African Rand', pip: 0.0001, category: 'exotic' as const, popular: false, sortOrder: 2 },
  'USD/TRY': { name: 'US Dollar vs Turkish Lira', pip: 0.0001, category: 'exotic' as const, popular: false, sortOrder: 3 },
  'USD/SEK': { name: 'US Dollar vs Swedish Krona', pip: 0.0001, category: 'exotic' as const, popular: false, sortOrder: 4 },
  'USD/NOK': { name: 'US Dollar vs Norwegian Krone', pip: 0.0001, category: 'exotic' as const, popular: false, sortOrder: 5 },
};

const TradingSymbol = models?.TradingSymbol || model<ITradingSymbol>('TradingSymbol', TradingSymbolSchema);

export default TradingSymbol;

