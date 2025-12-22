"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserBadgeSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    badgeId: {
        type: String,
        required: true,
        index: true,
    },
    earnedAt: {
        type: Date,
        default: Date.now,
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});
// Compound index for userId + badgeId to prevent duplicates
UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
const UserBadge = (mongoose_1.models.UserBadge || (0, mongoose_1.model)('UserBadge', UserBadgeSchema));
exports.default = UserBadge;
