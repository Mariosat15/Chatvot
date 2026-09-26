/* eslint-disable */
// Reason: R21 extract — parent comprehensive-dashboard.actions.ts carries a full
// eslint-disable; keeping the same surface so the extraction's only guarantee
// (nothing moved) is not destroyed by typing the extracted `any`s in the same commit.
/**
 * Chart and streak helpers for the player dashboard.
 * Extracted character-for-character from comprehensive-dashboard.actions.ts (R21).
 */
export async function buildChartData(
  userId: string,
  allTrades: any[],
  walletTransactions: any[],
  currentBalance: number,
) {
  const now = new Date();

  // Reason: Lightweight Charts v4 requires YYYY-MM-DD format --- "Feb 22" is invalid
  const toISODateStr = (d: Date) => d.toISOString().slice(0, 10);

  // Wallet Balance History - from transactions
  const walletBalanceHistory: {
    date: string;
    balance: number;
    change: number;
  }[] = [];

  // Build daily balance from transactions over last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Create a map of daily balances
  const dailyBalances = new Map<string, { balance: number; change: number }>();

  // Initialize with transactions
  for (const tx of walletTransactions) {
    const txDate = new Date(tx.createdAt);
    const dateStr = toISODateStr(txDate);

    // Store the latest balance for each day
    dailyBalances.set(dateStr, {
      balance: tx.balanceAfter || 0,
      change: tx.amount || 0,
    });
  }

  // Build 30-day history
  let lastKnownBalance = 0;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = toISODateStr(date);

    if (dailyBalances.has(dateStr)) {
      const dayData = dailyBalances.get(dateStr)!;
      lastKnownBalance = dayData.balance;
      walletBalanceHistory.push({
        date: dateStr,
        balance: dayData.balance,
        change: dayData.change,
      });
    } else {
      // No transactions this day, use last known balance
      walletBalanceHistory.push({
        date: dateStr,
        balance: lastKnownBalance,
        change: 0,
      });
    }
  }

  // If no history, just show current balance flat
  if (
    walletBalanceHistory.length === 0 ||
    walletBalanceHistory.every((d) => d.balance === 0)
  ) {
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = toISODateStr(date);
      walletBalanceHistory.push({
        date: dateStr,
        balance: currentBalance,
        change: 0,
      });
    }
  }

  // PERF: Single-pass trade analysis replaces 7+ separate iterations
  // Pre-build date keys for 30-day lookup
  const dayPnLMap = new Map<string, { pnl: number; trades: number }>();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = toISODateStr(date);
    dayPnLMap.set(dateStr, { pnl: 0, trades: 0 });
  }

  // Accumulators for all chart data
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  const symbolMap = new Map<string, { count: number; pnl: number }>();
  const hourMap = new Map<number, { count: number; pnl: number }>();
  for (let i = 0; i < 24; i++) hourMap.set(i, { count: 0, pnl: 0 });
  const monthMap = new Map<string, { pnl: number; trades: number; wins: number }>();

  // Single pass over all trades
  for (const trade of allTrades) {
    const pnl = trade.realizedPnl || 0;
    const closedAt = new Date(trade.closedAt);

    // Win/Loss distribution
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    else breakeven++;

    // Daily P&L (30-day window)
    const dayKey = toISODateStr(closedAt);
    const dayEntry = dayPnLMap.get(dayKey);
    if (dayEntry) {
      dayEntry.pnl += pnl;
      dayEntry.trades++;
    }

    // Trades by symbol
    const symEntry = symbolMap.get(trade.symbol);
    if (symEntry) {
      symEntry.count++;
      symEntry.pnl += pnl;
    } else {
      symbolMap.set(trade.symbol, { count: 1, pnl });
    }

    // Trades by hour
    const hour = closedAt.getHours();
    const hourEntry = hourMap.get(hour)!;
    hourEntry.count++;
    hourEntry.pnl += pnl;

    // Monthly performance
    const monthKey = closedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
    const monthEntry = monthMap.get(monthKey);
    if (monthEntry) {
      monthEntry.pnl += pnl;
      monthEntry.trades++;
      if (pnl > 0) monthEntry.wins++;
    } else {
      monthMap.set(monthKey, { pnl, trades: 1, wins: pnl > 0 ? 1 : 0 });
    }
  }

  // Build daily P&L array from pre-built map (preserves 30-day order)
  const dailyPnL: { date: string; pnl: number; trades: number }[] = [];
  for (const [date, data] of dayPnLMap) {
    dailyPnL.push({ date, ...data });
  }

  // Equity curve (cumulative) - based on trading performance
  const equityCurve: { date: string; equity: number; pnl: number }[] = [];
  let cumulativeEquity = 10000; // Starting capital assumption
  for (const day of dailyPnL) {
    cumulativeEquity += day.pnl;
    equityCurve.push({
      date: day.date,
      equity: cumulativeEquity,
      pnl: day.pnl,
    });
  }

  // Daily Credit Flow — aggregates wallet transactions into daily inflow/outflow
  const creditFlowMap = new Map<
    string,
    { inflow: number; outflow: number; transactions: number }
  >();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    creditFlowMap.set(toISODateStr(date), {
      inflow: 0,
      outflow: 0,
      transactions: 0,
    });
  }
  // Reason: The query already filters { status: "completed" }, so no need
  // to re-check tx.status here (which would fail anyway since status is not in .select()).
  for (const tx of walletTransactions) {
    const txDate = new Date(tx.createdAt);
    const dateStr = toISODateStr(txDate);
    const entry = creditFlowMap.get(dateStr);
    if (!entry) continue; // outside 30-day window
    const amount = tx.amount || 0;
    if (amount > 0) entry.inflow += amount;
    else if (amount < 0) entry.outflow += Math.abs(amount);
    entry.transactions++;
  }
  const dailyCreditFlow: {
    date: string;
    inflow: number;
    outflow: number;
    net: number;
    transactions: number;
  }[] = [];
  for (const [date, data] of creditFlowMap) {
    dailyCreditFlow.push({
      date,
      inflow: Number(data.inflow.toFixed(2)),
      outflow: Number(data.outflow.toFixed(2)),
      net: Number((data.inflow - data.outflow).toFixed(2)),
      transactions: data.transactions,
    });
  }

  // Daily Credit Breakdown — categorized income vs spending per day
  const breakdownMap = new Map<
    string,
    { deposits: number; wins: number; gmEarnings: number; refunds: number; entries: number; withdrawals: number; marketplace: number; other: number }
  >();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    breakdownMap.set(toISODateStr(date), {
      deposits: 0, wins: 0, gmEarnings: 0, refunds: 0,
      entries: 0, withdrawals: 0, marketplace: 0, other: 0,
    });
  }
  for (const tx of walletTransactions) {
    const txDate = new Date(tx.createdAt);
    const dateStr = toISODateStr(txDate);
    const entry = breakdownMap.get(dateStr);
    if (!entry) continue;
    const amount = Math.abs(tx.amount || 0);
    const txType = (tx as any).transactionType as string;
    // Reason: Only actual user deposits count as "deposits". Previously, manual_deposit_credit,
    // incident_compensation, admin_adjustment, and any unknown positive-amount transaction were
    // all inflating the deposits total, causing a mismatch with wallet.totalDeposited.
    switch (txType) {
      case "deposit":
        entry.deposits += amount; break;
      case "competition_win":
      case "challenge_win":
        entry.wins += amount; break;
      case "gamemaster_earning":
      case "gamemaster_challenge_referral":
        entry.gmEarnings += amount; break;
      case "competition_refund":
      case "challenge_refund":
      case "withdrawal_refund":
      case "challenge_declined":
      case "challenge_expired":
      case "incident_compensation":
      case "gamemaster_subscription_refund":
        entry.refunds += amount; break;
      case "competition_entry":
      case "challenge_entry":
        entry.entries += amount; break;
      case "withdrawal":
      case "withdrawal_fee":
        entry.withdrawals += amount; break;
      case "marketplace_purchase":
      case "gamemaster_subscription":
        entry.marketplace += amount; break;
      case "manual_deposit_credit":
      case "admin_adjustment":
      case "platform_fee":
      default:
        entry.other += amount;
        break;
    }
  }
  const dailyCreditBreakdown = Array.from(breakdownMap.entries()).map(([date, d]) => ({
    date,
    deposits: Number(d.deposits.toFixed(2)),
    wins: Number(d.wins.toFixed(2)),
    gmEarnings: Number(d.gmEarnings.toFixed(2)),
    refunds: Number(d.refunds.toFixed(2)),
    entries: Number(d.entries.toFixed(2)),
    withdrawals: Number(d.withdrawals.toFixed(2)),
    marketplace: Number(d.marketplace.toFixed(2)),
    other: Number(d.other.toFixed(2)),
  }));

  // Sort and limit derived arrays
  const tradesBySymbol = Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const tradesByHour = Array.from(hourMap.entries()).map(([hour, data]) => ({
    hour,
    ...data,
  }));

  const monthlyPerformance = Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    }))
    .slice(-6);

  return {
    walletBalanceHistory,
    equityCurve,
    dailyPnL,
    dailyCreditFlow,
    dailyCreditBreakdown,
    winLossDistribution: { wins, losses, breakeven },
    tradesBySymbol,
    tradesByHour,
    monthlyPerformance,
  };
}

