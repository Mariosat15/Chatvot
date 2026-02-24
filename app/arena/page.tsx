'use client';
// ─── Chartvolt Trading Derby — Live Arena Page ────────────────────────────────
// Route: /arena — Public broadcast-ready trading arena dashboard
// Converted from monolithic 2241-line file to modular derby-themed architecture
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Ticker, EventCard, TraderCard,
  OverviewScene, RaceScene, SpotlightScene, H2HScene, DangerScene, PodiumScene,
  injectDerbyStyles,
} from '@/components/arena';
import type { AEvent, PriceMap, SceneKey, Participant, CandleData, BubbleTrade, OpenPos } from '@/components/arena/types';
import { CV } from '@/components/arena/constants';
import { ranked } from '@/components/arena/helpers';

// ─── Scene Navigation Config ──────────────────────────────────────────────────
const SCENE_TABS: { key: SceneKey; label: string; emoji: string }[] = [
  { key: 'overview',  label: 'Overview',    emoji: '🏟️' },
  { key: 'race',      label: 'Race',        emoji: '🏇' },
  { key: 'spotlight', label: 'Spotlight',   emoji: '🔦' },
  { key: 'h2h',       label: 'Head to Head',emoji: '⚔️' },
  { key: 'danger',    label: 'Danger Zone', emoji: '⚠️' },
  { key: 'podium',    label: 'Podium',      emoji: '🏆' },
];

