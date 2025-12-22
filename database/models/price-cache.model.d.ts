import { Document, Model } from 'mongoose';
/**
 * Price Cache Model
 *
 * Stores latest forex prices from WebSocket for sharing between WEB and WORKER.
 * WEB writes prices here, WORKER reads them for TP/SL checks.
 *
 * Architecture:
 * - Single WebSocket connection in WEB app
 * - Prices written to MongoDB on each update
 * - Worker reads prices from here (no separate WebSocket needed)
 * - TTL index auto-removes stale prices (older than 5 minutes)
 */
export interface IPriceCache extends Document {
    symbol: string;
    bid: number;
    ask: number;
    spread: number;
    timestamp: number;
    updatedAt: Date;
}
interface IPriceCacheModel extends Model<IPriceCache> {
    updatePrice(symbol: string, bid: number, ask: number, timestamp: number): Promise<void>;
    getPrice(symbol: string): Promise<{
        bid: number;
        ask: number;
        spread: number;
        timestamp: number;
    } | null>;
    getAllPrices(): Promise<Map<string, {
        bid: number;
        ask: number;
        spread: number;
        timestamp: number;
    }>>;
    bulkUpdatePrices(prices: Array<{
        symbol: string;
        bid: number;
        ask: number;
        timestamp: number;
    }>): Promise<void>;
}
declare const PriceCache: IPriceCacheModel;
export default PriceCache;
