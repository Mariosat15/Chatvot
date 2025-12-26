"use strict";
'use server';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardXPForBadge = awardXPForBadge;
exports.getUserLevel = getUserLevel;
exports.recalculateUserLevel = recalculateUserLevel;
exports.getUsersWithTitles = getUsersWithTitles;
const mongoose_1 = require("@/database/mongoose");
const user_level_model_1 = __importDefault(require("@/database/models/user-level.model"));
const user_badge_model_1 = __importDefault(require("@/database/models/user-badge.model"));
const badge_config_model_1 = __importDefault(require("@/database/models/badge-config.model"));
const xp_config_service_1 = require("@/lib/services/xp-config.service");
/**
 * Award XP to user for earning a badge
 */
async function awardXPForBadge(userId, badgeId) {
    console.log(`💫 [XP AWARD] Starting XP award for user ${userId}, badge ${badgeId}`);
    await (0, mongoose_1.connectToDatabase)();
    // Find the badge to get rarity from database
    const badge = await badge_config_model_1.default.findOne({ id: badgeId, isActive: true }).lean();
    if (!badge) {
        console.error(`❌ [XP AWARD] Badge ${badgeId} not found in database`);
        throw new Error('Badge not found');
    }
    console.log(`🏅 [XP AWARD] Badge found: ${badge.name}, rarity: ${badge.rarity}`);
    const xpGained = await (0, xp_config_service_1.getXPForBadge)(badge.rarity);
    console.log(`⭐ [XP AWARD] XP to be gained: ${xpGained}`);
    // Get or create user level
    let userLevel = await user_level_model_1.default.findOne({ userId });
    if (!userLevel) {
        console.log(`📝 [XP AWARD] Creating new UserLevel document for user ${userId}`);
        userLevel = await user_level_model_1.default.create({
            userId,
            currentXP: 0,
            currentLevel: 1,
            currentTitle: 'Novice Trader',
            totalBadgesEarned: 0,
        });
        console.log(`✅ [XP AWARD] UserLevel created:`, userLevel._id);
    }
    else {
        console.log(`📊 [XP AWARD] Current user stats: XP=${userLevel.currentXP}, Level=${userLevel.currentLevel}, Badges=${userLevel.totalBadgesEarned}`);
    }
    const oldXP = userLevel.currentXP;
    const oldLevel = userLevel.currentLevel;
    const oldTitle = userLevel.currentTitle;
    // Add XP
    const newXP = oldXP + xpGained;
    console.log(`📈 [XP AWARD] XP progression: ${oldXP} → ${newXP} (+${xpGained})`);
    const newTitleLevel = await (0, xp_config_service_1.getTitleByXP)(newXP); // ✅ Fetch from database
    console.log(`👑 [XP AWARD] New title level: ${newTitleLevel.title} (Level ${newTitleLevel.level})`);
    const leveledUp = newTitleLevel.level > oldLevel;
    if (leveledUp) {
        console.log(`🎉 [XP AWARD] LEVEL UP! ${oldLevel} → ${newTitleLevel.level}`);
    }
    // Update user level with database values
    userLevel.currentXP = newXP;
    userLevel.currentLevel = newTitleLevel.level;
    userLevel.currentTitle = newTitleLevel.title; // ✅ From database
    userLevel.totalBadgesEarned += 1;
    userLevel.lastXPGain = new Date();
    // Add to XP history
    userLevel.xpHistory.push({
        amount: xpGained,
        source: 'badge',
        badgeId,
        timestamp: new Date(),
    });
    console.log(`📜 [XP AWARD] XP history updated (${userLevel.xpHistory.length} entries)`);
    const savedLevel = await userLevel.save();
    console.log(`💾 [XP AWARD] UserLevel saved successfully:`, savedLevel._id);
    console.log(`✅ [XP AWARD] Final state: XP=${savedLevel.currentXP}, Level=${savedLevel.currentLevel}, Title=${savedLevel.currentTitle}, Badges=${savedLevel.totalBadgesEarned}`);
    // Send level up notification if user leveled up
    if (leveledUp) {
        try {
            const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
            await notificationService.notifyLevelUp(userId, newTitleLevel.level, newTitleLevel.title);
            console.log(`🔔 [XP AWARD] Level up notification sent for level ${newTitleLevel.level}`);
        }
        catch (error) {
            console.error(`❌ [XP AWARD] Error sending level up notification:`, error);
        }
    }
    return {
        xpGained,
        newXP,
        newLevel: newTitleLevel.level,
        newTitle: newTitleLevel.title,
        leveledUp,
        oldLevel: leveledUp ? oldLevel : undefined,
        oldTitle: leveledUp ? oldTitle : undefined,
    };
}
/**
 * Get user's current level and XP
 * Always fetches title, icon, and description from database configuration
 */
