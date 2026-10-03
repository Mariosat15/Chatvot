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

  it("composes the reference sections in order without enumerating game codes", () => {
    const page = readCode("components/dashboard/wallet/WalletAnalytics.tsx");
    expect(page).toMatch(/WalletBackdrop/);
    expect(page).toMatch(/WalletAnalyticsHeader/);
    expect(page).toMatch(/WalletKpiGrid/);
    expect(page).toMatch(/WalletBalanceTrend/);
    expect(page).toMatch(/CreditBreakdownPanel/);
    expect(page).toMatch(/DailyCreditFlowPanel/);
    expect(page).toMatch(/SpendingVsEarnings/);
    expect(page).toMatch(/WalletInsights/);
    // Reason: one global period — not independent chip state per panel.
    expect(page).toMatch(/useState<WalletRange>\("30d"\)/);
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

  it("insights strip has seven cards including Prizes Won and links to /wallet", () => {
    const insights = readCode("components/dashboard/wallet/WalletInsights.tsx");
    const page = readCode("components/dashboard/wallet/WalletAnalytics.tsx");
    expect(insights).toMatch(/View All Transactions/);
    const hrefIdx = insights.lastIndexOf(
      "href=",
      insights.indexOf("View All Transactions"),
    );
    expect(insights.slice(hrefIdx, insights.indexOf("View All Transactions"))).toMatch(
      /href=["']\/wallet["']/,
    );
    // Reason: labels live on the orchestrator; the strip only renders item.label.
    expect(page).toMatch(/label:\s*"Deposits"/);
    expect(page).toMatch(/label:\s*"Prizes Won"/);
    expect(page).toMatch(/label:\s*"Net Movement"/);
    const keys = [
      "deposits",
      "withdrawals",
      "purchases",
      "gameEarnings",
      "bonuses",
      "prizes",
      "net",
    ];
    for (const k of keys) {
      expect(insights).toContain(`"${k}"`);
    }
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
    const page = readCode("components/dashboard/wallet/WalletAnalytics.tsx");
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
    expect(page).toMatch(/label:\s*"Credit Balance"/);
    expect(page).toMatch(/label:\s*"Total Spend"/);
    expect(page).toMatch(/label:\s*"Game Earnings"/);
    expect(page).toMatch(/label:\s*"Prizes Won"/);
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
      /Compare your spending with earnings and prizes/,
    );
  });
});
