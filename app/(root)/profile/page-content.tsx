'use client';

import ProfileTabs from '@/components/profile/ProfileTabs';
import BadgesDisplay from '@/components/profile/BadgesDisplay';
import ProfileSettingsSection from '@/components/profile/ProfileSettingsSection';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import TradingArsenalSection from '@/components/profile/TradingArsenalSection';
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
      notificationsContent={<NotificationSettings />}
      arsenalContent={<TradingArsenalSection />}
      settingsContent={<ProfileSettingsSection />}
    />
  );
}