async function getUserLevel(userId) {
    await (0, mongoose_1.connectToDatabase)();
    const userLevel = await user_level_model_1.default.findOne({ userId }).lean();
    if (!userLevel) {
        // Get default level from database
        const titleLevel = await (0, xp_config_service_1.getTitleByXP)(0);
        return {
            userId,
            currentXP: 0,
            currentLevel: 1,
            currentTitle: titleLevel.title,
            currentIcon: titleLevel.icon,
            currentDescription: titleLevel.description,
            currentColor: titleLevel.color,
            totalBadgesEarned: 0,
            lastXPGain: new Date(),
        };
    }
    // Get current level details from database configuration
    const titleLevel = await (0, xp_config_service_1.getTitleByXP)(userLevel.currentXP || 0);
    return {
        ...userLevel,
        currentTitle: titleLevel.title, // ✅ From database
        currentIcon: titleLevel.icon, // ✅ From database
        currentDescription: titleLevel.description, // ✅ From database
        currentColor: titleLevel.color, // ✅ From database
        currentLevel: titleLevel.level, // ✅ From database
    };
}
/**
 * Recalculate user level based on badges
 */
async function recalculateUserLevel(userId) {
    console.log(`🔄 [XP RECALC] Starting XP recalculation for user ${userId}`);
    await (0, mongoose_1.connectToDatabase)();
    // Get all user badges
    const userBadges = await user_badge_model_1.default.find({ userId }).lean();
    console.log(`🏅 [XP RECALC] Found ${userBadges.length} badges for user`);
    let totalXP = 0;
    // Calculate XP from all badges
    for (const userBadge of userBadges) {
        const badge = await badge_config_model_1.default.findOne({ id: userBadge.badgeId, isActive: true }).lean();
        if (badge) {
            const xpValue = await (0, xp_config_service_1.getXPForBadge)(badge.rarity); // ✅ Fetch from database
            totalXP += xpValue;
            console.log(`  ⭐ Badge: ${badge.name} (${badge.rarity}) = ${xpValue} XP`);
        }
        else {
            console.warn(`  ⚠️ Badge ${userBadge.badgeId} not found in database`);
        }
    }
    console.log(`📊 [XP RECALC] Total XP calculated: ${totalXP}`);
    const titleLevel = await (0, xp_config_service_1.getTitleByXP)(totalXP); // ✅ Fetch from database
    console.log(`👑 [XP RECALC] Title for ${totalXP} XP: ${titleLevel.title} (Level ${titleLevel.level})`);
    // Update or create user level
    const userLevel = await user_level_model_1.default.findOneAndUpdate({ userId }, {
        currentXP: totalXP,
        currentLevel: titleLevel.level,
        currentTitle: titleLevel.title, // ✅ From database
        totalBadgesEarned: userBadges.length,
    }, { upsert: true, new: true });
    console.log(`💾 [XP RECALC] UserLevel updated:`, {
        id: userLevel._id,
        currentXP: userLevel.currentXP,
        currentLevel: userLevel.currentLevel,
        currentTitle: userLevel.currentTitle,
        totalBadgesEarned: userLevel.totalBadgesEarned
    });
    return userLevel;
}
/**
 * Get leaderboard with titles
 */
async function getUsersWithTitles(userIds) {
    await (0, mongoose_1.connectToDatabase)();
    const userLevels = await user_level_model_1.default.find({
        userId: { $in: userIds },
    }).lean();
    const levelMap = new Map(userLevels.map(ul => [ul.userId, ul]));
    // Return map for easy lookup
    return levelMap;
}
//# sourceMappingURL=xp-level.service.js.map