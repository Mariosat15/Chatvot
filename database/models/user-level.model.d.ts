import { Document } from 'mongoose';
export interface IUserLevel extends Document {
    userId: string;
    currentXP: number;
    currentLevel: number;
    currentTitle: string;
    totalBadgesEarned: number;
    lastXPGain: Date;
    xpHistory: {
        amount: number;
        source: string;
        badgeId?: string;
        timestamp: Date;
    }[];
}
declare const UserLevel: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default UserLevel;
//# sourceMappingURL=user-level.model.d.ts.map