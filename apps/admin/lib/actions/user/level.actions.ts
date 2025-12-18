'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserLevel } from '@/lib/services/xp-level.service';

/**
 * Get current user's level and XP
 */
export async function getMyLevel() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const userId = session.user.id;
  const levelData = await getUserLevel(userId);

  return JSON.parse(JSON.stringify(levelData));
}

/**
 * Get any user's level (for leaderboard display)
 */
export async function getUserLevelData(userId: string) {
  const levelData = await getUserLevel(userId);
  return JSON.parse(JSON.stringify(levelData));
}

