"use client";

import type { ReactNode } from "react";
import GameSuggestionsCard from "../GameSuggestionsCard";
import MobileWelcome from "./MobileWelcome";
import MobileBalanceCard from "./MobileBalanceCard";
import { MobileQuickActions, MobileQuickAccess } from "./MobileActions";
import { MobileGameCarousel, MobileFeaturedGames } from "./MobileGames";
import MobilePlayerProgress from "./MobilePlayerProgress";
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
 *
 * Upcoming competitions was removed 3 Oct 2026 — Suggested for You already
 * lists open contests for games the player plays.
 */
export default function MobileDashboard({
  gettingStarted,
}: {
  gettingStarted: ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[430px] space-y-5 overflow-x-clip px-1"
      // Reason: keep the last card clear of the iOS home indicator.
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
      <MobileCompeteCarousel />
      {/* Reason: open contests live here — not a second Upcoming strip. */}
      <GameSuggestionsCard />
      <MobileRecentActivity />
      <MobileStreakGrid />
    </div>
  );
}
