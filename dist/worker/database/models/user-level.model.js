"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserLevelSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    currentXP: {
        type: Number,
        default: 0,
        min: 0,
    },
    currentLevel: {
        type: Number,
        default: 1,
        min: 1,
        max: 10,
    },
    currentTitle: {
        type: String,
        default: 'Novice Trader',
    },
    totalBadgesEarned: {
        type: Number,
        default: 0,
    },
    lastXPGain: {
        type: Date,
        default: Date.now,
    },
    xpHistory: [
        {
            amount: Number,
            source: String,
            badgeId: String,
            timestamp: {
                type: Date,
                default: Date.now,
            },
        },
    ],
}, {
    timestamps: true,
});
const UserLevel = (mongoose_1.models.UserLevel || (0, mongoose_1.model)('UserLevel', UserLevelSchema));
exports.default = UserLevel;
