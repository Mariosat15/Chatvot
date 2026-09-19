"use client";

import { Suspense } from "react";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ModernProfileTabs from "@/components/profile/ModernProfileTabs";
import ProfileOverviewCharts from "@/components/profile/ProfileOverviewCharts";
import CrossGameStanding from "@/components/profile/CrossGameStanding";
import TradingPerformanceCard from "@/components/profile/TradingPerformanceCard";
import XPProgressBar from "@/components/profile/XPProgressBar";
import BadgesDisplay from "@/components/profile/BadgesDisplay";
import ProfileSettingsSection from "@/components/profile/ProfileSettingsSection";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import TradingArsenalSection from "@/components/profile/TradingArsenalSection";
import KYCVerification from "@/components/kyc/KYCVerification";
import JourneyMapTab from "@/components/profile/JourneyMapTab";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Badge } from "@/lib/constants/badges";
import type { PlayerGameProfile } from "@/lib/services/games/player-game-stats.service";

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
  gameProfile: PlayerGameProfile;
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
  gameProfile,
}: ModernProfilePageProps) {
  const { settings } = useAppSettings();
  const creditSymbol = settings?.credits?.symbol ?? "⚡";
  const creditDecimals = settings?.credits?.decimals ?? 0;
  const totalWinnings =
    (walletData?.totalWonFromCompetitions || 0) +
    (walletData?.totalWonFromChallenges || 0);

  const overviewContent = (
    <div className="space-y-6">
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

      <CrossGameStanding
        profile={gameProfile}
        totalWinnings={totalWinnings}
        creditSymbol={creditSymbol}
        creditDecimals={creditDecimals}
        level={levelData.currentLevel}
        xp={levelData.currentXP}
        title={levelData.currentTitle}
      />

      {/* Reason: Total Profit / trade metrics stay trading-scoped (Q13), never
          platform-wide — this card is that demotion, not a second rollup. */}
      <TradingPerformanceCard combinedStats={combinedStats} />

      <ProfileOverviewCharts
        combinedStats={combinedStats}
        competitionStats={competitionStats}
        challengeStats={challengeStats}
        walletData={walletData}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-800 via-dark-900 to-dark-900">
      <ProfileHeader
        session={session}
        levelData={levelData}
        combinedStats={combinedStats}
        competitionStats={competitionStats}
        challengeStats={challengeStats}
        walletData={walletData}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<TabsLoadingSkeleton />}>
          <ModernProfileTabs
            overviewContent={overviewContent}
            journeyContent={<JourneyMapTab userId={session.user.id} />}
            badgesContent={
              <BadgesDisplay
                badges={badges}
                stats={badgeStats as any}
                userLevel={levelData?.currentLevel || 1}
              />
            }
            notificationsContent={<NotificationCenter />}
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
      <div className="flex gap-2 overflow-x-auto">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-10 w-24 bg-slate-800/50 rounded-xl animate-pulse"
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="h-32 bg-slate-800/30 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-800/30 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
