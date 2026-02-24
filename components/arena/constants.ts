// ─── Chartvolt Derby Theme — Premium Neon Casino ──────────────────────────────

/** Brand palette — dark-neon blue + gold derby theme */
export const CV = {
  // Backgrounds (deep space navy)
  bg0: '#020208', bg1: '#050814', bg2: '#0a0e22', bg3: '#0e1330', bg4: '#141938', bg5: '#1a2040',
  // Borders
  bd0: '#141938', bd1: '#1c2348', bd2: '#262e58', bd3: '#384068',
  // Accent colors
  teal: '#0FEDBE', blue: '#5B8DFF', gold: '#FFD458', gol2: '#E8BA40',
  red: '#FF495B', oran: '#FF8243', purp: '#D13BFF',
  gray: '#7B849E', lgt: '#C8D0E4', txt: '#E8ECF4', grn: '#22c55e',
  // Derby neon
  neon: '#00E5FF', neonPink: '#FF2DDB', neonGreen: '#39FF14',
  // Track
  track: '#0C3D1A', trackLight: '#1A5E2B', turf: '#145A24',
  railGold: '#C9A84C', railDark: '#8B7635',
  // Glass
  glass: 'rgba(14,19,48,.65)',
  glassBorder: 'rgba(91,141,255,.12)',
  glassHover: 'rgba(91,141,255,.08)',
} as const;

/** Rank colors for medals */
export const RANK_COLORS = [CV.gold, '#C0C0C0', '#CD7F32'] as const;

/** Rank glow intensities */
export const RANK_GLOW = [
  'rgba(255,212,88,.45)', 'rgba(192,192,192,.25)', 'rgba(205,127,50,.3)',
] as const;

/** Scrolling ticker symbols */
export const TICKER_SYMS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'NZDUSD', 'USDCHF', 'EURGBP',
];

/** Ticker display labels */
export const TICKER_LABELS: Record<string, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY',
  USDCAD: 'USD/CAD', AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD',
  USDCHF: 'USD/CHF', EURGBP: 'EUR/GBP',
};

/** Avatar gradient palette */
export const AV_GRADS = [
  `#080d22,${CV.blue}`, `#040e14,${CV.teal}`, `#140620,${CV.purp}`,
  `#061806,${CV.grn}`, `#1c0408,${CV.red}`, `#080a20,${CV.neon}`, `#180e02,${CV.oran}`,
];

/** Trader card tier config */
export const TIER_CFG = {
  champion: { border: CV.gold,  header: `linear-gradient(135deg,#1a1200 0%,rgba(255,212,88,.18) 100%)`, tag: 'rgba(255,212,88,.12)',  tagColor: CV.gold,  tagLabel: '🏆 Champion', glow: 'rgba(255,212,88,.35)' },
  elite:    { border: CV.purp,  header: `linear-gradient(135deg,#12081a 0%,rgba(209,59,255,.16) 100%)`, tag: 'rgba(209,59,255,.12)', tagColor: CV.purp,  tagLabel: '⚡ Elite',    glow: 'rgba(209,59,255,.28)' },
  veteran:  { border: CV.blue,  header: `linear-gradient(135deg,#080e22 0%,rgba(91,141,255,.16) 100%)`, tag: 'rgba(91,141,255,.12)', tagColor: CV.blue,  tagLabel: '🎯 Veteran',  glow: 'rgba(91,141,255,.25)' },
  trader:   { border: CV.bd3,   header: `linear-gradient(135deg,${CV.bg2} 0%,${CV.bg3} 100%)`,         tag: 'rgba(136,144,164,.08)', tagColor: CV.gray,  tagLabel: '📊 Trader',   glow: 'rgba(0,0,0,0)' },
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
  { label: 'USD/JPY', key: 'USDJPY' }, { label: 'USD/CAD', key: 'USDCAD' },
  { label: 'AUD/USD', key: 'AUDUSD' }, { label: 'NZD/USD', key: 'NZDUSD' },
];

/** Arena chart timeframes */
export const ARENA_TFS = [
  { label: '1m', value: '1' }, { label: '5m', value: '5' },
  { label: '15m', value: '15' }, { label: '1H', value: '60' }, { label: '4H', value: '240' },
];
