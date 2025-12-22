'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyLevel = getMyLevel;
exports.getUserLevelData = getUserLevelData;
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const xp_level_service_1 = require("@/lib/services/xp-level.service");
/**
 * Get current user's level and XP
 */
async function getMyLevel() {
    const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
    if (!session?.user)
        (0, navigation_1.redirect)('/sign-in');
    const userId = session.user.id;
    const levelData = await (0, xp_level_service_1.getUserLevel)(userId);
    return JSON.parse(JSON.stringify(levelData));
}
/**
 * Get any user's level (for leaderboard display)
 */
async function getUserLevelData(userId) {
    const levelData = await (0, xp_level_service_1.getUserLevel)(userId);
    return JSON.parse(JSON.stringify(levelData));
}
