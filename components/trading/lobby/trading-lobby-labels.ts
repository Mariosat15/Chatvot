/**
 * The trading lobby's label dictionaries, shared by the Scoring tab
 * (`trading-lobby-accordions.tsx`) and the Overview copy (`trading-overview-copy.ts`).
 *
 * One definition so the Overview's "Climb the ranks" sentence and the Scoring tab's
 * "Ranked by" row can never name two different ranking rules for one contest.
 *
 * THE DICTIONARIES ARE MAPS. They are indexed by a value from the database, and object indexing
 * walks the prototype chain, so a contest whose `rankingMethod` read `toString` would resolve to
 * a function - truthy, past the `||` fallback, and rendered as source code.
 */

export const RANKING_LABELS = new Map<string, string>([
  ["pnl", "Highest P&L"],
  ["roi", "Highest ROI %"],
  ["total_capital", "Most Simulated funds"],
  ["win_rate", "Highest Win Rate"],
  ["total_wins", "Most Winning Trades"],
  ["profit_factor", "Best Profit Factor"],
]);

export const RANKING_EXPLANATIONS = new Map<string, string>([
  ["pnl", "Rack up the biggest score - open trades count too!"],
  ["roi", "Grow your stack by the biggest % and you take the win."],
  [
    "total_capital",
    "Finish with the most Simulated funds when the clock stops and you win.",
  ],
  ["win_rate", "Win the biggest share of your trades and you take the win."],
  ["total_wins", "Bank the most winning trades and you take the win."],
  [
    "profit_factor",
    "Win big, lose small - the best win-to-loss ratio takes it.",
  ],
]);

export const ASSET_LABELS = new Map<string, string>([
  ["forex", "Forex"],
  ["crypto", "Crypto"],
  ["stocks", "Stocks"],
]);
