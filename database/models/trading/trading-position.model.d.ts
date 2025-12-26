import { Document } from 'mongoose';
export interface ITradingPosition extends Document {
    competitionId: string;
    userId: string;
    participantId: string;
    symbol: string;
    side: 'long' | 'short';
    quantity: number;
    orderType: 'market' | 'limit';
    limitPrice?: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercentage: number;
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
    leverage: number;
    marginUsed: number;
    maintenanceMargin: number;
    status: 'open' | 'closed' | 'liquidated';
    closeReason?: 'user' | 'stop_loss' | 'take_profit' | 'margin_call' | 'competition_end' | 'challenge_end';
    openedAt: Date;
    closedAt?: Date;
    holdingTimeSeconds?: number;
    openOrderId: string;
    closeOrderId?: string;
    tradeHistoryId?: string;
    lastPriceUpdate: Date;
    priceUpdateCount: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const TradingPosition: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<ITradingPosition, {}, {}, {}, Document<unknown, {}, ITradingPosition, {}, {}> & ITradingPosition & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default TradingPosition;
