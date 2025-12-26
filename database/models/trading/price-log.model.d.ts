import mongoose, { Document } from 'mongoose';
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
    tradeId?: string;
    orderId?: string;
    tradeType?: 'entry' | 'exit';
    tradeSide?: 'long' | 'short';
    executionPrice?: number;
    expectedPrice?: number;
    priceMatchesExpected?: boolean;
    slippagePips?: number;
    priceSource?: 'websocket' | 'rest' | 'cache';
}
declare const PriceLog: mongoose.Model<any, {}, {}, {}, any, any>;
export default PriceLog;
//# sourceMappingURL=price-log.model.d.ts.map