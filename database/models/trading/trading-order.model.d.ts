import { Document } from 'mongoose';
export interface ITradingOrder extends Document {
    competitionId: string;
    userId: string;
    participantId: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    requestedPrice?: number;
    executedPrice?: number;
    slippage?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage: number;
    marginRequired: number;
    status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';
    filledQuantity: number;
    remainingQuantity: number;
    placedAt: Date;
    executedAt?: Date;
    expiresAt?: Date;
    rejectionReason?: string;
    positionId?: string;
    orderSource: 'web' | 'mobile' | 'api' | 'system';
    ipAddress?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const TradingOrder: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<ITradingOrder, {}, {}, {}, Document<unknown, {}, ITradingOrder, {}, {}> & ITradingOrder & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default TradingOrder;
