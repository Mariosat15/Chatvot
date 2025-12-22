import { Document } from 'mongoose';
/**
 * Position Event Model
 *
 * Stores real-time position events (TP/SL triggers, manual closes, etc.)
 * Used by SSE endpoint to push instant updates to clients
 *
 * TTL: Events auto-delete after 60 seconds (they're ephemeral notifications)
 */
export interface IPositionEvent extends Document {
    userId: string;
    competitionId: string;
    contestType: 'competition' | 'challenge';
    positionId: string;
    symbol: string;
    side: 'long' | 'short';
    eventType: 'closed' | 'opened' | 'modified';
    closeReason?: 'user' | 'stop_loss' | 'take_profit' | 'margin_call' | 'competition_end' | 'challenge_end';
    realizedPnl?: number;
    exitPrice?: number;
    createdAt: Date;
    deliveredTo: string[];
}
declare const PositionEvent: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default PositionEvent;
//# sourceMappingURL=position-event.model.d.ts.map