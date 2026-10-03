/**
 * Wallet Analytics neon asset map — owner plates (3 Oct 2026).
 * Black export canvases; knock out with `mix-blend-screen` at the call site.
 * Desktop + mobile Wallet tab share these paths.
 */

export const WALLET_ART = {
  /** Page title — Wallet Analytics. */
  header: "/assets/neon/wallet/icon-wallet.jpg",
  /** Wide mountain-chart plate behind the page hero. */
  backdrop: "/assets/neon/wallet/hero-backdrop-b.png",
  /** Credit Balance KPI. */
  balance: "/assets/neon/wallet/icon-deposit.jpg",
  /** Total Spend KPI. */
  spend: "/assets/neon/wallet/icon-withdrawal.jpg",
  /** Game Earnings. */
  gameEarnings: "/assets/neon/wallet/icon-games.jpg",
  /** Prizes Won. */
  prizes: "/assets/neon/wallet/icon-trophy.jpg",
  /** Wallet Insights section header. */
  insights: "/assets/neon/wallet/icon-wallet.jpg",
  /** Wallet Balance Trend panel. */
  trend: "/assets/neon/wallet/icon-wallet.jpg",
  /** Credit Breakdown panel. */
  breakdown: "/assets/neon/wallet/icon-credits.jpg",
  /** Daily Credit Flow panel. */
  dailyFlow: "/assets/neon/wallet/icon-chart-2.png",
  /** Spending vs Earnings panel. */
  spending: "/assets/neon/wallet/icon-withdrawal.jpg",
  deposits: "/assets/neon/wallet/icon-deposit.jpg",
  withdrawals: "/assets/neon/wallet/icon-withdrawal.jpg",
  purchases: "/assets/neon/wallet/icon-purchases.jpg",
  bonuses: "/assets/neon/wallet/icon-gift.jpg",
  /** Net Movement insight. */
  netMovement: "/assets/neon/wallet/icon-chart.jpg",
} as const;

/** Every wallet asset a test can assert exists on disk. */
export function allWalletAssets(): string[] {
  return [
    ...Object.values(WALLET_ART),
    "/assets/neon/wallet/hero-backdrop-a.png",
  ];
}