// ─── Main Arena Page ──────────────────────────────────────────────────────────
export default function ArenaPage() {
  // ── State ────────────────────────────────────────────────────────────────────
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

  // Previous equities for momentum tracking
  const prevEquitiesRef = useRef<Map<string, number>>(new Map());
  const [previousEquities, setPreviousEquities] = useState<Map<string, number>>(new Map());

  // Reason: We need a ref for prices to avoid stale closure in the poll function.
  // The setPrevPrices bug was that it always cloned the old prev, never advancing.
  const livePricesRef = useRef<PriceMap>({});

  // Available symbols from API (dynamic, not hardcoded)
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);

  // Interval refs for proper cleanup/restart
  const compIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Inject CSS animations ────────────────────────────────────────────────────
  useEffect(() => { injectDerbyStyles(); }, []);

  // ── Fetch competitions ───────────────────────────────────────────────────────
  const fetchCompetitions = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/competitions');
      if (!res.ok) return;
      const data = await res.json();

      // Reason: API returns fields that differ from our AEvent interface.
      // Map: id→_id, startTime→startDate, endTime→endDate, merge openPositions into participants.
      const mapEvent = (ev: Record<string, unknown>): AEvent => {
        const rawParticipants = (ev.participants || []) as Record<string, unknown>[];
        const rawPositions = (ev.openPositions || []) as Record<string, unknown>[];

        // Build a lookup: userId → their open positions
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

        // Reason: API returns type "competition"/"challenge" but arena components
        // check for "trading_competition". Normalize here.
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

      // Reason: Extract available symbols from the API prices response.
      // The API returns latestPrices as { "EUR/USD": { bid, ask, mid }, ... }
      // Use these to dynamically populate ticker and chart selectors.
      if (data.prices && typeof data.prices === 'object') {
        const apiSyms = Object.keys(data.prices);
        if (apiSyms.length > 0) {
          setAvailableSymbols(apiSyms);
        }
      }

      if (selected) {
        const updated = allEvents.find((e) => e._id === selected._id);
        if (updated) {
          // Track previous equities for momentum
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

  // Reason: Separate polling setup with proper visibility handling.
  // The previous implementation cleared the interval on tab hide but never restarted it.
  useEffect(() => {
    const startPolling = () => {
      fetchCompetitions();
      if (compIntervalRef.current) clearInterval(compIntervalRef.current);
      compIntervalRef.current = setInterval(fetchCompetitions, 3000);
    };

    const stopPolling = () => {
      if (compIntervalRef.current) {
        clearInterval(compIntervalRef.current);
        compIntervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchCompetitions]);

  // ── Fetch prices ─────────────────────────────────────────────────────────────
  // Reason: Use availableSymbols from API when available, fallback to defaults.
  // Prices API accepts slash format (EUR/USD) and returns { symbol, bid, ask, mid }.
  useEffect(() => {
    if (view !== 'live') return;

    const defaultSyms = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'USD/CHF', 'EUR/GBP'];
    // Reason: Use dynamic symbols from API response if available (all admin-enabled pairs)
    const symbols = availableSymbols.length > 0 ? availableSymbols : defaultSyms;
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/trading/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols }),
        });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (data.prices && Array.isArray(data.prices)) {
          const map: PriceMap = {};
          for (const p of data.prices) {
            if (p && p.symbol && typeof p.mid === 'number') {
              const key = p.symbol.replace('/', '');
              map[key] = p.mid;
            }
          }
          // Reason: FIX — previous logic cloned the same old prev each time, so direction
          // arrows never updated. Now we store CURRENT prices (via ref) as prev, then set new.
          setPrevPrices(livePricesRef.current);
          livePricesRef.current = map;
          setPrices(map);
        }
      } catch { /* silent */ }
    };

    const startPricePolling = () => {
      poll();
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      priceIntervalRef.current = setInterval(poll, 1000);
    };

    const stopPricePolling = () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };

    const onVis = () => {
      if (document.hidden) stopPricePolling();
      else startPricePolling();
    };

    startPricePolling();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false;
      stopPricePolling();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [view, availableSymbols]);

  // ── Fetch candles ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'live') return;
    let alive = true;

    // Reason: Candles API validates against a whitelist that requires EUR/USD format (with slash).
    // chartSymbol is stored as "EURUSD" — convert to "EUR/USD" for the API.
    const slashSym = chartSymbol.length === 6
      ? `${chartSymbol.slice(0, 3)}/${chartSymbol.slice(3)}`
      : chartSymbol;

    const fetchCandles = async () => {
      try {
        const res = await fetch('/api/trading/candles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: slashSym, timeframe: chartTf, limit: 200 }),
        });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (data.candles) setCandles(data.candles);
      } catch { /* silent */ }
    };

    fetchCandles();
    const iv = setInterval(fetchCandles, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [view, chartSymbol, chartTf]);

  // ── Build bubbles from open positions ────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    const newBubbles: BubbleTrade[] = selected.participants
      .flatMap(p => (p.openPositions || []).map(pos => ({
        side: pos.side,
        user: p.username,
        price: pos.currentPrice,
        pnl: pos.unrealizedPnl,
        size: Math.min(8, Math.max(2, Math.abs(pos.unrealizedPnl) / 50)),
      })));
    setBubbles(newBubbles);
  }, [selected]);

  // ── Select event → go live ───────────────────────────────────────────────────
  const handleSelectEvent = useCallback((ev: AEvent) => {
    setSelected(ev);
    setView('live');
    setScene('overview');
  }, []);

  // ── Back to lobby ────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    setView('lobby');
    setSelected(null);
    setTraderModal(null);
  }, []);

  // ── Trader selection ─────────────────────────────────────────────────────────
  const handleSelectTrader = useCallback((p: Participant) => {
    setTraderModal(p);
  }, []);

  // ── Trader rank in selected event ────────────────────────────────────────────
  const traderRank = useMemo(() => {
    if (!traderModal || !selected) return 1;
    const sorted = ranked(selected.participants);
    const idx = sorted.findIndex(p => p.userId === traderModal.userId);
    return idx >= 0 ? idx + 1 : 1;
  }, [traderModal, selected]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${CV.bg0} 0%, #050812 50%, ${CV.bg0} 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: CV.txt,
    }}>
      {/* Top Ticker — uses dynamic symbols when available */}
      <Ticker prices={prices} prevPrices={prevPrices} dynamicSymbols={availableSymbols} />

      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px',
        borderBottom: `1px solid ${CV.bd0}`,
        background: CV.glass,
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view === 'live' && (
            <button
              onClick={handleBack}
              style={{
                background: `linear-gradient(135deg, ${CV.bg3}, ${CV.bg4})`,
                border: `1px solid ${CV.bd2}`,
                color: CV.lgt, padding: '6px 16px', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              ← Back
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${CV.gold}20, ${CV.oran}20)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${CV.gold}30`,
              fontSize: 20,
            }}>
              🏇
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
                CHARTVOLT DERBY
              </div>
              <div style={{ color: CV.gray, fontSize: 10, letterSpacing: 1.5 }}>
                LIVE TRADING ARENA
              </div>
            </div>
          </div>
        </div>

        {/* Scene tabs (only in live view) */}
        {view === 'live' && (
          <div style={{ display: 'flex', gap: 3 }}>
            {SCENE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setScene(tab.key)}
                style={{
                  background: scene === tab.key
                    ? `linear-gradient(135deg, ${CV.gold}15, ${CV.gold}08)`
                    : 'transparent',
                  border: `1px solid ${scene === tab.key ? CV.gold + '50' : CV.bd1}`,
                  color: scene === tab.key ? CV.gold : CV.gray,
                  padding: '6px 14px', borderRadius: 8,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'all .2s',
                  display: 'flex', alignItems: 'center', gap: 4,
                  boxShadow: scene === tab.key ? `0 0 12px ${CV.gold}15` : 'none',
                }}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Live indicator */}
        {view === 'live' && selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: CV.teal,
              animation: 'livePulse 1.5s ease-out infinite',
              boxShadow: `0 0 8px ${CV.teal}`,
            }} />
            <span style={{ color: CV.teal, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>LIVE</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
        {/* ═══════ LOBBY VIEW ═══════ */}
        {view === 'lobby' && (
          <div style={{ animation: 'fadeSlideUp .4s ease-out' }}>
            {/* Welcome banner */}
            <div style={{
              background: `linear-gradient(135deg, ${CV.bg2}, ${CV.bg3})`,
              borderRadius: 20, border: `1px solid ${CV.glassBorder}`,
              padding: '48px 40px', marginBottom: 28, textAlign: 'center',
              position: 'relative', overflow: 'hidden',
              backdropFilter: 'blur(8px)',
            }}>
              {/* Background gradient orbs */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', width: 300, height: 300, borderRadius: '50%',
                  background: `radial-gradient(circle, ${CV.gold}08, transparent 70%)`,
                  top: -80, left: '20%',
                }} />
                <div style={{
                  position: 'absolute', width: 250, height: 250, borderRadius: '50%',
                  background: `radial-gradient(circle, ${CV.blue}06, transparent 70%)`,
                  bottom: -60, right: '15%',
                }} />
                <div style={{
                  position: 'absolute', width: 200, height: 200, borderRadius: '50%',
                  background: `radial-gradient(circle, ${CV.purp}05, transparent 70%)`,
                  top: '30%', right: '30%',
                }} />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 72, height: 72, margin: '0 auto 16px',
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${CV.gold}20, ${CV.oran}20)`,
                  border: `1px solid ${CV.gold}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                  animation: 'goldGlow 3s ease-in-out infinite',
                }}>
                  🏇
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 900, letterSpacing: 4, marginBottom: 10,
                  backgroundImage: `linear-gradient(90deg, ${CV.gold}, ${CV.oran}, ${CV.gold})`,
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'derbyShine 3s linear infinite',
                }}>
                  CHARTVOLT TRADING DERBY
                </div>
                <div style={{ color: CV.lgt, fontSize: 15, maxWidth: 500, margin: '0 auto', lineHeight: 1.5 }}>
                  Watch live traders race to the top — Real trades, real competition, real-time action.
                </div>
              </div>
            </div>

            {/* Events grid */}
            {loading ? (
              <div style={{ textAlign: 'center', color: CV.gray, padding: 80 }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: 'avatarBob 1.5s ease-in-out infinite' }}>🏇</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Loading races...</div>
              </div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', color: CV.gray, padding: 80 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏁</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>No active races right now. Check back soon!</div>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16,
              }}>
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
            {/* Event banner */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, padding: '12px 20px',
              background: CV.glass, borderRadius: 14,
              border: `1px solid ${CV.glassBorder}`,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: CV.teal,
                  animation: 'livePulse 1.5s ease-out infinite',
                }} />
                <span style={{ color: CV.txt, fontSize: 16, fontWeight: 700 }}>{selected.name}</span>
                <span style={{
                  color: CV.gray, fontSize: 11, padding: '2px 10px',
                  background: `${CV.bg4}`, borderRadius: 6, border: `1px solid ${CV.bd1}`,
                }}>
                  {selected.type === 'trading_competition' ? '🏇 Derby Race' : '⚔️ Challenge'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>PRIZE</div>
                  <div style={{ color: CV.gold, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                    {selected.prizePool > 0 ? `$${selected.prizePool.toLocaleString()}` : 'Glory'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: CV.gray, fontSize: 9, letterSpacing: .5 }}>RACERS</div>
                  <div style={{ color: CV.blue, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                    {selected.currentParticipants}
                  </div>
                </div>
              </div>
            </div>

            {/* Scene content */}
            {scene === 'overview' && (
              <OverviewScene
                event={selected}
                prices={prices}
                prevPrices={prevPrices}
                previousEquities={previousEquities}
                chartSymbol={chartSymbol}
                chartTf={chartTf}
                candles={candles}
                bubbles={bubbles}
                availableSymbols={availableSymbols}
                onSymbolChange={setChartSymbol}
                onTfChange={setChartTf}
                onSelectTrader={handleSelectTrader}
              />
            )}
            {scene === 'race' && (
              <RaceScene
                event={selected}
                previousEquities={previousEquities}
                onSelectTrader={handleSelectTrader}
              />
            )}
            {scene === 'spotlight' && (
              <SpotlightScene
                event={selected}
                chartSymbol={chartSymbol}
                chartTf={chartTf}
                candles={candles}
                bubbles={bubbles}
                availableSymbols={availableSymbols}
                onSymbolChange={setChartSymbol}
                onTfChange={setChartTf}
              />
            )}
            {scene === 'h2h' && (
              <H2HScene
                event={selected}
                onSelectTrader={handleSelectTrader}
              />
            )}
            {scene === 'danger' && (
              <DangerScene
                event={selected}
                onSelectTrader={handleSelectTrader}
              />
            )}
            {scene === 'podium' && (
              <PodiumScene
                event={selected}
                onSelectTrader={handleSelectTrader}
              />
            )}
          </div>
        )}
      </main>

      {/* Trader Modal */}
      {traderModal && selected && (
        <TraderCard
          participant={traderModal}
          rank={traderRank}
          startCap={selected.startingCapital}
          onClose={() => setTraderModal(null)}
        />
      )}
    </div>
  );
}
