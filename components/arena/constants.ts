// ─── Chartvolt Derby Theme ────────────────────────────────────────────────────

/** Brand palette — dark-neon blue + gold derby theme */
export const CV = {
  // Backgrounds (dark navy)
  bg0: '#030308', bg1: '#06081a', bg2: '#0a0e24', bg3: '#10152e', bg4: '#161c38', bg5: '#1c2342',
  // Borders
  bd0: '#161c38', bd1: '#1f2748', bd2: '#2a3358', bd3: '#3a4268',
  // Accent colors
  teal: '#0FEDBE', blue: '#5B8DFF', gold: '#FFD458', gol2: '#E8BA40',
  red: '#FF495B', oran: '#FF8243', purp: '#D13BFF',
  gray: '#8890A4', lgt: '#D0D8E8', txt: '#e4e8f0', grn: '#22c55e',
  // Derby-specific
  track: '#0C3D1A', trackLight: '#1A5E2B', turf: '#145A24',
  railGold: '#C9A84C', railDark: '#8B7635',
  neon: '#00E5FF', neonPink: '#FF2DDB',
} as const;

/** Rank colors for medals */
export const RANK_COLORS = [CV.gold, '#C0C0C0', '#CD7F32'] as const;

/** Rank glow intensities */
export const RANK_GLOW = [
  'rgba(255,212,88,.4)', 'rgba(192,192,192,.2)', 'rgba(205,127,50,.25)',
] as const;

/** Scrolling ticker symbols */
export const TICKER_SYMS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'AUDUSD',
];

/** Avatar gradient palette */
export const AV_GRADS = [
  `#0a0d1e,${CV.blue}`, `#050e12,${CV.teal}`, `#120618,${CV.purp}`,
  `#081808,${CV.grn}`, `#1a0508,${CV.red}`, `#0a0a1e,${CV.blue}`, `#150c02,${CV.oran}`,
];

/** Trader card tier config */
export const TIER_CFG = {
  champion: { border: CV.gold,  header: `linear-gradient(135deg,#1a1200,rgba(255,212,88,.22))`,  tag: 'rgba(255,212,88,.15)',  tagColor: CV.gold,  tagLabel: '🏆 Champion', glow: 'rgba(255,212,88,.3)' },
  elite:    { border: CV.purp,  header: `linear-gradient(135deg,#12081a,rgba(209,59,255,.2))`,   tag: 'rgba(209,59,255,.15)', tagColor: CV.purp,  tagLabel: '⚡ Elite',    glow: 'rgba(209,59,255,.25)' },
  veteran:  { border: CV.blue,  header: `linear-gradient(135deg,#080e22,rgba(91,141,255,.2))`,   tag: 'rgba(91,141,255,.15)', tagColor: CV.blue,  tagLabel: '🎯 Veteran',  glow: 'rgba(91,141,255,.22)' },
  trader:   { border: CV.bd3,   header: `linear-gradient(135deg,${CV.bg2},${CV.bg3})`,           tag: 'rgba(136,144,164,.1)', tagColor: CV.gray,  tagLabel: '📊 Trader',   glow: 'rgba(0,0,0,0)' },
};

/** Assign tier by rank */
export const getTier = (rank: number) =>
  rank <= 3 ? TIER_CFG.champion : rank <= 10 ? TIER_CFG.elite : rank <= 50 ? TIER_CFG.veteran : TIER_CFG.trader;

/** Derby-specific titles assigned by trading style */
export const TRADER_TITLES: Record<string, { title: string; emoji: string }> = {
  sniper:      { title: 'The Sniper',      emoji: '🎯' },
  scalper:     { title: 'The Scalper',      emoji: '⚡' },
  titan:       { title: 'The Titan',        emoji: '🏔️' },
  underdog:    { title: 'The Underdog',     emoji: '🐺' },
  sharpshooter:{ title: 'Sharpshooter',     emoji: '🔫' },
  risktaker:   { title: 'Risk Taker',       emoji: '🔥' },
  champion:    { title: 'Champion',         emoji: '🏆' },
  ironhand:    { title: 'Iron Hand',        emoji: '🤚' },
  maverick:    { title: 'The Maverick',     emoji: '🚀' },
  survivor:    { title: 'Survivor',         emoji: '🛡️' },
};

/** Colors for top traders on race chart */
export const TRADER_COLORS = [
  '#FFD458', '#C0C0C0', '#CD7F32', '#5B8DFF', '#0FEDBE',
  '#D13BFF', '#FF8243', '#22c55e', '#00E5FF', '#FF2DDB',
] as const;

/** Arena chart symbols */
export const ARENA_SYMS = [
  { label: 'EUR/USD', key: 'EURUSD' }, { label: 'GBP/USD', key: 'GBPUSD' },
  { label: 'XAU/USD', key: 'XAUUSD' }, { label: 'BTC/USD', key: 'BTCUSD' },
  { label: 'USD/JPY', key: 'USDJPY' }, { label: 'USD/CAD', key: 'USDCAD' },
];

/** Arena chart timeframes */
export const ARENA_TFS = [
  { label: '1m', value: '1' }, { label: '5m', value: '5' },
  { label: '15m', value: '15' }, { label: '1H', value: '60' }, { label: '4H', value: '240' },
];
