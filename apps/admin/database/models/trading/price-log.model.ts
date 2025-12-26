import mongoose, { Schema, Document } from 'mongoose';

/**
 * Price Log Model
 * 
 * Stores bid/ask/mid/spread snapshots at the time of trade execution.
 * Used for auditing and validating that trades were executed at correct prices.
 */

export interface IPriceLog extends Document {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: Date;
  
  // Optional reference to the trade that triggered this log
  tradeId?: string;
  orderId?: string;
  tradeType?: 'entry' | 'exit';
  tradeSide?: 'long' | 'short';
  
  // The actual execution price for comparison
  executionPrice?: number;
  expectedPrice?: number; // What we expected (ASK for buy, BID for sell)
  
  // Validation status
  priceMatchesExpected?: boolean;
  slippagePips?: number;
  
  // Source of the price data
  priceSource?: 'websocket' | 'rest' | 'cache';
}

const PriceLogSchema: Schema = new Schema(
  {
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    bid: {
      type: Number,
      required: true,
    },
    ask: {
      type: Number,
      required: true,
    },
    mid: {
      type: Number,
      required: true,
    },
    spread: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    
    // Trade reference
    tradeId: {
      type: String,
      index: true,
    },
    orderId: {
      type: String,
      index: true,
    },
    tradeType: {
      type: String,
      enum: ['entry', 'exit'],
    },
    tradeSide: {
      type: String,
      enum: ['long', 'short'],
    },
    
    // Execution details
    executionPrice: Number,
    expectedPrice: Number,
    priceMatchesExpected: Boolean,
    slippagePips: Number,
    
    // Price source
    priceSource: {
      type: String,
      enum: ['websocket', 'rest', 'cache'],
    },
  },
  {
    timestamps: true,
    collection: 'pricelogs',
  }
);

// Compound indexes for efficient querying
PriceLogSchema.index({ symbol: 1, timestamp: -1 });
PriceLogSchema.index({ tradeId: 1, tradeType: 1 });

// TTL index to auto-delete old logs after 30 days (optional)
// Uncomment if you want automatic cleanup:
// PriceLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const PriceLog = mongoose.models.PriceLog || mongoose.model<IPriceLog>('PriceLog', PriceLogSchema);

export default PriceLog;

