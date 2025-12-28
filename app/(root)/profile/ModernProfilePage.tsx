'use client';

import { Suspense } from 'react';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ModernProfileTabs from '@/components/profile/ModernProfileTabs';
import ProfileOverview from '@/components/profile/ProfileOverview';
import XPProgressBar from '@/components/profile/XPProgressBar';
import BadgesDisplay from '@/components/profile/BadgesDisplay';
import ProfileSettingsSection from '@/components/profile/ProfileSettingsSection';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import TradingArsenalSection from '@/components/profile/TradingArsenalSection';
import KYCVerification from '@/components/kyc/KYCVerification';
import { Badge } from '@/lib/constants/badges';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ModernProfilePageProps {
  session: any;
  competitionStats: any;
  challengeStats: any;
  walletData: any;
  badges: (Badge & { earned: boolean; earnedAt?: Date })[];
  badgeStats: {
    totalBadges: number;
    earnedCount: number;
    percentage: number;
    rarityCount: {
      common: number;
      rare: number;
      epic: number;
      legendary: number;
    };
    categoryCount: Record<string, number>;
  };
  levelData: {
    currentXP: number;
    currentLevel: number;
    currentTitle: string;
    currentIcon: string;
    currentDescription: string;
    currentColor: string;
    totalBadgesEarned: number;
  };
  badgeXPValues: any;
  titleLevels: any;
  combinedStats: any;
}

export default function ModernProfilePage({
  session,
  competitionStats,
  challengeStats,
  walletData,
  badges,
  badgeStats,
  levelData,
  badgeXPValues,
  titleLevels,
  combinedStats,
}: ModernProfilePageProps) {
  // Create overview content with the new components
  const overviewContent = (
    <div className="space-y-6">
      {/* XP Progress Bar */}
      <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/50">
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
      </div>

      {/* Stats Overview */}
      <ProfileOverview
        combinedStats={combinedStats}
        competitionStats={competitionStats}
        challengeStats={challengeStats}
        walletData={walletData}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header Section */}
      <ProfileHeader
        session={session}
        levelData={levelData}
        combinedStats={combinedStats}
        competitionStats={competitionStats}
        challengeStats={challengeStats}
        walletData={walletData}
      />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<TabsLoadingSkeleton />}>
          <ModernProfileTabs
            overviewContent={overviewContent}
            badgesContent={<BadgesDisplay badges={badges} stats={badgeStats as any} />}
            notificationsContent={<NotificationSettings />}
            arsenalContent={<TradingArsenalSection />}
            verificationContent={<KYCVerification />}
            settingsContent={<ProfileSettingsSection />}
          />
        </Suspense>
      </div>
    </div>
  );
}

function TabsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs skeleton */}
      <div className="flex gap-2 overflow-x-auto">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 w-24 bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-32 bg-slate-800/30 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800/30 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

