/**
 * Wallet Analytics neon asset map — owner Menuitems set (5 Oct 2026).
 * Transparent, trimmed, squared tiles from `tools/overview/import-menuitems.mjs`;
 * no `mix-blend-screen` needed. Desktop + mobile Wallet tab share these paths.
 */

import { NEON_ICON } from "./overview-assets";

export const WALLET_ART = {
  /** Page title — Wallet Analytics. */
  header: NEON_ICON("wallet-blue"),
  /** Date-range chip beside the header. */
  range: NEON_ICON("calendar-blue"),
  /** Wide mountain-chart plate behind the page hero. */
  backdrop: "/assets/neon/wallet/hero-backdrop-b.png",
  /** Credit Balance KPI. */
  balance: NEON_ICON("deposit"),
  /** Total Spend KPI. */
  spend: NEON_ICON("withdrawal"),
  /** GM Earnings KPI / insight. */
  gameEarnings: NEON_ICON("games-orange"),
  /** Prizes Won. */
  prizes: NEON_ICON("trophy-purple"),
  /** Wallet Insights section header. */
  insights: NEON_ICON("wallet-blue"),
  /** Wallet Balance Trend panel. */
  trend: NEON_ICON("wallet-blue"),
  /** Credit Breakdown panel. */
  breakdown: NEON_ICON("credits"),
  /** Daily Credit Flow panel. */
  dailyFlow: NEON_ICON("chart-bars-red"),
  /** Spending vs Earnings panel. */
  spending: NEON_ICON("withdrawal"),
  deposits: NEON_ICON("deposit"),
  withdrawals: NEON_ICON("withdrawal"),
  purchases: NEON_ICON("purchases"),
  marketplace: NEON_ICON("purchases"),
  /** Admin add/retract — formerly mislabelled "Bonuses". */
  giftCredits: NEON_ICON("gift"),
  /** @deprecated use giftCredits — kept so a missed rename still resolves art. */
  bonuses: NEON_ICON("gift"),
  gmSpend: NEON_ICON("crown"),
  /** Net Movement insight. */
  netMovement: NEON_ICON("chart-growth-orange"),
} as const;

/** Art for a category / insight key — unknown keys fall back to insights. */
export function walletArtForKey(key: string): string {
  // Reason: Map lookup — object indexing trips detect-object-injection.
  const map = new Map<string, string>([
    ["deposits", WALLET_ART.deposits],
    ["withdrawals", WALLET_ART.withdrawals],
    ["marketplace", WALLET_ART.marketplace],
    ["contestEntries", WALLET_ART.purchases],
    ["purchases", WALLET_ART.purchases],
    ["gmEarnings", WALLET_ART.gameEarnings],
    ["gmSpend", WALLET_ART.gmSpend],
    ["giftCredits", WALLET_ART.giftCredits],
    ["giftCreditsOut", WALLET_ART.giftCredits],
    ["bonuses", WALLET_ART.giftCredits],
    ["prizes", WALLET_ART.prizes],
    ["refunds", WALLET_ART.giftCredits],
    ["freeContests", WALLET_ART.gmSpend],
    ["other", WALLET_ART.insights],
    ["net", WALLET_ART.netMovement],
  ]);
  return map.get(key) ?? WALLET_ART.insights;
}

/** Every wallet asset a test can assert exists on disk. */
export function allWalletAssets(): string[] {
  return [
    ...Object.values(WALLET_ART),
    "/assets/neon/wallet/hero-backdrop-a.png",
  ];
}
