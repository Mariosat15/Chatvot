import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth/auth';
import { getUserCompetitionStats, getUserChallengeStats, getCombinedTradingStats } from '@/lib/actions/user/profile.actions';
import { getWalletStats } from '@/lib/actions/trading/wallet.actions';
import { getMyBadges, getMyBadgeStats } from '@/lib/actions/badges/user-badges.actions';
import { getMyLevel } from '@/lib/actions/user/level.actions';
import { getBadgeXPValues, getTitleLevels } from '@/lib/services/xp-config.service';
import ModernProfilePage from './ModernProfilePage';

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const [
    competitionStats, 
    challengeStats, 
    walletData, 
    badges, 
    badgeStats, 
    levelData, 
    badgeXPValues, 
    titleLevels, 
    combinedStats
  ] = await Promise.all([
    getUserCompetitionStats(),
    getUserChallengeStats(),
    getWalletStats(),
    getMyBadges(),
    getMyBadgeStats(),
    getMyLevel(),
    getBadgeXPValues(),
    getTitleLevels(),
    getCombinedTradingStats(),
  ]);

  return (
    <ModernProfilePage
      session={session}
      competitionStats={competitionStats}
      challengeStats={challengeStats}
      walletData={walletData}
      badges={badges}
      badgeStats={badgeStats}
      levelData={levelData}
      badgeXPValues={badgeXPValues}
      titleLevels={titleLevels}
      combinedStats={combinedStats}
    />
  );
}
