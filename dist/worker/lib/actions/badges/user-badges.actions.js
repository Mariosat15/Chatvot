'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyBadges = getMyBadges;
exports.getMyBadgeStats = getMyBadgeStats;
exports.checkMyBadges = checkMyBadges;
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const badge_evaluation_service_1 = require("@/lib/services/badge-evaluation.service");
/**
 * Get all badges for the current user with earned status
 */
async function getMyBadges() {
    const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
    if (!session?.user)
        (0, navigation_1.redirect)('/sign-in');
    const userId = session.user.id;
    return (0, badge_evaluation_service_1.getUserBadges)(userId);
}
/**
 * Get badge stats for current user
 */
async function getMyBadgeStats() {
    const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
    if (!session?.user)
        (0, navigation_1.redirect)('/sign-in');
    const badges = await getMyBadges();
    const earnedBadges = badges.filter(b => b.earned);
    const totalBadges = badges.length;
    const earnedCount = earnedBadges.length;
    const percentage = (earnedCount / totalBadges) * 100;
    // Count by rarity
    const rarityCount = {
        common: earnedBadges.filter(b => b.rarity === 'common').length,
        rare: earnedBadges.filter(b => b.rarity === 'rare').length,
        epic: earnedBadges.filter(b => b.rarity === 'epic').length,
        legendary: earnedBadges.filter(b => b.rarity === 'legendary').length,
    };
    // Count by category
    const categoryCount = {
        Competition: 0,
        Trading: 0,
        Profit: 0,
        Risk: 0,
        Speed: 0,
        Consistency: 0,
        Volume: 0,
        Strategy: 0,
        Social: 0,
        Legendary: 0,
    };
    for (const badge of earnedBadges) {
        const cat = badge.category;
        if (cat in categoryCount) {
            categoryCount[cat]++;
        }
    }
    return {
        totalBadges,
        earnedCount,
        percentage,
        rarityCount,
        categoryCount,
    };
}
/**
 * Manually trigger badge evaluation for current user
 */
async function checkMyBadges() {
    const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
    if (!session?.user) {
        throw new Error('Unauthorized');
    }
    const userId = session.user.id;
    return (0, badge_evaluation_service_1.evaluateUserBadges)(userId);
}
