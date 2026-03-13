'use client';
// ─── Chartvolt Live Arena — Premium Trading Broadcast Dashboard ──────────────
// Route: /arena — Public broadcast-ready trading arena dashboard
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Ticker, EventCard, TraderCard,
  OverviewScene, RaceScene, SpotlightScene, H2HScene, DangerScene, PodiumScene,
  injectDerbyStyles,
} from '@/components/arena';
import ArenaIcon from '@/components/arena/ArenaIcon';
import type { AEvent, PriceMap, SceneKey, Participant, CandleData, BubbleTrade, OpenPos, ArenaStats } from '@/components/arena/types';
import { CV } from '@/components/arena/constants';
import { ranked, fmt } from '@/components/arena/helpers';

// ─── Scene Navigation ────────────────────────────────────────────────────────
const SCENE_TABS: { key: SceneKey; label: string; icon: string }[] = [
  { key: 'overview',  label: 'Overview',    icon: 'Layers' },
  { key: 'race',      label: 'Race',        icon: 'Activity' },
  { key: 'spotlight', label: 'Spotlight',   icon: 'Eye' },
  { key: 'h2h',       label: 'Head to Head',icon: 'Swords' },
  { key: 'danger',    label: 'Danger Zone', icon: 'AlertTriangle' },
  { key: 'podium',    label: 'Podium',      icon: 'Trophy' },
];

