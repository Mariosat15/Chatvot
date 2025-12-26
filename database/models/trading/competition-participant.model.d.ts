import { Document } from 'mongoose';
export interface ICompetitionParticipant extends Document {
    competitionId: string;
    userId: string;
    username: string;
    email: string;
    startingCapital: number;
    currentCapital: number;
    availableCapital: number;
    usedMargin: number;
    pnl: number;
    pnlPercentage: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    currentOpenPositions: number;
    maxDrawdown: number;
    maxDrawdownPercentage: number;
    currentRank: number;
    highestRank: number;
    status: 'active' | 'liquidated' | 'completed' | 'disqualified' | 'refunded';
    liquidationReason?: string;
    disqualificationReason?: string;
    marginCallWarnings: number;
    lastMarginCallAt?: Date;
    enteredAt: Date;
    lastTradeAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const CompetitionParticipant: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<ICompetitionParticipant, {}, {}, {}, Document<unknown, {}, ICompetitionParticipant, {}, {}> & ICompetitionParticipant & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default CompetitionParticipant;
