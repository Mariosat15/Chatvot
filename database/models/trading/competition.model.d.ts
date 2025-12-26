import { Document } from 'mongoose';
export interface ICompetition extends Document {
    name: string;
    description: string;
    slug: string;
    entryFee: number;
    startingCapital: number;
    minParticipants: number;
    maxParticipants: number;
    currentParticipants: number;
    startTime: Date;
    endTime: Date;
    registrationDeadline: Date;
    status: 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
    cancellationReason?: string;
    assetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
    allowedSymbols: string[];
    blockedSymbols: string[];
    leverage: {
        enabled: boolean;
        min: number;
        max: number;
        default: number;
    };
    competitionType: 'time_based' | 'goal_based' | 'hybrid';
    goalConfig?: {
        targetReturn: number;
        targetCapital: number;
    };
    prizePool: number;
    platformFeePercentage: number;
    prizeDistribution: {
        rank: number;
        percentage: number;
    }[];
    rules: {
        rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
        tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
        tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
        minimumTrades: number;
        minimumWinRate?: number;
        tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all';
        disqualifyOnLiquidation: boolean;
    };
    levelRequirement: {
        enabled: boolean;
        minLevel: number;
        maxLevel?: number;
    };
    maxPositionSize: number;
    maxOpenPositions: number;
    allowShortSelling: boolean;
    marginCallThreshold: number;
    riskLimits: {
        maxDrawdownPercent: number;
        dailyLossLimitPercent: number;
        equityDrawdownPercent: number;
        equityCheckEnabled: boolean;
        enabled: boolean;
    };
    winnerId?: string;
    winnerPnL?: number;
    finalLeaderboard?: {
        rank: number;
        userId: string;
        username: string;
        finalCapital: number;
        pnl: number;
        pnlPercentage: number;
        totalTrades: number;
        winRate: number;
        prizeAmount: number;
    }[];
    createdBy: string;
    imageUrl?: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
declare const Competition: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<ICompetition, {}, {}, {}, Document<unknown, {}, ICompetition, {}, {}> & ICompetition & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Competition;
