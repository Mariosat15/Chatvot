"use client";

import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import WalletAnalyticsHeader from "./WalletAnalyticsHeader";
import WalletBackdrop from "./WalletBackdrop";
import WalletKpiGrid from "./WalletKpiGrid";
import WalletBalanceTrend from "./WalletBalanceTrend";
import CreditBreakdownPanel from "./CreditBreakdownPanel";
import DailyCreditFlowPanel from "./DailyCreditFlowPanel";
import SpendingVsEarnings from "./SpendingVsEarnings";
import WalletInsights from "./WalletInsights";
import { useWalletAnalyticsModel } from "./useWalletAnalyticsModel";

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

/**
 * Desktop Wallet Analytics — md and up. Layout unchanged from the Oct rebuild.
 * Mobile uses a separate tree (`mobile/MobileWallet`).
 */
export default function DesktopWalletAnalytics({ overview, charts }: Props) {
  const model = useWalletAnalyticsModel(overview, charts);

  return (
    <WalletBackdrop>
      <WalletAnalyticsHeader rangeLabel={model.rangeLabel} />
      <WalletKpiGrid items={model.kpis} />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.1fr_1fr] xl:gap-4">
        <WalletBalanceTrend
          data={model.history}
          range={model.range}
          onRangeChange={model.setRange}
        />
        <CreditBreakdownPanel
          data={model.breakdownDays}
          totals={model.breakdownTotals}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.1fr_1fr] xl:gap-4">
        <DailyCreditFlowPanel
          data={model.flow}
          range={model.range}
          onRangeChange={model.setRange}
        />
        <SpendingVsEarnings slices={model.spendSlices} />
      </div>

      <WalletInsights items={model.insights} />
    </WalletBackdrop>
  );
}
