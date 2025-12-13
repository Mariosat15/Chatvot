'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { evaluateUserBadges, getUserBadges } from '@/lib/services/badge-evaluation.service';
import { BADGES, getBadgesByCategory, BadgeCategory } from '@/lib/constants/badges';

/**
 * Get all badges for the current user with earned status
 */
export async function getMyBadges() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const userId = session.user.id;
  return getUserBadges(userId);
}

/**
 * Get badge stats for current user
 */
export async function getMyBadgeStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

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
  const categoryCount: Record<BadgeCategory, number> = {
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
    categoryCount[badge.category]++;
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
export async function checkMyBadges() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;
  return evaluateUserBadges(userId);
}

