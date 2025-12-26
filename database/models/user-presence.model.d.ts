import { Document } from 'mongoose';
export interface IUserPresence extends Document {
    userId: string;
    username: string;
    status: 'online' | 'away' | 'offline';
    lastSeen: Date;
    lastHeartbeat: Date;
    currentPage?: string;
    isInCompetition: boolean;
    activeCompetitionId?: string;
    isInChallenge: boolean;
    activeChallengeId?: string;
    acceptingChallenges: boolean;
    totalOnlineTime: number;
    sessionsToday: number;
    socketId?: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const UserPresence: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default UserPresence;
//# sourceMappingURL=user-presence.model.d.ts.map