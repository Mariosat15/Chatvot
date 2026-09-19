import { Schema, model, models, Document } from "mongoose";

/**
 * Trading Symbol Settings
 *
 * Controls which forex pairs are available for trading
 * and their individual settings (pip values, lot sizes, etc.)
 */

export interface ITradingSymbol extends Document {
  symbol: string; // 'EUR/USD'
  name: string; // 'Euro vs US Dollar'
  category: "major" | "cross" | "exotic" | "custom";
  enabled: boolean; // Whether traders can see/trade this symbol

  // Trading specifications (from pnl-calculator.service.ts)
  pip: number; // 0.0001 or 0.01 for JPY pairs
  contractSize: number; // 100000 (standard lot)

  // Position limits
  minLotSize: number; // Minimum trade size (e.g., 0.01)
  maxLotSize: number; // Maximum trade size (e.g., 100)
  lotStep: number; // Lot increment (e.g., 0.01)

  // Display/simulation settings
  defaultSpread: number; // Spread in pips
  useFixedSpread: boolean; // If true, use fixed spread; if false, use variable from Massive.com
  commission: number; // Commission per lot (in USD)

  // UI settings
  popular: boolean; // Show in "Popular" section
  sortOrder: number; // Custom ordering within category
  icon: string; // Emoji or icon identifier

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
      enum: ["major", "cross", "exotic", "custom"],
      required: true,
      default: "custom",
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
    useFixedSpread: {
      type: Boolean,
      required: true,
      default: false, // Default to variable spread (current behavior)
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
      default: "💱",
    },
    marginRequirement: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes (symbol unique index already created by schema definition)
TradingSymbolSchema.index({ enabled: 1, category: 1 });
TradingSymbolSchema.index({ category: 1, sortOrder: 1 });
TradingSymbolSchema.index({ popular: 1, enabled: 1 });

// Reason: Each symbol carries its full default config so the admin "Reset to Default"
// button can restore industry-correct values per pair. Spreads approximate typical
// retail broker conditions for a simulated trading platform.

export interface SymbolDefaults {
  name: string;
  pip: number;
  contractSize: number;
  category: "major" | "cross" | "exotic";
  popular: boolean;
  sortOrder: number;
  defaultSpread: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
  commission: number;
}

export const DEFAULT_FOREX_PAIRS: Record<string, SymbolDefaults> = {
  // ── Major Pairs ──────────────────────────────────────
  "EUR/USD":  { name: "Euro vs US Dollar",               pip: 0.0001, contractSize: 100000, category: "major", popular: true,  sortOrder: 1,  defaultSpread: 1.0,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/USD":  { name: "British Pound vs US Dollar",      pip: 0.0001, contractSize: 100000, category: "major", popular: true,  sortOrder: 2,  defaultSpread: 1.5,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "USD/JPY":  { name: "US Dollar vs Japanese Yen",       pip: 0.01,   contractSize: 100000, category: "major", popular: true,  sortOrder: 3,  defaultSpread: 1.0,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "USD/CHF":  { name: "US Dollar vs Swiss Franc",        pip: 0.0001, contractSize: 100000, category: "major", popular: false, sortOrder: 4,  defaultSpread: 1.5,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "AUD/USD":  { name: "Australian Dollar vs US Dollar",  pip: 0.0001, contractSize: 100000, category: "major", popular: true,  sortOrder: 5,  defaultSpread: 1.2,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "USD/CAD":  { name: "US Dollar vs Canadian Dollar",    pip: 0.0001, contractSize: 100000, category: "major", popular: false, sortOrder: 6,  defaultSpread: 1.5,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "NZD/USD":  { name: "New Zealand Dollar vs US Dollar", pip: 0.0001, contractSize: 100000, category: "major", popular: false, sortOrder: 7,  defaultSpread: 1.8,  minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },

  // ── Cross Pairs ──────────────────────────────────────
  "EUR/GBP":  { name: "Euro vs British Pound",                    pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 1,  defaultSpread: 1.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "EUR/JPY":  { name: "Euro vs Japanese Yen",                     pip: 0.01,   contractSize: 100000, category: "cross", popular: true,  sortOrder: 2,  defaultSpread: 1.8, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "EUR/CHF":  { name: "Euro vs Swiss Franc",                      pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 3,  defaultSpread: 2.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "EUR/AUD":  { name: "Euro vs Australian Dollar",                pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 4,  defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "EUR/CAD":  { name: "Euro vs Canadian Dollar",                  pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 5,  defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "EUR/NZD":  { name: "Euro vs New Zealand Dollar",               pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 6,  defaultSpread: 3.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/JPY":  { name: "British Pound vs Japanese Yen",            pip: 0.01,   contractSize: 100000, category: "cross", popular: true,  sortOrder: 7,  defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/CHF":  { name: "British Pound vs Swiss Franc",             pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 8,  defaultSpread: 3.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/AUD":  { name: "British Pound vs Australian Dollar",       pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 9,  defaultSpread: 3.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/CAD":  { name: "British Pound vs Canadian Dollar",         pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 10, defaultSpread: 3.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "GBP/NZD":  { name: "British Pound vs New Zealand Dollar",      pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 11, defaultSpread: 4.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "AUD/JPY":  { name: "Australian Dollar vs Japanese Yen",        pip: 0.01,   contractSize: 100000, category: "cross", popular: false, sortOrder: 12, defaultSpread: 2.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "AUD/CHF":  { name: "Australian Dollar vs Swiss Franc",         pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 13, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "AUD/CAD":  { name: "Australian Dollar vs Canadian Dollar",     pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 14, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "AUD/NZD":  { name: "Australian Dollar vs New Zealand Dollar",  pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 15, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "CAD/JPY":  { name: "Canadian Dollar vs Japanese Yen",          pip: 0.01,   contractSize: 100000, category: "cross", popular: false, sortOrder: 16, defaultSpread: 2.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "CAD/CHF":  { name: "Canadian Dollar vs Swiss Franc",           pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 17, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "CHF/JPY":  { name: "Swiss Franc vs Japanese Yen",              pip: 0.01,   contractSize: 100000, category: "cross", popular: false, sortOrder: 18, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "NZD/JPY":  { name: "New Zealand Dollar vs Japanese Yen",       pip: 0.01,   contractSize: 100000, category: "cross", popular: false, sortOrder: 19, defaultSpread: 2.5, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "NZD/CHF":  { name: "New Zealand Dollar vs Swiss Franc",        pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 20, defaultSpread: 3.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },
  "NZD/CAD":  { name: "New Zealand Dollar vs Canadian Dollar",    pip: 0.0001, contractSize: 100000, category: "cross", popular: false, sortOrder: 21, defaultSpread: 3.0, minLotSize: 0.01, maxLotSize: 100, lotStep: 0.01, commission: 0 },

  // ── Exotic Pairs ─────────────────────────────────────
  "USD/MXN":  { name: "US Dollar vs Mexican Peso",       pip: 0.0001, contractSize: 100000, category: "exotic", popular: false, sortOrder: 1, defaultSpread: 10.0, minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, commission: 0 },
  "USD/ZAR":  { name: "US Dollar vs South African Rand", pip: 0.0001, contractSize: 100000, category: "exotic", popular: false, sortOrder: 2, defaultSpread: 8.0,  minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, commission: 0 },
  "USD/TRY":  { name: "US Dollar vs Turkish Lira",       pip: 0.0001, contractSize: 100000, category: "exotic", popular: false, sortOrder: 3, defaultSpread: 15.0, minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, commission: 0 },
  "USD/SEK":  { name: "US Dollar vs Swedish Krona",      pip: 0.0001, contractSize: 100000, category: "exotic", popular: false, sortOrder: 4, defaultSpread: 8.0,  minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, commission: 0 },
  "USD/NOK":  { name: "US Dollar vs Norwegian Krone",    pip: 0.0001, contractSize: 100000, category: "exotic", popular: false, sortOrder: 5, defaultSpread: 8.0,  minLotSize: 0.01, maxLotSize: 50, lotStep: 0.01, commission: 0 },
};

const TradingSymbol =
  models?.TradingSymbol ||
  model<ITradingSymbol>("TradingSymbol", TradingSymbolSchema);

export default TradingSymbol;
