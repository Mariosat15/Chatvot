/**
 * Wallet Analytics visual tokens — owner rebuild guide (30 Sep 2026).
 * Shared by every card/chart so category colours never drift.
 */

export const WALLET_PAGE_BG = "#0A0F26";

export const WALLET_CYAN = "#00E5FF";
export const WALLET_GOLD = "#FACC15";
export const WALLET_MAGENTA = "#EC4899";
export const WALLET_TEAL = "#10B981";
export const WALLET_ORANGE = "#F97316";
export const WALLET_RED = "#F43F5E";
export const WALLET_PINK = "#E879F9";
export const WALLET_VIOLET = "#A78BFA";
export const WALLET_SKY = "#38BDF8";

/** Category colours — Credit Breakdown, Spending vs Earnings, Insights. */
export const WALLET_CATEGORY = {
  deposits: WALLET_TEAL,
  contestEntries: WALLET_GOLD,
  marketplace: WALLET_MAGENTA,
  gmSpend: WALLET_VIOLET,
  gmEarnings: WALLET_CYAN,
  giftCredits: WALLET_PINK,
  giftCreditsOut: "#C084FC",
  prizes: WALLET_ORANGE,
  withdrawals: WALLET_RED,
  refunds: WALLET_SKY,
  // Reason: kept so older insight maps that still say "purchases"/"bonuses" compile
  // until every consumer is flipped — values match contestEntries / giftCredits.
  purchases: WALLET_GOLD,
  bonuses: WALLET_PINK,
  net: "#34D399",
} as const;

export type WalletRange = "7d" | "30d" | "90d" | "all";

export function sliceByRange<T>(rows: T[], range: WalletRange): T[] {
  if (!rows.length || range === "all") return rows;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return rows.slice(-days);
}
