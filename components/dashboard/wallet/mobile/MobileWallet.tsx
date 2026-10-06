"use client";

import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { useWalletAnalyticsModel } from "../useWalletAnalyticsModel";
import MobileWalletHeader from "./MobileWalletHeader";
import MobileWalletBalanceCard from "./MobileWalletBalanceCard";
import MobileWalletActions from "./MobileWalletActions";
import MobileWalletOverview from "./MobileWalletOverview";
import MobileWalletTrend from "./MobileWalletTrend";
import MobileMoneyInOut from "./MobileMoneyInOut";
import SpendingVsEarnings from "../SpendingVsEarnings";
import MobileDailyFlow from "./MobileDailyFlow";
import MobileWalletInsights from "./MobileWalletInsights";
import MobileRecentTransactions from "./MobileRecentTransactions";

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

/**
 * Dedicated mobile Wallet Analytics (below md).
 * Order from rebuild guide §3 — desktop layout is a separate tree.
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
      <MobileMoneyInOut
        totals={model.breakdownTotals}
        moneyIn={model.moneyIn}
        moneyOut={model.moneyOut}
      />
      <SpendingVsEarnings slices={model.spendSlices} />
      <MobileDailyFlow data={model.flow} />
      <MobileWalletInsights items={model.insights} />
      <MobileRecentTransactions />
    </div>
  );
}
