import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS } from "@/lib/constants";
import {
  WALLET_ART,
  allWalletAssets,
} from "@/lib/services/games/wallet-assets";

/**
 * Wallet Analytics — desktop dashboard `?tab=wallet`.
 * Rebuild (owner guide): structure + Header rename + global range.
 */

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("Wallet Analytics assets", () => {
  it("every mapped wallet asset exists on disk", () => {
    for (const src of allWalletAssets()) {
      const disk = join(ROOT, "public", ...src.replace(/^\//, "").split("/"));
      expect(existsSync(disk), `missing ${src}`).toBe(true);
    }
  });

  it("keeps neon wallet art inventory for backdrop / optional chips", () => {
    expect(WALLET_ART.backdrop).toContain("hero-backdrop");
    expect(WALLET_ART.header).toContain("icon");
    expect(allWalletAssets().length).toBeGreaterThanOrEqual(10);
  });
});

describe("Wallet Analytics Header label", () => {
  it('renames the dashboard tab to "Wallet Analytics" without changing the tab id', () => {
    const wallet = NAV_ITEMS.find((i) => i.tab === "wallet");
    expect(wallet?.label).toBe("Wallet Analytics");
    expect(wallet?.href).toBe("/dashboard?tab=wallet");
    expect(NAV_ITEMS.some((i) => i.label === "Wallet")).toBe(false);
  });
});

describe("Wallet Analytics page wiring", () => {
  it("DashboardLayout mounts WalletAnalytics on the wallet tab and drops HeroStatsBar there", () => {
    const layout = readCode("components/dashboard/DashboardLayout.tsx");
    expect(layout).toMatch(/WalletAnalytics/);
    expect(layout).toMatch(/value=["']wallet["']/);

    const walletBlockStart = layout.indexOf('value="wallet"');
    expect(walletBlockStart).toBeGreaterThan(-1);
    const nextTab = layout.indexOf("TabsContent", walletBlockStart + 1);
    const walletBlock = layout.slice(
      walletBlockStart,
      nextTab > 0 ? nextTab : undefined,
    );
    expect(walletBlock).toMatch(/<WalletAnalytics\b/);
    expect(walletBlock).not.toMatch(/HeroStatsBar/);
    expect(walletBlock).not.toMatch(/EquityChart/);
    expect(layout).not.toMatch(/from ["']\.\/HeroStatsBar["']/);
  });

  it("shell splits desktop and mobile trees without shrinking desktop into a phone", () => {
    const shell = readCode("components/dashboard/wallet/WalletAnalytics.tsx");
    expect(shell).toMatch(/hidden md:block/);
    expect(shell).toMatch(/block md:hidden/);
    expect(shell).toMatch(/DesktopWalletAnalytics/);
    expect(shell).toMatch(/MobileWallet/);
    expect(shell).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);
  });

  it("composes the reference sections in order without enumerating game codes", () => {
    // Reason: desktop layout moved to DesktopWalletAnalytics; math lives in the model.
    const page = readCode(
      "components/dashboard/wallet/DesktopWalletAnalytics.tsx",
    );
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    expect(page).toMatch(/WalletBackdrop/);
    expect(page).toMatch(/WalletAnalyticsHeader/);
    expect(page).toMatch(/WalletKpiGrid/);
    expect(page).toMatch(/WalletBalanceTrend/);
    expect(page).toMatch(/CreditBreakdownPanel/);
    expect(page).toMatch(/DailyCreditFlowPanel/);
    expect(page).toMatch(/SpendingVsEarnings/);
    expect(page).toMatch(/WalletInsights/);
    // Reason: one global period — not independent chip state per panel.
    expect(model).toMatch(/useState<WalletRange>\("30d"\)/);
    expect(page).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);

    // Order in the return tree (imports would reverse Backdrop vs Header).
    const ret = page.slice(page.lastIndexOf("return ("));
    const idx = (s: string) => ret.indexOf(s);
    expect(idx("<WalletBackdrop")).toBeLessThan(idx("<WalletAnalyticsHeader"));
    expect(idx("<WalletAnalyticsHeader")).toBeLessThan(idx("<WalletKpiGrid"));
    expect(idx("<WalletKpiGrid")).toBeLessThan(idx("<WalletBalanceTrend"));
    expect(idx("<WalletBalanceTrend")).toBeLessThan(idx("<CreditBreakdownPanel"));
    expect(idx("<DailyCreditFlowPanel")).toBeLessThan(idx("<SpendingVsEarnings"));
    expect(idx("<SpendingVsEarnings")).toBeLessThan(idx("<WalletInsights"));
  });

  it("insights strip links to /wallet and renders catalog-driven items", () => {
    const insights = readCode("components/dashboard/wallet/WalletInsights.tsx");
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    const catalog = readCode(
      "components/dashboard/wallet/wallet-categories.ts",
    );
    expect(insights).toMatch(/View All Transactions/);
    const hrefIdx = insights.lastIndexOf(
      "href=",
      insights.indexOf("View All Transactions"),
    );
    expect(insights.slice(hrefIdx, insights.indexOf("View All Transactions"))).toMatch(
      /href=["']\/wallet["']/,
    );
    // Reason: flipped 6 Oct 2026 (agnostic) — keys live in the catalog; the strip
    // only renders item.label / item.color. Net Movement stays on the model.
    expect(catalog).toMatch(/label:\s*"Deposits"/);
    expect(catalog).toMatch(/label:\s*"Prizes Won"/);
    expect(catalog).toMatch(/label:\s*"Gift Credits"/);
    expect(catalog).not.toMatch(/label:\s*"Bonuses"/);
    expect(model).toMatch(/label:\s*"Net Movement"/);
    expect(model).toMatch(/resolveCategories/);
    expect(insights).toMatch(/item\.color/);
    // Reason: flipped 6 Oct 2026 — auto-fill left empty tracks; equal 1fr columns fill the row.
    expect(insights).toMatch(/repeat\(\$\{cols\}, minmax\(0, 1fr\)\)/);
    expect(insights).not.toMatch(/auto-fill/);
  });

  it("Wallet Balance Trend chart grows to fill the card instead of leaving a dead band", () => {
    const trend = readCode(
      "components/dashboard/wallet/WalletBalanceTrend.tsx",
    );
    const mobile = readCode(
      "components/dashboard/wallet/mobile/MobileWalletTrend.tsx",
    );
    expect(trend).toMatch(/flex-1/);
    expect(trend).toMatch(/min-h-\[200px\]/);
    expect(trend).not.toMatch(/h-\[240px\]|h-\[260px\]/);
    expect(mobile).toMatch(/h-\[200px\]/);
    expect(mobile).not.toMatch(/h-\[260px\]/);
  });

  it("KPI / insights / header use neon WALLET_ART tiles like Overview — not Lucide chips", () => {
    // Reason: owner Oct 2026 — Wallet Analytics looked plain vs Overview; Lucide
    // chips were the gap. Flipped from the Lucide assertion, not deleted.
    const kpi = readCode("components/dashboard/wallet/WalletKpiGrid.tsx");
    const insights = readCode("components/dashboard/wallet/WalletInsights.tsx");
    const header = readCode(
      "components/dashboard/wallet/WalletAnalyticsHeader.tsx",
    );
    const backdrop = readCode("components/dashboard/wallet/WalletBackdrop.tsx");
    const neon = readCode("components/dashboard/wallet/WalletNeonIcon.tsx");
    const assets = readCode("lib/services/games/wallet-assets.ts");
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    const trend = readCode(
      "components/dashboard/wallet/WalletBalanceTrend.tsx",
    );
    const breakdown = readCode(
      "components/dashboard/wallet/CreditBreakdownPanel.tsx",
    );
    const flow = readCode(
      "components/dashboard/wallet/DailyCreditFlowPanel.tsx",
    );
    const spending = readCode(
      "components/dashboard/wallet/SpendingVsEarnings.tsx",
    );
    expect(kpi).toMatch(/WALLET_ART/);
    expect(kpi).toMatch(/WalletNeonIcon/);
    expect(kpi).toMatch(/object-contain/);
    expect(kpi).not.toMatch(/from ["']lucide-react["']/);
    expect(insights).toMatch(/WALLET_ART/);
    expect(insights).toMatch(/WalletNeonIcon/);
    expect(insights).not.toMatch(/from ["']lucide-react["']/);
    expect(header).toMatch(/WALLET_ART\.header/);
    expect(header).toMatch(/WalletNeonIcon/);
    expect(backdrop).toMatch(/WALLET_ART\.backdrop/);
    expect(backdrop).toMatch(/object-cover/);
    // Reason: flipped 5 Oct 2026 — the Menuitems set is transparent, so no
    // screen blend and still no fill behind the plate.
    expect(neon).not.toMatch(/mix-blend-screen/);
    expect(neon).toMatch(/bg-transparent/);
    for (const slug of [
      "wallet-blue",
      "deposit",
      "withdrawal",
      "games-orange",
      "trophy-purple",
      "credits",
      "chart-bars-red",
      "purchases",
      "gift",
      "chart-growth-orange",
    ]) {
      expect(assets).toContain(`NEON_ICON("${slug}")`);
    }
    expect(assets).not.toMatch(/icon-[a-z0-9-]+\.jpg/);
    expect(trend).toMatch(/WALLET_ART\.trend/);
    expect(breakdown).toMatch(/WALLET_ART\.breakdown/);
    expect(flow).toMatch(/WALLET_ART\.dailyFlow/);
    expect(spending).toMatch(/WALLET_ART\.spending/);
    expect(model).toMatch(/label:\s*"Credit Balance"/);
    expect(model).toMatch(/label:\s*"Total Spend"/);
    expect(model).toMatch(/label:\s*"GM Earnings"/);
    expect(model).toMatch(/label:\s*"Prizes Won"/);
    const catalog = readCode(
      "components/dashboard/wallet/wallet-categories.ts",
    );
    expect(catalog).toMatch(/label:\s*"Marketplace"/);
    expect(catalog).toMatch(/label:\s*"GM Spend"/);
    expect(catalog).toMatch(/label:\s*"Contest Entries"/);
  });

  it("Gift credits come from admin adjustments, never from refunds", () => {
    const charts = readCode("lib/actions/dashboard/charts.ts");
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    const catalog = readCode(
      "components/dashboard/wallet/wallet-categories.ts",
    );
    // Reason: the old Bonuses tile summed refunds; Gift credits must read the new buckets.
    expect(charts).toMatch(/giftCredits/);
    expect(charts).toMatch(/giftCreditsOut/);
    expect(charts).toMatch(/case "admin_adjustment"/);
    expect(charts).toMatch(/case "manual_deposit_credit"/);
    expect(charts).toMatch(/case "gamemaster_subscription"/);
    expect(charts).toMatch(/entry\.gmSpend/);
    // Reason: flipped 6 Oct 2026 (agnostic) — mapping lives in the catalog + mapRawBreakdownRow.
    expect(catalog).toMatch(/key:\s*"giftCredits"/);
    expect(catalog).toMatch(/sourceKey:\s*"giftCredits"/);
    expect(model).toMatch(/mapRawBreakdownRow/);
    expect(model).not.toMatch(/bonuses:\s*r\.refunds/);
  });

  it("mobile mounts Spending vs Earnings and omits Daily Credit Flow", () => {
    const mobile = readCode(
      "components/dashboard/wallet/mobile/MobileWallet.tsx",
    );
    const trend = readCode(
      "components/dashboard/wallet/mobile/MobileWalletTrend.tsx",
    );
    expect(mobile).toMatch(/SpendingVsEarnings/);
    // Reason: flipped 6 Oct 2026 — Daily Credit Flow removed from mobile only.
    expect(mobile).not.toMatch(/MobileDailyFlow|DailyCreditFlowPanel/);
    expect(trend).toMatch(/mwGoldGlow/);
    expect(trend).toMatch(/orientation="right"/);
  });

  it("mobile wallet is a dedicated tree with Deposit/Withdraw and shared model", () => {
    const mobile = readCode(
      "components/dashboard/wallet/mobile/MobileWallet.tsx",
    );
    const actions = readCode(
      "components/dashboard/wallet/mobile/MobileWalletActions.tsx",
    );
    const ret = mobile.slice(mobile.lastIndexOf("return ("));
    const idx = (s: string) => ret.indexOf(s);
    expect(idx("<MobileWalletHeader")).toBeLessThan(
      idx("<MobileWalletBalanceCard"),
    );
    expect(idx("<MobileWalletBalanceCard")).toBeLessThan(
      idx("<MobileWalletActions"),
    );
    expect(idx("<MobileWalletActions")).toBeLessThan(
      idx("<MobileWalletOverview"),
    );
    expect(idx("<MobileWalletOverview")).toBeLessThan(idx("<MobileWalletTrend"));
    expect(idx("<MobileWalletTrend")).toBeLessThan(idx("<CreditBreakdownPanel"));
    expect(idx("<CreditBreakdownPanel")).toBeLessThan(idx("<SpendingVsEarnings"));
    expect(idx("<SpendingVsEarnings")).toBeLessThan(idx("<MobileWalletInsights"));
    expect(idx("<MobileWalletInsights")).toBeLessThan(
      idx("<MobileRecentTransactions"),
    );
    expect(mobile).toMatch(/useWalletAnalyticsModel/);
    expect(actions).toMatch(/Deposit/);
    expect(actions).toMatch(/Withdraw/);
    expect(actions).toMatch(/href=["']\/wallet["']/);
    // Reason: flipped 6 Oct 2026 — CreditBreakdownPanel is shared on purpose
    // so the stacked area + donut padding cannot drift from desktop.
    expect(mobile).not.toMatch(
      /WalletKpiGrid|WalletBackdrop|MobileMoneyInOut|MobileDailyFlow/,
    );
  });

  it("desktop Daily Credit Flow is a composed area/line chart, not bars", () => {
    const flow = readCode(
      "components/dashboard/wallet/DailyCreditFlowPanel.tsx",
    );
    expect(flow).toMatch(/ComposedChart/);
    expect(flow).toMatch(/dataKey=["']net["']/);
    expect(flow).toMatch(/dataKey=["']gain["']/);
    expect(flow).toMatch(/dataKey=["']loss["']/);
    expect(flow).not.toMatch(/BarChart/);
    expect(flow).not.toMatch(/maxBarSize/);
  });

  it("Credit Breakdown is a stacked area chart, not sparse multi-series bars", () => {
    const breakdown = readCode(
      "components/dashboard/wallet/CreditBreakdownPanel.tsx",
    );
    expect(breakdown).toMatch(/AreaChart/);
    expect(breakdown).toMatch(/stackId=["']credits["']/);
    expect(breakdown).not.toMatch(/BarChart/);
    expect(breakdown).not.toMatch(/maxBarSize/);
  });

  it("Credit Breakdown summary tiles auto-fill from the catalog with GM after Prizes", () => {
    const breakdown = readCode(
      "components/dashboard/wallet/CreditBreakdownPanel.tsx",
    );
    const catalog = readCode(
      "components/dashboard/wallet/wallet-categories.ts",
    );
    // Reason: flipped 6 Oct 2026 (agnostic) — fixed grid-cols-3 cannot grow with
    // new buckets; auto-fill keeps desktop + mobile balanced.
    expect(breakdown).toMatch(/auto-fill/);
    expect(breakdown).toMatch(/resolveCategories/);
    expect(breakdown).toMatch(/sm:text-base/);
    const gift = catalog.indexOf('label: "Gift Credits"');
    const prizes = catalog.indexOf('label: "Prizes Won"');
    const gm = catalog.indexOf('label: "GM Earnings"');
    expect(gift).toBeGreaterThan(-1);
    expect(prizes).toBeGreaterThan(gift);
    expect(gm).toBeGreaterThan(prizes);
  });

  it("Wallet category catalog is the single series source and discovers unknown keys", () => {
    const catalog = readCode(
      "components/dashboard/wallet/wallet-categories.ts",
    );
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    const breakdown = readCode(
      "components/dashboard/wallet/CreditBreakdownPanel.tsx",
    );
    const desktop = readCode(
      "components/dashboard/wallet/DesktopWalletAnalytics.tsx",
    );
    const mobile = readCode(
      "components/dashboard/wallet/mobile/MobileWallet.tsx",
    );
    expect(catalog).toMatch(/export const WALLET_CATEGORIES/);
    expect(catalog).toMatch(/export function resolveCategories/);
    expect(catalog).toMatch(/known:\s*false/);
    expect(model).toMatch(/resolveCategories/);
    expect(model).toMatch(/c\.spend/);
    expect(model).toMatch(/c\.insight/);
    expect(breakdown).not.toMatch(/const SERIES\s*=/);
    expect(desktop).toMatch(/categories=\{model\.categories\}/);
    expect(mobile).toMatch(/categories=\{model\.categories\}/);
    // Reason: panels must not hard-code game codes (R29 / no-developer-needed).
    expect(catalog).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);
    expect(breakdown).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);
  });

  it("Spending vs Earnings donut pads the SVG so glow is not clipped", () => {
    const spend = readCode(
      "components/dashboard/wallet/SpendingVsEarnings.tsx",
    );
    expect(spend).toMatch(/viewBox=["']-20 -20 180 180["']/);
    expect(spend).toMatch(/overflow-visible/);
    expect(spend).toMatch(/className=["']overflow-visible["']/);
  });

  it("Spending vs Earnings contrasts money out vs money in, not a second breakdown", () => {
    const spend = readCode(
      "components/dashboard/wallet/SpendingVsEarnings.tsx",
    );
    const model = readCode(
      "components/dashboard/wallet/useWalletAnalyticsModel.ts",
    );
    const desktop = readCode(
      "components/dashboard/wallet/DesktopWalletAnalytics.tsx",
    );
    const mobile = readCode(
      "components/dashboard/wallet/mobile/MobileWallet.tsx",
    );
    // Reason: flipped 6 Oct 2026 — one mixed donut duplicated Credit Breakdown totals.
    expect(spend).toMatch(/spendSlices/);
    expect(spend).toMatch(/earnSlices/);
    expect(spend).toMatch(/Net \(in − out\)/);
    expect(spend).toMatch(/Where it went/);
    expect(spend).toMatch(/Where it came from/);
    expect(spend).not.toMatch(/Total Credits/);
    expect(model).toMatch(/flow === "out"/);
    expect(model).toMatch(/flow === "in"/);
    expect(desktop).toMatch(/earnSlices=\{model\.earnSlices\}/);
    expect(mobile).toMatch(/earnSlices=\{model\.earnSlices\}/);
  });

  it("chart panels carry the reference subtitles", () => {
    const balance = readCode(
      "components/dashboard/wallet/WalletBalanceTrend.tsx",
    );
    const breakdown = readCode(
      "components/dashboard/wallet/CreditBreakdownPanel.tsx",
    );
    const flow = readCode(
      "components/dashboard/wallet/DailyCreditFlowPanel.tsx",
    );
    const spend = readCode(
      "components/dashboard/wallet/SpendingVsEarnings.tsx",
    );
    expect(balance).toMatch(
      /Track your wallet balance over time with daily changes/,
    );
    expect(breakdown).toMatch(/See how your credits are sourced and used/);
    expect(flow).toMatch(/Daily net credit movement in your wallet/);
    expect(spend).toMatch(
      /Money out versus money in for the selected period/,
    );
  });
});
