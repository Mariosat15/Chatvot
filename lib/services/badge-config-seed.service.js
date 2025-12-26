"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedBadgeConfigs = seedBadgeConfigs;
exports.seedXPConfigs = seedXPConfigs;
exports.resetBadgeAndXPConfigs = resetBadgeAndXPConfigs;
exports.getBadgesFromDB = getBadgesFromDB;
exports.getXPConfigFromDB = getXPConfigFromDB;
const badge_config_model_1 = __importDefault(require("@/database/models/badge-config.model"));
const xp_config_model_1 = __importDefault(require("@/database/models/xp-config.model"));
const badges_1 = require("@/lib/constants/badges");
const levels_1 = require("@/lib/constants/levels");
const mongoose_1 = require("@/database/mongoose");
/**
 * Seed default badge configurations to database
 */
async function seedBadgeConfigs() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        // Check if badges already exist
        const existingCount = await badge_config_model_1.default.countDocuments();
        if (existingCount === 0) {
            console.log('🌱 Seeding default badge configurations...');
            // Insert all default badges
            await badge_config_model_1.default.insertMany(badges_1.BADGES.map(badge => ({
                id: badge.id,
                name: badge.name,
                description: badge.description,
                category: badge.category,
                icon: badge.icon,
                rarity: badge.rarity,
                condition: badge.condition,
                isActive: true,
            })));
            console.log(`✅ Seeded ${badges_1.BADGES.length} default badges`);
        }
        else {
            console.log(`ℹ️ Badges already seeded (${existingCount} badges found)`);
        }
    }
    catch (error) {
        console.error('❌ Error seeding badge configs:', error);
        throw error;
    }
}
/**
 * Seed default XP configurations to database
 */
async function seedXPConfigs() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        // Check if XP configs already exist
        const existingBadgeXP = await xp_config_model_1.default.findOne({ configType: 'badge_xp' });
        const existingLevels = await xp_config_model_1.default.findOne({ configType: 'level_progression' });
        if (!existingBadgeXP) {
            console.log('🌱 Seeding default Badge XP values...');
            await xp_config_model_1.default.create({
                configType: 'badge_xp',
                data: levels_1.BADGE_XP_VALUES,
                isActive: true,
            });
            console.log('✅ Seeded Badge XP values');
        }
        else {
            console.log('ℹ️ Badge XP values already seeded');
        }
        if (!existingLevels) {
            console.log('🌱 Seeding default Level Progression...');
            console.log('Level data to seed:', levels_1.TITLE_LEVELS);
            await xp_config_model_1.default.create({
                configType: 'level_progression',
                data: { levels: levels_1.TITLE_LEVELS },
                isActive: true,
            });
            console.log('✅ Seeded Level Progression with', levels_1.TITLE_LEVELS.length, 'levels');
        }
        else {
            console.log('ℹ️ Level Progression already seeded');
        }
    }
    catch (error) {
        console.error('❌ Error seeding XP configs:', error);
        throw error;
    }
}
/**
 * Reset badge and XP configurations to defaults
 */
async function resetBadgeAndXPConfigs() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        console.log('🔄 Resetting badge and XP configurations to defaults...');
        // Delete all existing configs
        await badge_config_model_1.default.deleteMany({});
        await xp_config_model_1.default.deleteMany({});
        // Reseed defaults
        await seedBadgeConfigs();
        await seedXPConfigs();
        console.log('✅ Badge and XP configurations reset to defaults');
        return { success: true };
    }
    catch (error) {
        console.error('❌ Error resetting configs:', error);
        throw error;
    }
}
/**
 * Get all badges from database (fallback to constants if DB is empty)
 */
async function getBadgesFromDB() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        let badges = await badge_config_model_1.default.find({ isActive: true }).lean();
        // If no badges in DB, seed and return
        if (badges.length === 0) {
            await seedBadgeConfigs();
            badges = await badge_config_model_1.default.find({ isActive: true }).lean();
        }
        // Convert to plain objects, removing MongoDB-specific fields
        return badges.map(badge => ({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            category: badge.category,
            icon: badge.icon,
            rarity: badge.rarity,
            condition: badge.condition,
            isActive: badge.isActive,
        }));
    }
    catch (error) {
        console.error('Error fetching badges from DB, using constants:', error);
        return badges_1.BADGES;
    }
}
/**
 * Get XP configuration from database (fallback to constants if DB is empty)
 */
async function getXPConfigFromDB() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const badgeXP = await xp_config_model_1.default.findOne({ configType: 'badge_xp', isActive: true }).lean();
        const levels = await xp_config_model_1.default.findOne({ configType: 'level_progression', isActive: true }).lean();
        // If configs don't exist, seed them
        if (!badgeXP || !levels) {
            await seedXPConfigs();
            const newBadgeXP = await xp_config_model_1.default.findOne({ configType: 'badge_xp', isActive: true }).lean();
            const newLevels = await xp_config_model_1.default.findOne({ configType: 'level_progression', isActive: true }).lean();
            return {
                badgeXP: newBadgeXP?.data || levels_1.BADGE_XP_VALUES,
                levels: newLevels?.data?.levels || levels_1.TITLE_LEVELS,
            };
        }
        return {
            badgeXP: badgeXP.data,
            levels: levels.data.levels,
        };
    }
    catch (error) {
        console.error('Error fetching XP config from DB, using constants:', error);
        return {
            badgeXP: levels_1.BADGE_XP_VALUES,
            levels: levels_1.TITLE_LEVELS,
        };
    }
}
//# sourceMappingURL=badge-config-seed.service.js.map