"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserPresenceSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['online', 'away', 'offline'],
        default: 'offline',
    },
    lastSeen: {
        type: Date,
        required: true,
        default: Date.now,
    },
    lastHeartbeat: {
        type: Date,
        required: true,
        default: Date.now,
    },
    currentPage: {
        type: String,
    },
    isInCompetition: {
        type: Boolean,
        required: true,
        default: false,
    },
    activeCompetitionId: {
        type: String,
    },
    isInChallenge: {
        type: Boolean,
        required: true,
        default: false,
    },
    activeChallengeId: {
        type: String,
    },
    acceptingChallenges: {
        type: Boolean,
        required: true,
        default: true,
    },
    totalOnlineTime: {
        type: Number,
        required: true,
        default: 0,
    },
    sessionsToday: {
        type: Number,
        required: true,
        default: 0,
    },
    socketId: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    ipAddress: {
        type: String,
    },
}, {
    timestamps: true,
});
// Indexes
UserPresenceSchema.index({ status: 1 });
UserPresenceSchema.index({ lastHeartbeat: 1 });
UserPresenceSchema.index({ status: 1, acceptingChallenges: 1 });
// Compound index for finding online users with heartbeat threshold (excludes current user)
UserPresenceSchema.index({ status: 1, lastHeartbeat: -1, userId: 1 });
// Static method to update heartbeat and check for stale sessions
UserPresenceSchema.statics.updateHeartbeat = async function (userId, data) {
    const now = new Date();
    return this.findOneAndUpdate({ userId }, {
        $set: {
            lastHeartbeat: now,
            lastSeen: now,
            status: 'online',
            ...data,
        },
    }, { upsert: true, new: true });
};
// Static method to mark stale sessions as offline
UserPresenceSchema.statics.markStaleAsOffline = async function (staleThresholdMinutes = 2) {
    const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
    return this.updateMany({
        status: { $ne: 'offline' },
        lastHeartbeat: { $lt: threshold },
    }, {
        $set: { status: 'offline' },
    });
};
// Static method to get online users who accept challenges
UserPresenceSchema.statics.getChallengeable = async function () {
    const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes
    return this.find({
        status: 'online',
        acceptingChallenges: true,
        lastHeartbeat: { $gte: threshold },
    }).lean();
};
const UserPresence = mongoose_1.models?.UserPresence || (0, mongoose_1.model)('UserPresence', UserPresenceSchema);
exports.default = UserPresence;
//# sourceMappingURL=user-presence.model.js.map