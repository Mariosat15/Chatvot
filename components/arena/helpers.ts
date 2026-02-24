// ─── Arena Helper Functions ───────────────────────────────────────────────────
import type { Participant, OpenPos } from './types';

/** Format currency */
export const fmt = (v: number, d = 2) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K`
    : `$${v.toFixed(d)}`;

/** Format ROI */
export const fmtRoi = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/** Format PnL */
export const fmtPnl = (v: number) => `${v >= 0 ? '+$' : '-$'}${Math.abs(v).toFixed(2)}`;

/** Risk level from equity vs starting */
export const riskLevel = (p: Participant, startCap: number) => {
  const dd = ((startCap - p.liveEquity) / startCap) * 100;
  if (dd > 30) return { label: 'Aggressive', color: '#FF495B' };
  if (dd > 15) return { label: 'Medium',     color: '#FF8243' };
  return { label: 'Low', color: '#22c55e' };
};

/** Calculate ROI */
export const calcRoi = (equity: number, start: number) =>
  start > 0 ? ((equity - start) / start) * 100 : 0;

/** Calculate PnL */
export const calcPnl = (equity: number, start: number) => equity - start;

/** Win rate */
export const calcWinRate = (wins: number, total: number) =>
  total > 0 ? (wins / total) * 100 : 0;

/** Profit factor */
export const calcProfitFactor = (avgWin: number, avgLoss: number, wins: number, losses: number) => {
  const gross = avgWin * wins;
  const loss = Math.abs(avgLoss) * losses;
  return loss > 0 ? gross / loss : gross > 0 ? Infinity : 0;
};

/** Max drawdown (simplified) */
export const calcMaxDrawdown = (p: Participant) => p.maxDrawdownPercentage;

/** Sharpe ratio approximation */
export const calcSharpe = (roi: number, pf: number) =>
  pf > 0 && isFinite(pf) ? roi / (1 + 1 / pf) : 0;

/** Sort participants by rank (live equity descending) */
export const ranked = (ps: Participant[]) =>
  [...ps].sort((a, b) => b.liveEquity - a.liveEquity);

/** Assign derby-style title from trading stats */
export const getTraderTitle = (p: Participant, startCap: number) => {
  const roi = calcRoi(p.liveEquity, startCap);
  const wr = p.winRate;
  const dd = p.maxDrawdownPercentage;
  if (roi > 20 && wr > 70) return { title: 'The Sniper', emoji: '🎯' };
  if (p.totalTrades > 50 && wr > 55) return { title: 'The Scalper', emoji: '⚡' };
  if (roi > 40) return { title: 'The Titan', emoji: '🏔️' };
  if (roi > 0 && dd > 30) return { title: 'Risk Taker', emoji: '🔥' };
  if (roi < 0 && p.totalTrades > 20) return { title: 'Survivor', emoji: '🛡️' };
  if (roi < -10) return { title: 'The Underdog', emoji: '🐺' };
  return { title: 'The Maverick', emoji: '🚀' };
};

/** Time remaining until end date */
export const timeLeft = (endDate: string) => {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

/** Check if in final 5 minutes (for dramatic effects) */
export const isFinalLap = (endDate: string) =>
  new Date(endDate).getTime() - Date.now() <= 5 * 60 * 1000 && new Date(endDate).getTime() > Date.now();

/** Progress percentage on the race track (0-100) */
export const raceProgress = (equity: number, startCap: number) => {
  const roi = calcRoi(equity, startCap);
  // Map ROI -50% to +50% onto 5% to 95% track
  return Math.max(5, Math.min(95, 50 + roi));
};

/** Hash string to number (for avatar gradient) */
export const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

/** Calculate momentum (change in last interval) */
export const calcMomentum = (current: number, previous: number): 'boost' | 'slow' | 'steady' => {
  const change = ((current - previous) / previous) * 100;
  if (change > 0.5) return 'boost';
  if (change < -0.5) return 'slow';
  return 'steady';
};

/** Get all open positions from event */
export const getAllPositions = (ps: Participant[]): OpenPos[] =>
  ps.flatMap(p => (p.openPositions || []).map(pos => ({ ...pos, username: p.username, userId: p.userId, profileImage: p.profileImage })));
