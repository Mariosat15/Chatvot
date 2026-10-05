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
  /** Game Earnings. */
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
  bonuses: NEON_ICON("gift"),
  /** Net Movement insight. */
  netMovement: NEON_ICON("chart-growth-orange"),
} as const;

/** Every wallet asset a test can assert exists on disk. */
export function allWalletAssets(): string[] {
  return [
    ...Object.values(WALLET_ART),
    "/assets/neon/wallet/hero-backdrop-a.png",
  ];
}