export function calculateStreaks(trades: any[]) {
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime(),
  );

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  for (const trade of sortedTrades) {
    const pnl = trade.realizedPnl || 0;
    if (pnl > 0) {
      tempWinStreak++;
      tempLossStreak = 0;
      if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
    } else if (pnl < 0) {
      tempLossStreak++;
      tempWinStreak = 0;
      if (tempLossStreak > longestLossStreak)
        longestLossStreak = tempLossStreak;
    }
  }

  // Current streak from the end
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    const pnl = sortedTrades[i].realizedPnl || 0;
    if (pnl > 0 && currentLossStreak === 0) {
      currentWinStreak++;
    } else if (pnl < 0 && currentWinStreak === 0) {
      currentLossStreak++;
    } else {
      break;
    }
  }

  // Trading days this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tradingDays = new Set(
    trades
      .filter((t: any) => new Date(t.closedAt) >= startOfMonth)
      .map((t: any) => new Date(t.closedAt).toDateString()),
  );

  // Consecutive profitable days
  const dayPnLMap = new Map<string, number>();
  for (const trade of trades) {
    const day = new Date(trade.closedAt).toDateString();
    dayPnLMap.set(day, (dayPnLMap.get(day) || 0) + (trade.realizedPnl || 0));
  }

  let consecutiveProfitableDays = 0;
  const sortedDays = Array.from(dayPnLMap.entries()).sort(
    (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
  );

  for (const [, pnl] of sortedDays) {
    if (pnl > 0) consecutiveProfitableDays++;
    else break;
  }

  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak,
    tradingDaysThisMonth: tradingDays.size,
    consecutiveProfitableDays,
  };
}
