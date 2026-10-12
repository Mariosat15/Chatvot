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
  ["pnl", "Make the most profit - open trades count too!"],
  ["roi", "Grow your money by the biggest % and you win."],
  ["total_capital", "Have the most money when the clock stops and you win."],
  ["win_rate", "Win the biggest share of your trades and you win."],
  ["total_wins", "Close the most winning trades and you win."],
  ["profit_factor", "Win big, lose small - the best win-to-loss ratio wins."],
]);

export const ASSET_LABELS = new Map<string, string>([
  ["forex", "Forex"],
  ["crypto", "Crypto"],
  ["stocks", "Stocks"],
]);
