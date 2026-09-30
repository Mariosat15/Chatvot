/**
 * Wallet Analytics neon asset map — owner `ui/wallet items` (30 Sep 2026).
 * Desktop Wallet tab only; Header label is "Wallet Analytics".
 */

export const WALLET_ART = {
  /** Page title tile (credits / volts plate). */
  header: "/assets/neon/wallet/icon-credits.png",
  /** Wide mountain-chart plate behind the page hero. */
  backdrop: "/assets/neon/wallet/hero-backdrop-b.png",
  balance: "/assets/neon/wallet/icon-balance.png",
  spend: "/assets/neon/wallet/icon-withdraw.png",
  gameEarnings: "/assets/neon/wallet/icon-game-earnings.png",
  prizes: "/assets/neon/wallet/icon-prizes.png",
  insights: "/assets/neon/wallet/icon-insights.png",
  deposits: "/assets/neon/wallet/icon-deposits.webp",
  withdrawals: "/assets/neon/wallet/icon-withdraw.png",
  purchases: "/assets/neon/wallet/icon-balance.png",
  bonuses: "/assets/neon/wallet/icon-bonuses.png",
  netMovement: "/assets/neon/wallet/icon-net-movement.png",
} as const;

/** Every wallet asset a test can assert exists on disk. */
export function allWalletAssets(): string[] {
  return [
    ...Object.values(WALLET_ART),
    "/assets/neon/wallet/hero-backdrop-a.png",
    "/assets/neon/wallet/icon-header.png",
  ];
}
