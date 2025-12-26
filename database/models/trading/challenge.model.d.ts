import { Document } from 'mongoose';
export interface IChallenge extends Document {
    slug: string;
    challengerId: string;
    challengerName: string;
    challengerEmail: string;
    challengedId: string;
    challengedName: string;
    challengedEmail: string;
    entryFee: number;
    startingCapital: number;
    prizePool: number;
    platformFeePercentage: number;
    platformFeeAmount: number;
    winnerPrize: number;
    createdAt: Date;
    acceptDeadline: Date;
    startTime?: Date;
    endTime?: Date;
    duration: number;
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'active' | 'completed' | 'cancelled';
    acceptedAt?: Date;
    declinedAt?: Date;
    assetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
    allowedSymbols: string[];
    blockedSymbols: string[];
    leverage: {
        enabled: boolean;
        min: number;
        max: number;
    };
    rules: {
        rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
        tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
        tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
        minimumTrades: number;
        disqualifyOnLiquidation: boolean;
    };
    maxPositionSize: number;
    maxOpenPositions: number;
    allowShortSelling: boolean;
    marginCallThreshold: number;
    winnerId?: string;
    winnerName?: string;
    winnerPnL?: number;
    loserId?: string;
    loserName?: string;
    loserPnL?: number;
    isTie?: boolean;
    challengerFinalStats?: {
        finalCapital: number;
        pnl: number;
        pnlPercentage: number;
        totalTrades: number;
        winRate: number;
        isDisqualified: boolean;
        disqualificationReason?: string;
    };
    challengedFinalStats?: {
        finalCapital: number;
        pnl: number;
        pnlPercentage: number;
        totalTrades: number;
        winRate: number;
        isDisqualified: boolean;
        disqualificationReason?: string;
    };
    updatedAt: Date;
}
declare const Challenge: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<IChallenge, {}, {}, {}, Document<unknown, {}, IChallenge, {}, {}> & IChallenge & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Challenge;
