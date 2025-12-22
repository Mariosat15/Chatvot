'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBadgeXPValues = getBadgeXPValues;
exports.getTitleLevels = getTitleLevels;
exports.getTitleByXP = getTitleByXP;
exports.getNextTitle = getNextTitle;
exports.calculateXPProgress = calculateXPProgress;
exports.getXPForBadge = getXPForBadge;
const mongoose_1 = require("@/database/mongoose");
const xp_config_model_1 = __importDefault(require("@/database/models/xp-config.model"));
const levels_1 = require("@/lib/constants/levels");
/**
 * Get Badge XP Values from database
 */
async function getBadgeXPValues() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const config = await xp_config_model_1.default.findOne({ configType: 'badge_xp', isActive: true }).lean();
        if (config && config.data) {
            return config.data;
        }
        // Fallback to constants
        return levels_1.BADGE_XP_VALUES;
    }
    catch (error) {
        console.error('Error fetching badge XP values, using defaults:', error);
        return levels_1.BADGE_XP_VALUES;
    }
}
/**
 * Get Level Progression from database
 */
async function getTitleLevels() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const config = await xp_config_model_1.default.findOne({ configType: 'level_progression', isActive: true }).lean();
        if (config && config.data && config.data.levels) {
            return config.data.levels;
        }
        // Fallback to constants
        return levels_1.TITLE_LEVELS;
    }
    catch (error) {
        console.error('Error fetching title levels, using defaults:', error);
        return levels_1.TITLE_LEVELS;
    }
}
/**
 * Get title level by XP amount (from database)
 */
async function getTitleByXP(xp) {
    const levels = await getTitleLevels();
    for (let i = levels.length - 1; i >= 0; i--) {
        if (xp >= levels[i].minXP) {
            return levels[i];
        }
    }
    return levels[0];
}
/**
 * Get next title level (from database)
 */
async function getNextTitle(currentLevel) {
    const levels = await getTitleLevels();
    if (currentLevel >= levels.length)
        return null;
    return levels[currentLevel]; // currentLevel is 1-based, array is 0-based
}
/**
 * Calculate XP progress to next level (from database)
 */
async function calculateXPProgress(currentXP) {
    const currentLevel = await getTitleByXP(currentXP);
    const nextLevel = await getNextTitle(currentLevel.level);
    if (!nextLevel) {
        return {
            currentLevel,
            nextLevel: null,
            progressPercent: 100,
            xpToNext: 0,
        };
    }
    const xpInCurrentLevel = currentXP - currentLevel.minXP;
    const xpNeededForNextLevel = nextLevel.minXP - currentLevel.minXP;
    const progressPercent = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
    const xpToNext = nextLevel.minXP - currentXP;
    return {
        currentLevel,
        nextLevel,
        progressPercent,
        xpToNext,
    };
}
/**
 * Get XP value for a badge rarity (from database)
 */
async function getXPForBadge(rarity) {
    const xpValues = await getBadgeXPValues();
    return xpValues[rarity];
}
