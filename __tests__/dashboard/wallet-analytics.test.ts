import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS } from "@/lib/constants";
import {
  WALLET_ART,
  allWalletAssets,
} from "@/lib/services/games/wallet-assets";

/**
 * Wallet Analytics — desktop dashboard `?tab=wallet` (30 Sep 2026).
 *
 * Structure + neon asset inventory. Charts reuse existing series; this suite
 * pins the chrome wiring and the Header rename so a revert cannot silently
 * restore the old HeroStatsBar wallet tab.
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

  it("KPI and insight art keys resolve to distinct files where the mock needs them", () => {
    expect(WALLET_ART.balance).toContain("icon-balance");
    expect(WALLET_ART.spend).toContain("icon-withdraw");
    expect(WALLET_ART.gameEarnings).toContain("icon-game-earnings");
    expect(WALLET_ART.prizes).toContain("icon-prizes");
    expect(WALLET_ART.header).toContain("icon-credits");
    expect(WALLET_ART.backdrop).toContain("hero-backdrop");
    expect(WALLET_ART.insights).toContain("icon-insights");
  });
});

describe("Wallet Analytics Header label", () => {
  it('renames the dashboard tab to "Wallet Analytics" without changing the tab id', () => {
    const wallet = NAV_ITEMS.find((i) => i.tab === "wallet");
    expect(wallet?.label).toBe("Wallet Analytics");
    expect(wallet?.href).toBe("/dashboard?tab=wallet");
    // Reason: sidebar /wallet is a separate money page — do not rename that route.
    expect(NAV_ITEMS.some((i) => i.label === "Wallet")).toBe(false);
  });
});

describe("Wallet Analytics page wiring", () => {
  it("DashboardLayout mounts WalletAnalytics on the wallet tab and drops HeroStatsBar there", () => {
    const layout = readCode("components/dashboard/DashboardLayout.tsx");
    expect(layout).toMatch(/WalletAnalytics/);
    expect(layout).toMatch(/value=["']wallet["']/);

    // Reason: position — WalletAnalytics must sit inside the wallet TabsContent,
    // not merely be imported. Count occurrences so a second unguarded wallet
    // tree cannot hide behind the first.
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

  it("WalletAnalytics composes the mock sections without enumerating game codes", () => {
    const page = readCode("components/dashboard/wallet/WalletAnalytics.tsx");
    expect(page).toMatch(/Wallet Balance Trend/);
    expect(page).toMatch(/Credit Breakdown/);
    expect(page).toMatch(/Daily Credit Flow/);
    expect(page).toMatch(/SpendingVsEarnings/);
    expect(page).toMatch(/WalletInsightsRow/);
    expect(page).toMatch(/WalletKpiRow/);
    expect(page).toMatch(/Wallet Analytics/);
    expect(page).not.toMatch(/circuit-sprint|circuit-perfect|gameCode|providerKey/);
  });

  it("insights CTA points at the existing /wallet transactions page", () => {
    const chrome = readCode("components/dashboard/wallet/WalletChrome.tsx");
    const cta = chrome.indexOf("View All Transactions");
    expect(cta).toBeGreaterThan(-1);
    const hrefIdx = chrome.lastIndexOf('href=', cta);
    expect(hrefIdx).toBeGreaterThan(-1);
    expect(chrome.slice(hrefIdx, cta)).toMatch(/href=["']\/wallet["']/);
  });
});
