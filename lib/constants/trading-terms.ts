/**
 * Trading term definitions used by InfoTooltip components.
 * Centralized so all tooltip text is consistent across the app.
 */
export const TRADING_TERMS = {
  balance:
    "Your account balance — the total amount of credits in your account before any open trade profits or losses.",
  equity:
    "Balance plus or minus any unrealized profit/loss from open positions. This is your true account value right now.",
  availableCapital:
    "The amount of credits you can use to open new trades. Equals equity minus the margin already used by open positions.",
  unrealizedPnl:
    "Profit or loss from positions that are still open. This amount changes with live prices and is only locked in when you close the trade.",
  marginUsed:
    "The amount of credits currently locked as collateral for your open positions. You can't trade with these until those positions close.",
  freeMargin:
    "Credits available after subtracting margin used from equity. You can use this to open new positions.",
  marginLevel:
    "Equity divided by used margin, shown as a percentage. Below 100% means your losses exceed your margin — positions may be liquidated.",
  dailyPnl:
    "Your profit or loss for today, combining both closed trades (realized) and open positions (unrealized).",
  totalPnl:
    "Your total profit or loss since you started this competition, measured from your starting capital.",
  spreadPips:
    "The difference between the buy (ask) and sell (bid) price, measured in pips. This is the cost of entering a trade.",
  pipValue:
    "The dollar value of a single pip move for your current position size. Determines how much you gain or lose per pip.",
  lotSize:
    "The size of your trade. In forex, 1 standard lot = 100,000 units of the base currency.",
  stopLoss:
    "An automatic order to close your position at a specified price to limit losses. Highly recommended for risk management.",
  takeProfit:
    "An automatic order to close your position at a specified price to lock in gains.",
  leverage:
    "Allows you to control a larger position with less capital. Higher leverage means higher potential gains but also higher risk.",
  winRate:
    "The percentage of your closed trades that ended in profit. A higher win rate doesn't guarantee profitability — profit per trade matters too.",
  drawdown:
    "The largest drop from a peak balance to a subsequent low point. Measures the worst-case loss scenario during your trading history.",
} as const;

export type TradingTerm = keyof typeof TRADING_TERMS;
