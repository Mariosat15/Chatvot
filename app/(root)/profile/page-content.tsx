'use client';

import ProfileTabs from '@/components/profile/ProfileTabs';
import BadgesDisplay from '@/components/profile/BadgesDisplay';
import ProfileSettingsSection from '@/components/profile/ProfileSettingsSection';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import TradingArsenalSection from '@/components/profile/TradingArsenalSection';
import KYCVerification from '@/components/kyc/KYCVerification';
import { Badge } from '@/lib/constants/badges';

interface ProfilePageContentProps {
  overviewContent: React.ReactNode;
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
}

export default function ProfilePageContent({
  overviewContent,
  badges,
  badgeStats,
}: ProfilePageContentProps) {
  return (
    <ProfileTabs
      overviewContent={overviewContent}
      badgesContent={<BadgesDisplay badges={badges} stats={badgeStats as any} />}
      notificationsContent={<NotificationCenter />}
      arsenalContent={<TradingArsenalSection />}
      verificationContent={<KYCVerification />}
      settingsContent={<ProfileSettingsSection />}
    />
  );
}

