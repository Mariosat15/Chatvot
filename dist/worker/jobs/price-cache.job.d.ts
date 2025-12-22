/**
 * Price Cache Update Job
 *
 * Updates the price cache for all forex pairs.
 * Runs every minute (same as Inngest: update-price-cache)
 *
 * Note: This is a backup to real-time price updates.
 * The main app fetches prices on-demand, this ensures cache stays fresh.
 */
export interface PriceCacheResult {
    pairsUpdated: number;
    errors: string[];
}
export declare function runPriceCacheUpdate(): Promise<PriceCacheResult>;
export default runPriceCacheUpdate;
