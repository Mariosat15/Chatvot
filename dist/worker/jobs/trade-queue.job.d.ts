/**
 * Trade Queue Processor Job
 *
 * Processes pending limit orders and checks for TP/SL triggers.
 * Runs every minute (same as Inngest: process-trade-queue)
 *
 * 📦 IMPORTANT: Worker reads prices from MongoDB cache (written by WEB app)
 * This allows a single WebSocket connection in WEB while Worker still gets prices!
 */
export interface TradeQueueResult {
    pendingOrdersChecked: number;
    ordersExecuted: number;
    positionsChecked: number;
    tpSlTriggered: number;
    errors: string[];
}
export declare function runTradeQueueProcessor(): Promise<TradeQueueResult>;
export default runTradeQueueProcessor;
