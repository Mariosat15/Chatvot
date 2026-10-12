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
  ["total_capital", "Highest Capital"],
  ["win_rate", "Highest Win Rate"],
  ["total_wins", "Most Winning Trades"],
  ["profit_factor", "Best Profit Factor"],
]);

export const RANKING_EXPLANATIONS = new Map<string, string>([
  [
    "pnl",
    "Winner is determined by total profit & loss (realized + unrealized).",
  ],
  [
    "roi",
    "Winner is determined by the highest return on investment percentage.",
  ],
  ["total_capital", "Winner has the highest account balance at the end."],
  ["win_rate", "Winner has the highest percentage of winning trades."],
  ["total_wins", "Winner has the most profitable trades closed."],
  ["profit_factor", "Winner has the best ratio of winning to losing trades."],
]);

export const ASSET_LABELS = new Map<string, string>([
  ["forex", "Forex"],
  ["crypto", "Crypto"],
  ["stocks", "Stocks"],
]);
