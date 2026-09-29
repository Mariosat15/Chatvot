"use client";

import type { ReactNode } from "react";
import MobileWelcome from "./MobileWelcome";
import MobileBalanceCard from "./MobileBalanceCard";
import { MobileQuickActions, MobileQuickAccess } from "./MobileActions";
import { MobileGameCarousel, MobileFeaturedGames } from "./MobileGames";
import MobilePlayerProgress from "./MobilePlayerProgress";
import MobileUpcomingCompetitions from "./MobileUpcomingCompetitions";
import MobileCompeteCarousel from "./MobileCompeteCarousel";
import { MobileRecentActivity, MobileStreakGrid } from "./MobileActivityStreaks";

/**
 * Phone Overview (below md) — owner "Mobile Dashboard" spec, 29 Sep 2026.
 *
 * Reason: a separate tree rather than a responsive desktop. The hierarchy is
 * Wallet -> Actions -> Games -> Progress -> Competition because those are the
 * actions that matter on a phone; the desktop order is left untouched.
 * Every section reads `useDashboardOverview()` — the same payload the
 * desktop tree reads — so the two can never show different numbers.
 */
export default function MobileDashboard({
  gettingStarted,
}: {
  gettingStarted: ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[430px] space-y-5"
      // Reason: the root layout already clears the ~72px bottom nav (pb-20 + h-16);
      // the nav also grows by the iOS home indicator, so add that inset here.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <MobileWelcome />
      <MobileBalanceCard />
      <MobileQuickActions />
      <MobileQuickAccess />
      {gettingStarted}
      <MobileGameCarousel />
      <MobilePlayerProgress />
      <MobileFeaturedGames />
      <MobileUpcomingCompetitions />
      <MobileCompeteCarousel />
      <MobileRecentActivity />
      <MobileStreakGrid />
    </div>
  );
}
