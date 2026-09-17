"use server";

import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  evaluateUserBadges,
  getUserBadges,
} from "@/lib/services/badge-evaluation.service";
import { BadgeCategory } from "@/lib/constants/badges";

/**
 * Every category a badge may be filed under.
 *
 * Reason: typed `Record<BadgeCategory, true>` so the compiler names this file
 * when a category is added to the union — a plain array or Set would accept a
 * short list, and a missing member means those badges vanish from the tally
 * with every total still adding up. This is deliberately not
 * `BADGE_CATEGORY_IDS`, which is the admin picker's list and omits `Volume`.
 */
const BADGE_CATEGORY_PRESENCE: Record<BadgeCategory, true> = {
  Competition: true,
  Trading: true,
  Games: true,
  Profit: true,
  Risk: true,
  Speed: true,
  Consistency: true,
  Volume: true,
  Strategy: true,
  Social: true,
  Legendary: true,
};

const BADGE_CATEGORY_KEYS: ReadonlySet<BadgeCategory> = new Set(
  Object.keys(BADGE_CATEGORY_PRESENCE) as BadgeCategory[],
);

/**
 * Get all badges for the current user with earned status
 */
export async function getMyBadges() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  return getUserBadges(userId);
}

/**
 * Get badge stats for current user
 */
export async function getMyBadgeStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const badges = await getMyBadges();

  const earnedBadges = badges.filter((b) => b.earned);
  const totalBadges = badges.length;
  const earnedCount = earnedBadges.length;
  // Reason: after a gamification reset the catalogue can be empty, and 0/0 rendered
  // as "NaN%" on the profile badge card.
  const percentage = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  // Count by rarity
  const rarityCount = {
    common: earnedBadges.filter((b) => b.rarity === "common").length,
    rare: earnedBadges.filter((b) => b.rarity === "rare").length,
    epic: earnedBadges.filter((b) => b.rarity === "epic").length,
    legendary: earnedBadges.filter((b) => b.rarity === "legendary").length,
  };

  // Count by category
  // Reason: accumulated in a Map, not by indexing the record directly.
  // `badge.category` is a stored value, and both `in` and object indexing walk
  // the prototype chain — so `"toString"` passed the old `cat in categoryCount`
  // guard and incremented a key no caller reads, while a real category could
  // not be told apart from it. A Map has no prototype chain, so the guard is
  // total. The record is then built from literal keys, which is also what keeps
  // its shape checked by the compiler rather than assembled dynamically.
  //
  // The guard list is NOT built from `BADGE_CATEGORY_IDS`: that array drives the
  // admin picker and is missing `Volume`, so using it here would silently drop
  // every Volume badge from the tally while the totals still added up.
  const tally = new Map<BadgeCategory, number>();
  for (const badge of earnedBadges) {
    const cat = badge.category as BadgeCategory;
    if (!BADGE_CATEGORY_KEYS.has(cat)) continue;
    tally.set(cat, (tally.get(cat) ?? 0) + 1);
  }

  const categoryCount: Record<BadgeCategory, number> = {
    Competition: tally.get("Competition") ?? 0,
    Trading: tally.get("Trading") ?? 0,
    Games: tally.get("Games") ?? 0,
    Profit: tally.get("Profit") ?? 0,
    Risk: tally.get("Risk") ?? 0,
    Speed: tally.get("Speed") ?? 0,
    Consistency: tally.get("Consistency") ?? 0,
    Volume: tally.get("Volume") ?? 0,
    Strategy: tally.get("Strategy") ?? 0,
    Social: tally.get("Social") ?? 0,
    Legendary: tally.get("Legendary") ?? 0,
  };

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
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  return evaluateUserBadges(userId);
}
