import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth/auth';
import { getUserCompetitionStats, getUserChallengeStats } from '@/lib/actions/user/profile.actions';
import { getWalletStats } from '@/lib/actions/trading/wallet.actions';
import { getMyBadges, getMyBadgeStats } from '@/lib/actions/badges/user-badges.actions';
import { getMyLevel } from '@/lib/actions/user/level.actions';
import { getBadgeXPValues, getTitleLevels } from '@/lib/services/xp-config.service';
import ProfilePageContent from './page-content';
import XPProgressBar from '@/components/profile/XPProgressBar';
import ProfileContent from '@/components/profile/ProfileContent';

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const [competitionStats, challengeStats, walletData, badges, badgeStats, levelData, badgeXPValues, titleLevels] = await Promise.all([
    getUserCompetitionStats(),
    getUserChallengeStats(),
    getWalletStats(),
    getMyBadges(),
    getMyBadgeStats(),
    getMyLevel(),
    getBadgeXPValues(),
    getTitleLevels(),
  ]);

  const overviewContent = (
    <>
      <ProfileContent 
        session={session}
        competitionStats={competitionStats}
        challengeStats={challengeStats}
        walletData={walletData}
      />
      
      {/* XP Progress & Level */}
      <XPProgressBar
        currentXP={levelData.currentXP}
        currentLevel={levelData.currentLevel}
        currentTitle={levelData.currentTitle}
        currentIcon={levelData.currentIcon}
        currentDescription={levelData.currentDescription}
        currentColor={levelData.currentColor}
        totalBadgesEarned={levelData.totalBadgesEarned}
        badgeXPValues={badgeXPValues}
        titleLevels={titleLevels}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-800 to-dark-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <ProfilePageContent
          overviewContent={overviewContent}
          badges={badges as any}
          badgeStats={badgeStats}
        />
      </div>
    </div>
  );
}

