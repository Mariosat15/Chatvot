"use client";

import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { useWalletAnalyticsModel } from "../useWalletAnalyticsModel";
import CreditBreakdownPanel from "../CreditBreakdownPanel";
import SpendingVsEarnings from "../SpendingVsEarnings";
import MobileWalletHeader from "./MobileWalletHeader";
import MobileWalletBalanceCard from "./MobileWalletBalanceCard";
import MobileWalletActions from "./MobileWalletActions";
import MobileWalletOverview from "./MobileWalletOverview";
import MobileWalletTrend from "./MobileWalletTrend";
import MobileWalletInsights from "./MobileWalletInsights";
import MobileRecentTransactions from "./MobileRecentTransactions";

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

/**
 * Dedicated mobile Wallet Analytics (below md).
 * Reason: Credit Breakdown + Spending vs Earnings use the same panels as
 * desktop (6 Oct 2026) so the stacked area and donut padding stay in sync.
 */
export default function MobileWallet({ overview, charts }: Props) {
  const model = useWalletAnalyticsModel(overview, charts);
  const netInsight = model.insights.find((i) => i.key === "net");
  const balanceSpark =
    model.kpis.find((k) => k.key === "balance")?.spark ??
    model.history.map((h) => h.balance).slice(-14);

  return (
    <div
      className="mx-auto w-full max-w-[430px] space-y-5 px-1"
      // Reason: clear the home indicator / bottom chrome on phones.
      style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <MobileWalletHeader rangeLabel={model.rangeLabel} />
      <MobileWalletBalanceCard
        balance={model.overview.creditBalance}
        periodAmount={model.periodChange.amount}
        periodPct={model.periodChange.pct}
        spark={balanceSpark}
      />
      <MobileWalletActions />
      <MobileWalletOverview kpis={model.kpis} netInsight={netInsight} />
      <MobileWalletTrend
        data={model.history}
        range={model.range}
        onRangeChange={model.setRange}
      />
      <CreditBreakdownPanel
        data={model.breakdownDays}
        totals={model.breakdownTotals}
        categories={model.categories}
      />
      <SpendingVsEarnings
        spendSlices={model.spendSlices}
        earnSlices={model.earnSlices}
      />
      {/* Reason: owner 6 Oct 2026 — Daily Credit Flow is desktop-only. */}
      <MobileWalletInsights items={model.insights} />
      <MobileRecentTransactions />
    </div>
  );
}
