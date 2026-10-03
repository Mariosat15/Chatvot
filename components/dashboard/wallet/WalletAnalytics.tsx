"use client";

import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import DesktopWalletAnalytics from "./DesktopWalletAnalytics";
import MobileWallet from "./mobile/MobileWallet";

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

/**
 * Wallet Analytics shell — desktop and mobile are separate trees.
 * Reason: owner rebuild guide (3 Oct 2026) — do not shrink the desktop page;
 * share data/API only. Each tree owns its own `useWalletAnalyticsModel` call
 * so unused layout work is not shared across breakpoints.
 */
export default function WalletAnalytics({ overview, charts }: Props) {
  return (
    <>
      <div className="hidden md:block">
        <DesktopWalletAnalytics overview={overview} charts={charts} />
      </div>
      <div className="block md:hidden">
        <MobileWallet overview={overview} charts={charts} />
      </div>
    </>
  );
}
