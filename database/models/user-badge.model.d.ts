import { Document } from 'mongoose';
export interface IUserBadge extends Document {
    userId: string;
    badgeId: string;
    earnedAt: Date;
    progress: number;
    metadata?: {
        competitionId?: string;
        tradeId?: string;
        value?: number;
        [key: string]: unknown;
    };
}
declare const UserBadge: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default UserBadge;
//# sourceMappingURL=user-badge.model.d.ts.map