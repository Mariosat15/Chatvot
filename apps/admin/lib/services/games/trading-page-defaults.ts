/**
 * Defaults for the Trading player page when no `game_page_content` row exists yet.
 *
 * MIRRORED into `apps/admin/lib/services/games/` — admin seeds the singleton from this,
 * and the player app falls back to it. Pin with a byte-identical test.
 */

// Reason: admin client `TradingPageSection` imports this module. `@/lib/games` is the
// barrel that connects mongoose (R58); types is model-free.
import { TRADING_GAME_TYPE } from "@/lib/games/types";

export const TRADING_PAGE_GAME_KEY = TRADING_GAME_TYPE;

export const TRADING_PAGE_DEFAULTS = {
  displayName: "Trading",
  tagline: "Compete on live forex markets with virtual capital.",
  description:
    "Join timed trading contests, manage risk with simulated capital, and climb the leaderboard on real market prices.",
  category: "trading",
  rulesSummary:
    "Rankings use your contest trading performance. Liquidation and trade-floor rules follow each contest's settings.",
  howToPlay:
    "Enter a contest, open the trading terminal when it starts, place trades within the rules, and finish with the strongest result when the clock ends.",
  pageThemeId: "trading-forge",
  skillLevelLabel: "All Levels",
} as const;

/** Storage keys for artwork under the branding-asset / disk path — not a real provider. */
export const TRADING_PAGE_ARTWORK_PROVIDER = "chartvolt";
export const TRADING_PAGE_ARTWORK_CODE = "trading";