// ─── Stats Bar Item ──────────────────────────────────────────────────────────
function StatItem({ label, value, icon, color, glow }: {
  label: string; value: string; icon: string; color: string; glow?: string;
}) {
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 12,
      background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
      border: `1px solid ${CV.glassBorder}`,
      flex: '1 1 140px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '50%', height: 1,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 }}>
        <ArenaIcon name={icon} size={12} color={CV.gray} />
        <span style={{ color: CV.gray, fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{
        color, fontSize: 18, fontWeight: 800,
        fontFamily: '"SF Mono", Consolas, monospace',
        textShadow: glow ? `0 0 12px ${glow}` : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Main Arena Page ─────────────────────────────────────────────────────────
export default function ArenaPage() {
  const [view, setView] = useState<'lobby' | 'live'>('lobby');
  const [events, setEvents] = useState<AEvent[]>([]);
  const [selected, setSelected] = useState<AEvent | null>(null);
  const [scene, setScene] = useState<SceneKey>('overview');
  const [prices, setPrices] = useState<PriceMap>({});
  const [prevPrices, setPrevPrices] = useState<PriceMap>({});
  const [traderModal, setTraderModal] = useState<Participant | null>(null);
  const [chartSymbol, setChartSymbol] = useState('EURUSD');
  const [chartTf, setChartTf] = useState('1');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [bubbles, setBubbles] = useState<BubbleTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ArenaStats>({ totalPrizePool: 0, activePlayers: 0, liveNow: 0, upcoming: 0, openPositions: 0, totalTrades: 0 });

  const prevEquitiesRef = useRef<Map<string, number>>(new Map());
  const [previousEquities, setPreviousEquities] = useState<Map<string, number>>(new Map());
  const livePricesRef = useRef<PriceMap>({});
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const compIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { injectDerbyStyles(); }, []);
  // Reason: Tick counter for countdown timer updates
  useEffect(() => { const c = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(c); }, []);

  // ── Fetch competitions ──────────────────────────────────────────────────────
  const fetchCompetitions = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/competitions');
      if (!res.ok) return;
      const data = await res.json();

      const mapEvent = (ev: Record<string, unknown>): AEvent => {
        const rawParticipants = (ev.participants || []) as Record<string, unknown>[];
        const rawPositions = (ev.openPositions || []) as Record<string, unknown>[];
        const posByUser: Record<string, unknown[]> = {};
        for (const pos of rawPositions) {
          const uid = pos.userId as string;
          if (!posByUser[uid]) posByUser[uid] = [];
          posByUser[uid].push(pos);
        }
        const participants: Participant[] = rawParticipants.map((p) => ({
          userId: (p.userId as string) || '',
          username: (p.username as string) || 'Anonymous',
          profileImage: (p.profileImage as string | null) || null,
          liveEquity: (p.liveEquity as number) || 0,
          livePnl: (p.livePnl as number) || 0,
          liveRoi: (p.liveRoi as number) || 0,
          realizedPnl: (p.realizedPnl as number) || 0,
          unrealizedPnl: (p.unrealizedPnl as number) || 0,
          currentCapital: (p.currentCapital as number) || 0,
          availableCapital: (p.availableCapital as number) || 0,
          usedMargin: (p.usedMargin as number) || 0,
          totalTrades: (p.totalTrades as number) || 0,
          winningTrades: (p.winningTrades as number) || 0,
          losingTrades: (p.losingTrades as number) || 0,
          winRate: (p.winRate as number) || 0,
          averageWin: (p.averageWin as number) || 0,
          averageLoss: (p.averageLoss as number) || 0,
          largestWin: (p.largestWin as number) || 0,
          largestLoss: (p.largestLoss as number) || 0,
          maxDrawdownPercentage: (p.maxDrawdownPercentage as number) || 0,
          currentOpenPositions: (p.currentOpenPositions as number) || 0,
          status: (p.status as string) || 'active',
          isDisqualified: (p.isDisqualified as boolean) || false,
          openPositions: (posByUser[(p.userId as string)] || []) as OpenPos[],
        }));
        const rawType = (ev.type as string) || '';
        const normalizedType = rawType === 'competition' ? 'trading_competition' : rawType;
        return {
          _id: (ev.id as string) || (ev._id as string) || '',
          name: (ev.name as string) || '',
          type: normalizedType,
          status: (ev.status as string) || '',
          startingCapital: (ev.startingCapital as number) || 10000,
          prizePool: (ev.prizePool as number) || 0,
          currentParticipants: (ev.currentParticipants as number) || 0,
          maxParticipants: (ev.maxParticipants as number) || 0,
          startDate: (ev.startTime as string) || (ev.startDate as string) || '',
          endDate: (ev.endTime as string) || (ev.endDate as string) || '',
          description: (ev.description as string) || undefined,
          allowedAssets: (ev.assetClasses as string[]) || (ev.allowedAssets as string[]) || undefined,
          participants,
        };
      };

      const comps = ((data.competitions || []) as Record<string, unknown>[]).map(mapEvent);
      const challs = ((data.challenges || []) as Record<string, unknown>[]).map(mapEvent);
      const allEvents = [...comps, ...challs];
      setEvents(allEvents);

      // Reason: Extract API stats for the global stats bar
      if (data.stats) {
        const s = data.stats;
        let totalTrades = 0;
        allEvents.forEach(e => e.participants.forEach(p => { totalTrades += p.totalTrades; }));
        setStats({
          totalPrizePool: s.totalPrizePool ?? 0,
          activePlayers: s.activePlayers ?? 0,
          liveNow: s.liveNow ?? 0,
          upcoming: s.upcoming ?? 0,
          openPositions: s.openPositions ?? 0,
          totalTrades,
        });
      }

      if (data.prices && typeof data.prices === 'object') {
        const apiSyms = Object.keys(data.prices);
        if (apiSyms.length > 0) setAvailableSymbols(apiSyms);
      }

      if (selected) {
        const updated = allEvents.find((e) => e._id === selected._id);
        if (updated) {
          const prevMap = new Map<string, number>();
          selected.participants.forEach(p => prevMap.set(p.userId, p.liveEquity));
          prevEquitiesRef.current = prevMap;
          setPreviousEquities(prevMap);
          setSelected(updated);
        }
      }
      setLoading(false);
    } catch {
      console.warn('⚠️ Arena: Failed to fetch competitions');
    }
  }, [selected]);

  useEffect(() => {
    const startPolling = () => { fetchCompetitions(); if (compIntervalRef.current) clearInterval(compIntervalRef.current); compIntervalRef.current = setInterval(fetchCompetitions, 3000); };
    const stopPolling = () => { if (compIntervalRef.current) { clearInterval(compIntervalRef.current); compIntervalRef.current = null; } };
    const onVis = () => { document.hidden ? stopPolling() : startPolling(); };
    startPolling();
    document.addEventListener('visibilitychange', onVis);
    return () => { stopPolling(); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchCompetitions]);

  // ── Fetch prices ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'live') return;
    const defaultSyms = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'USD/CHF', 'EUR/GBP'];
    const symbols = availableSymbols.length > 0 ? availableSymbols : defaultSyms;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/trading/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols }) });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (data.prices && Array.isArray(data.prices)) {
          const map: PriceMap = {};
          for (const p of data.prices) {
            if (p && p.symbol && typeof p.mid === 'number') map[p.symbol.replace('/', '')] = p.mid;
          }
          setPrevPrices(livePricesRef.current);
          livePricesRef.current = map;
          setPrices(map);
        }
      } catch { /* silent */ }
    };
    const start = () => { poll(); if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); priceIntervalRef.current = setInterval(poll, 1000); };
    const stop = () => { if (priceIntervalRef.current) { clearInterval(priceIntervalRef.current); priceIntervalRef.current = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [view, availableSymbols]);

  // ── Fetch candles ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'live') return;
    let alive = true;
    const slashSym = chartSymbol.length === 6 ? `${chartSymbol.slice(0, 3)}/${chartSymbol.slice(3)}` : chartSymbol;
    const fetchCandles = async () => {
      try {
        const res = await fetch('/api/trading/candles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: slashSym, timeframe: chartTf, limit: 200 }) });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (data.candles) setCandles(data.candles);
      } catch { /* silent */ }
    };
    fetchCandles();
    const iv = setInterval(fetchCandles, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [view, chartSymbol, chartTf]);

  // ── Build bubbles ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    const newBubbles: BubbleTrade[] = selected.participants
      .flatMap(p => (p.openPositions || []).map(pos => ({
        side: pos.side, user: p.username, price: pos.currentPrice,
        pnl: pos.unrealizedPnl, size: Math.min(8, Math.max(2, Math.abs(pos.unrealizedPnl) / 50)),
      })));
    setBubbles(newBubbles);
  }, [selected]);

  // ── Countdown timer ─────────────────────────────────────────────────────────
  const countdownStr = useMemo(() => {
    const activeEvents = events.filter(e => e.status === 'active' || e.status === 'live');
    const nextEnd = activeEvents
      .map(e => new Date(e.endDate).getTime())
      .filter(n => n > Date.now())
      .sort((a, b) => a - b)[0];
    if (!nextEnd) return 'LIVE';
    const ms = Math.max(0, nextEnd - Date.now());
    return `${Math.floor(ms / 3600000).toString().padStart(2, '0')}:${Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick]);

  const handleSelectEvent = useCallback((ev: AEvent) => { setSelected(ev); setView('live'); setScene('overview'); }, []);
  const handleBack = useCallback(() => { setView('lobby'); setSelected(null); setTraderModal(null); }, []);
  const handleSelectTrader = useCallback((p: Participant) => { setTraderModal(p); }, []);
  const traderRank = useMemo(() => {
    if (!traderModal || !selected) return 1;
    const sorted = ranked(selected.participants);
    return Math.max(1, sorted.findIndex(p => p.userId === traderModal.userId) + 1);
  }, [traderModal, selected]);

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at top, #0f1f45 0%, #080e20 35%, #040a14 65%, #020510 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: CV.txt,
    }}>
      <Ticker prices={prices} prevPrices={prevPrices} dynamicSymbols={availableSymbols} />

      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 24px',
        borderBottom: `1px solid ${CV.bd0}`,
        background: CV.glass,
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view === 'live' && (
            <button onClick={handleBack} style={{
              background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
              border: `1px solid ${CV.bd2}`, color: CV.lgt,
              padding: '6px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all .2s',
            }}>
              <ArenaIcon name="ChevronLeft" size={14} color={CV.lgt} />
              Back
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${CV.gold}20, ${CV.oran}20)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${CV.gold}30`,
            }}>
              <ArenaIcon name="Trophy" size={20} color={CV.gold} />
            </div>
            <div>
              <div style={{
                fontWeight: 800, fontSize: 16, letterSpacing: 2,
                backgroundImage: `linear-gradient(90deg, ${CV.gold}, ${CV.oran}, ${CV.gold})`,
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'derbyShine 3s linear infinite',
              }}>
                CHARTVOLT ARENA
              </div>
              <div style={{ color: CV.gray, fontSize: 10, letterSpacing: 1.5 }}>
                LIVE TRADING BROADCAST
              </div>
            </div>
          </div>
        </div>

        {view === 'live' && (
          <div style={{ display: 'flex', gap: 3 }}>
            {SCENE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setScene(tab.key)} style={{
                background: scene === tab.key ? `linear-gradient(135deg, ${CV.gold}15, ${CV.gold}08)` : 'transparent',
                border: `1px solid ${scene === tab.key ? CV.gold + '50' : CV.bd1}`,
                color: scene === tab.key ? CV.gold : CV.gray,
                padding: '6px 14px', borderRadius: 8,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s',
                display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: scene === tab.key ? `0 0 12px ${CV.gold}15` : 'none',
              }}>
                <ArenaIcon name={tab.icon} size={13} color={scene === tab.key ? CV.gold : CV.gray} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {view === 'live' && selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: CV.teal, animation: 'livePulse 1.5s ease-out infinite',
              boxShadow: `0 0 8px ${CV.teal}`,
            }} />
            <span style={{ color: CV.teal, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>LIVE</span>
          </div>
        )}
      </header>

      <main style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
        {/* ═══════ LOBBY VIEW ═══════ */}
        {view === 'lobby' && (
          <div style={{ animation: 'fadeSlideUp .4s ease-out' }}>
            {/* Hero Banner */}
            <div style={{
              background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
              borderRadius: 20, border: `1px solid ${CV.glassBorder}`,
              padding: '40px 40px', marginBottom: 20, textAlign: 'center',
              position: 'relative', overflow: 'hidden',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${CV.gold}08, transparent 70%)`, top: -80, left: '20%' }} />
                <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle, ${CV.blue}06, transparent 70%)`, bottom: -60, right: '15%' }} />
                <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${CV.purp}05, transparent 70%)`, top: '30%', right: '30%' }} />
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 64, height: 64, margin: '0 auto 14px', borderRadius: 16,
                  background: `linear-gradient(135deg, ${CV.gold}20, ${CV.oran}20)`,
                  border: `1px solid ${CV.gold}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'goldGlow 3s ease-in-out infinite',
                }}>
                  <ArenaIcon name="Trophy" size={32} color={CV.gold} />
                </div>
                <div style={{
                  fontSize: 30, fontWeight: 900, letterSpacing: 4, marginBottom: 8,
                  backgroundImage: `linear-gradient(90deg, ${CV.gold}, ${CV.oran}, ${CV.gold})`,
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  animation: 'derbyShine 3s linear infinite',
                }}>
                  LIVE TRADING ARENA
                </div>
                <div style={{ color: CV.lgt, fontSize: 14, maxWidth: 500, margin: '0 auto', lineHeight: 1.5 }}>
                  Watch live traders compete in real-time — every trade, every move, every second.
                </div>
              </div>
            </div>

            {/* Global Stats Bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatItem label="PRIZE POOL" value={fmt(stats.totalPrizePool)} icon="DollarSign" color={CV.gold} glow={`${CV.gold}30`} />
              <StatItem label="LIVE NOW" value={String(stats.liveNow)} icon="Radio" color={CV.red} glow={`${CV.red}30`} />
              <StatItem label="UPCOMING" value={String(stats.upcoming)} icon="Clock" color={CV.oran} />
              <StatItem label="TRADERS" value={String(stats.activePlayers)} icon="Users" color={CV.blue} />
              <StatItem label="ROUND TIMER" value={countdownStr} icon="Timer" color={CV.teal} glow={`${CV.teal}20`} />
            </div>

            {/* Events grid */}
            {loading ? (
              <div style={{ textAlign: 'center', color: CV.gray, padding: 80 }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <ArenaIcon name="Activity" size={40} color={CV.gray} style={{ animation: 'avatarBob 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Loading events...</div>
              </div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', color: CV.gray, padding: 80 }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <ArenaIcon name="Trophy" size={40} color={CV.gray} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>No active events right now. Check back soon!</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {events.map(ev => (
                  <EventCard key={ev._id} event={ev} onSelect={handleSelectEvent} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ LIVE VIEW ═══════ */}
        {view === 'live' && selected && (
          <div style={{ animation: 'fadeSlideUp .3s ease-out' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, padding: '12px 20px',
              background: CV.glass, borderRadius: 14,
              border: `1px solid ${CV.glassBorder}`,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CV.teal, animation: 'livePulse 1.5s ease-out infinite' }} />
                <span style={{ color: CV.txt, fontSize: 16, fontWeight: 700 }}>{selected.name}</span>
                <span style={{
                  color: CV.gray, fontSize: 11, padding: '2px 10px',
                  background: CV.bg4, borderRadius: 6, border: `1px solid ${CV.bd1}`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <ArenaIcon name={selected.type === 'trading_competition' ? 'Trophy' : 'Swords'} size={11} color={CV.gray} />
                  {selected.type === 'trading_competition' ? 'Competition' : 'Challenge'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>PRIZE</div>
                  <div style={{ color: CV.gold, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                    {selected.prizePool > 0 ? fmt(selected.prizePool) : 'Glory'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>TRADERS</div>
                  <div style={{ color: CV.blue, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                    {selected.currentParticipants}
                  </div>
                </div>
              </div>
            </div>

            {scene === 'overview' && <OverviewScene event={selected} prices={prices} prevPrices={prevPrices} previousEquities={previousEquities} chartSymbol={chartSymbol} chartTf={chartTf} candles={candles} bubbles={bubbles} availableSymbols={availableSymbols} onSymbolChange={setChartSymbol} onTfChange={setChartTf} onSelectTrader={handleSelectTrader} />}
            {scene === 'race' && <RaceScene event={selected} previousEquities={previousEquities} onSelectTrader={handleSelectTrader} />}
            {scene === 'spotlight' && <SpotlightScene event={selected} chartSymbol={chartSymbol} chartTf={chartTf} candles={candles} bubbles={bubbles} availableSymbols={availableSymbols} onSymbolChange={setChartSymbol} onTfChange={setChartTf} />}
            {scene === 'h2h' && <H2HScene event={selected} onSelectTrader={handleSelectTrader} />}
            {scene === 'danger' && <DangerScene event={selected} onSelectTrader={handleSelectTrader} />}
            {scene === 'podium' && <PodiumScene event={selected} onSelectTrader={handleSelectTrader} />}
          </div>
        )}
      </main>

      {/* Bottom Stats Ticker */}
      <div style={{
        margin: '20px 24px', borderRadius: 10,
        border: `1px solid ${CV.glassBorder}`,
        background: `linear-gradient(90deg, ${CV.glass}, rgba(91,141,255,.04), ${CV.glass})`,
        padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 24, fontSize: 12, fontWeight: 700, flexWrap: 'wrap',
      }}>
        <span style={{ color: CV.teal, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArenaIcon name="Timer" size={12} color={CV.teal} /> TIMER: <span style={{ color: CV.oran }}>{countdownStr}</span>
        </span>
        <span style={{ color: CV.bd3 }}>│</span>
        <span style={{ color: CV.gold, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArenaIcon name="DollarSign" size={12} color={CV.gold} /> {fmt(stats.totalPrizePool)} PRIZE POOL
        </span>
        <span style={{ color: CV.bd3 }}>│</span>
        <span style={{ color: CV.grn, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArenaIcon name="Radio" size={12} color={CV.grn} /> {stats.liveNow} LIVE
        </span>
        <span style={{ color: CV.bd3 }}>│</span>
        <span style={{ color: CV.blue, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArenaIcon name="Clock" size={12} color={CV.blue} /> {stats.upcoming} UPCOMING
        </span>
        <span style={{ color: CV.bd3 }}>│</span>
        <span style={{ color: CV.purp, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArenaIcon name="BarChart3" size={12} color={CV.purp} /> {stats.openPositions} POSITIONS
        </span>
      </div>

      {traderModal && selected && (
        <TraderCard participant={traderModal} rank={traderRank} startCap={selected.startingCapital} onClose={() => setTraderModal(null)} />
      )}
    </div>
  );
}
