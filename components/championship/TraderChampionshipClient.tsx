"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ─── Injected CSS ──────────────────────────────────────────────────────────────
const CSS = `
.cg{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:1280px){.cg{grid-template-columns:280px 1fr 260px}}
@media(min-width:768px)and(max-width:1279px){.cg{grid-template-columns:1fr 1fr}}
.cs{display:grid;gap:8px;grid-template-columns:repeat(2,1fr)}
@media(min-width:768px){.cs{grid-template-columns:repeat(5,1fr)}}
.cm{display:grid;gap:8px;grid-template-columns:1fr}
@media(min-width:640px){.cm{grid-template-columns:1fr 1fr 1fr}}
@keyframes cPulse{0%,100%{opacity:1;box-shadow:0 0 6px #ef4444}50%{opacity:.5;box-shadow:0 0 16px #ef4444}}
@keyframes cGlow{0%,100%{box-shadow:0 0 6px rgba(6,182,212,.3)}50%{box-shadow:0 0 20px rgba(6,182,212,.6)}}
@keyframes cSlide{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes cBar{from{width:0}to{width:var(--bw)}}
@keyframes cShine{0%{background-position:200% 0}100%{background-position:-200% 0}}
.c-pulse{animation:cPulse 1.2s ease-in-out infinite}
.c-glow{animation:cGlow 2s ease-in-out infinite}
.c-slide{animation:cSlide .35s ease-out both}
.c-bar{animation:cBar .8s ease-out both}
`;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RawParticipant {
  userId: string; username: string; profileImage?: string | null;
  livePnl?: number; liveRoi?: number; liveEquity?: number;
  totalTrades?: number; winRate?: number; winningTrades?: number;
  losingTrades?: number; maxDrawdownPercentage?: number;
  currentOpenPositions?: number; rank?: number;
}
interface RawEvent {
  id: string; name?: string; status: string;
  startTime?: string; endTime?: string;
  prizePool?: number; startingCapital?: number;
  currentParticipants?: number; maxParticipants?: number;
  participants?: RawParticipant[];
  openPositions?: Array<{ leverage?: number; quantity?: number; userId?: string }>;
}
interface ApiRes {
  competitions?: RawEvent[]; challenges?: RawEvent[];
  stats?: { totalPrizePool?: number; activePlayers?: number; liveNow?: number };
}
interface Trader {
  userId: string; username: string; img: string | null;
  pnl: number; roi: number; equity: number; trades: number;
  winRate: number; drawdown: number; openPos: number; leverage: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : Math.abs(v) >= 1e3 ? `$${(v / 1e3).toFixed(1)}K`
      : `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const hashStr = (s: string) => {
  let v = 0;
  for (let i = 0; i < s.length; i++) { v = (v << 5) - v + s.charCodeAt(i); v |= 0; }
  return Math.abs(v % 1000) / 1000;
};

const mapXY = (u: string) => ({ x: 6 + hashStr(u) * 88, y: 10 + hashStr(u + "y") * 78 });

const initials = (n: string) =>
  n ? n.split(/\s+/).map(w => w?.[0] || "").join("").toUpperCase().slice(0, 2) || "??" : "??";

const avatarBg = (n: string) => {
  const colors = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#10b981", "#6366f1"];
  return colors[Math.floor(hashStr(n) * colors.length)] || colors[0];
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraderChampionshipClient() {
  const [data, setData] = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inject CSS
  useEffect(() => {
    const id = "champ-css";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // Clock tick for countdown
  useEffect(() => {
    const c = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(c);
  }, []);

  // Visibility-aware polling
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/dashboard/competitions", { cache: "no-store" });
        if (!r.ok || !alive) return;
        setData(await r.json());
        setLoading(false);
      } catch {
        if (alive) setLoading(false);
      }
    };
    const start = () => {
      poll();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(poll, 3000);
    };
    const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    const vis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; stop(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // Process API data into display data
  const d = useMemo(() => {
    const comps = data?.competitions || [];
    const challs = data?.challenges || [];
    const all = [...comps, ...challs];
    const active = all.filter(e => e.status === "active");
    // Reason: Show recently completed events when no active ones exist, so the page isn't empty
    const display = active.length > 0
      ? active
      : all.filter(e => ["completed", "active", "upcoming"].includes(e.status)).slice(0, 5);

    const map = new Map<string, Trader>();
    let trades = 0, lots = 0, low = 0, med = 0, high = 0, winners = 0, losers = 0, maxP = 0;

    for (const ev of display) {
      maxP += ev.maxParticipants || 0;
      (ev.openPositions || []).forEach(p => { lots += p.quantity || 0; });
      (ev.participants || []).forEach(p => {
        const t: Trader = {
          userId: p.userId, username: p.username || "Trader", img: p.profileImage || null,
          pnl: p.livePnl || 0, roi: p.liveRoi || 0, equity: p.liveEquity || 0,
          trades: p.totalTrades || 0, winRate: p.winRate || 0,
          drawdown: p.maxDrawdownPercentage || 0, openPos: p.currentOpenPositions || 0, leverage: 1,
        };
        trades += t.trades;
        if (t.pnl > 0) winners++; else if (t.pnl < 0) losers++;
        if (t.drawdown < 5) low++; else if (t.drawdown < 15) med++; else high++;
        const ex = map.get(t.userId);
        if (!ex || t.pnl > ex.pnl) map.set(t.userId, t);
      });
    }

    // Leverage from open positions
    const lev: Record<string, number[]> = {};
    for (const ev of display) {
      for (const pos of ev.openPositions || []) {
        if (pos.userId && pos.leverage) {
          if (!lev[pos.userId]) lev[pos.userId] = [];
          lev[pos.userId].push(pos.leverage);
        }
      }
    }
    for (const [uid, ls] of Object.entries(lev)) {
      const t = map.get(uid);
      if (t) t.leverage = Math.round(ls.reduce((a, b) => a + b, 0) / ls.length);
    }

    const leaders = Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
    const nextEnd = active
      .map(e => e.endTime ? new Date(e.endTime).getTime() : 0)
      .filter(n => n > Date.now()).sort((a, b) => a - b)[0];

    let cd = "LIVE";
    if (nextEnd) {
      const ms = Math.max(0, nextEnd - Date.now());
      const hh = Math.floor(ms / 3600000).toString().padStart(2, "0");
      const mm = Math.floor((ms % 3600000) / 60000).toString().padStart(2, "0");
      const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
      cd = `${hh}:${mm}:${ss}`;
    }

    return {
      traders: leaders.slice(0, 12), events: active.length,
      prize: data?.stats?.totalPrizePool || 0,
      count: map.size || data?.stats?.activePlayers || 0,
      maxP: maxP || 300, trades, lots: Number(lots.toFixed(2)),
      cd, risk: { low, med, high }, winners, losers,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tick]);

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="c-glow" style={{ padding: "20px 40px", borderRadius: 12, border: "1px solid rgba(6,182,212,0.3)", background: "rgba(0,0,0,0.6)", color: "#22d3ee", fontSize: 16 }}>
          ⏳ Loading Championship...
        </div>
      </div>
    );
  }

  const countries = Math.max(1, Math.min(50, Math.floor(d.count * 0.25)));
  const vol = d.count > 50 ? "HIGH" : d.count > 20 ? "MED" : "LOW";
  const volC = vol === "HIGH" ? "#ef4444" : vol === "MED" ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #10254f 0%, #080e20 35%, #040a14 65%, #020510 100%)", color: "#fff", padding: 12, fontFamily: "'Inter','Segoe UI',sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: -120, left: "18%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -80, right: "12%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)", pointerEvents: "none" }} />

      {/* ═══ HEADER ═══ */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <span className="c-pulse" style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 900, padding: "3px 10px", borderRadius: 4, letterSpacing: 2 }}>● LIVE</span>
          <h1 style={{ fontSize: "clamp(16px,3vw,24px)", fontWeight: 900, letterSpacing: 5, textTransform: "uppercase", background: "linear-gradient(90deg,#22d3ee,#a5f3fc,#67e8f9,#22d3ee)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "cShine 4s linear infinite", margin: 0 }}>
            Global Trader Championship
          </h1>
          <span style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", fontSize: 10, fontWeight: 900, padding: "3px 12px", borderRadius: 4, letterSpacing: 1 }}>
            {d.count > 0 ? `${d.count}+` : "0"} TRADERS
          </span>
        </div>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div className="cs" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(6,182,212,0.18)", background: "linear-gradient(180deg,rgba(6,182,212,0.05) 0%,rgba(0,0,0,0.35) 100%)", backdropFilter: "blur(8px)" }}>
        <StatBox label="TOTAL PRIZE POOL" icon="💰" value={fmt$(d.prize)} color="#fbbf24" />
        <StatBox label="ACTIVE TRADERS" icon="👥" value={String(d.count)} color="#22d3ee" />
        <StatBox label="COUNTRIES" icon="🌍" value={String(countries)} color="#a78bfa" />
        <StatBox label="ROUND TIMER" icon="⏱️" value={d.cd} color="#fb923c" />
        <StatBox label="VOLATILITY" icon="📊" value={vol} color={volC} />
      </div>

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <div className="cg" style={{ marginBottom: 12 }}>
        {/* LEFT — Leaderboard */}
        <GlassPanel title="LEADERBOARD" icon="🏆">
          {d.traders.length === 0 && <EmptyMsg text="Waiting for traders..." />}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {d.traders.slice(0, 10).map((t, i) => (
              <LeaderRow key={t.userId} trader={t} rank={i + 1} delay={i * 40} />
            ))}
          </div>
        </GlassPanel>

        {/* CENTER — Map + Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <GlassPanel title="LIVE TRADER MAP" icon="🗺️">
            <WorldMap traders={d.traders} />
          </GlassPanel>
          <div className="cm">
            <MiniStat label="TRADES TODAY" value={d.trades.toLocaleString()} icon="📈" color="#22d3ee" />
            <MiniStat label="TOTAL VOLUME" value={fmt$(d.lots * 100000)} icon="💹" color="#10b981" />
            <DonutPanel winners={d.winners} losers={d.losers} />
          </div>
        </div>

        {/* RIGHT — Top Performers + Risk */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <GlassPanel title="TOP PERFORMERS" icon="⭐">
            {d.traders.length === 0 && <EmptyMsg text="No active traders" />}
            {d.traders.slice(0, 5).map((t, i) => (
              <TopPerformerRow key={t.userId} trader={t} rank={i + 1} />
            ))}
          </GlassPanel>
          <GlassPanel title="RISK LEVEL" icon="⚡">
            <RiskBar label="LOW" count={d.risk.low} color="#22c55e" total={d.count || 1} />
            <RiskBar label="MEDIUM" count={d.risk.med} color="#f59e0b" total={d.count || 1} />
            <RiskBar label="HIGH" count={d.risk.high} color="#ef4444" total={d.count || 1} />
          </GlassPanel>
        </div>
      </div>

      {/* ═══ BOTTOM TICKER ═══ */}
      <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.18)", background: "linear-gradient(90deg,rgba(0,0,0,0.6),rgba(6,182,212,0.04),rgba(0,0,0,0.6))", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, fontSize: 12, fontWeight: 700, flexWrap: "wrap" }}>
        <span style={{ color: "#22d3ee" }}>▶ NEXT ROUND: <span style={{ color: "#fb923c" }}>{d.cd}</span></span>
        <Sep />
        <span style={{ color: "#fbbf24" }}>💰 {fmt$(d.prize)} PRIZE POOL</span>
        <Sep />
        <span style={{ color: "#a5f3fc" }}>👥 {d.count}/{d.maxP} TRADERS</span>
        <Sep />
        <span style={{ color: "#10b981" }}>📊 {d.events} LIVE EVENTS</span>
        <BarViz />
      </div>
    </div>
  );
}

// ═══ Sub-Components ══════════════════════════════════════════════════════════════

function StatBox({ label, icon, value, color }: { label: string; icon: string; value: string; color: string }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid rgba(6,182,212,0.12)", background: "rgba(2,6,20,0.6)", padding: "8px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>{icon} {label}</div>
      <div style={{ fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function GlassPanel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(6,182,212,0.18)", background: "linear-gradient(180deg,rgba(6,182,212,0.04) 0%,rgba(0,0,0,0.35) 100%)", padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#a5f3fc", marginBottom: 10, textTransform: "uppercase", borderBottom: "1px solid rgba(6,182,212,0.12)", paddingBottom: 6 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 20 }}>{text}</div>;
}

function LeaderRow({ trader, rank, delay }: { trader: Trader; rank: number; delay: number }) {
  const top3 = rank <= 3;
  const gain = trader.pnl >= 0;
  const mult = Math.max(1, Math.round(Math.abs(trader.roi) / 10));

  return (
    <div className="c-slide" style={{
      display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 8,
      background: top3 ? "linear-gradient(90deg,rgba(251,191,36,0.06),rgba(0,0,0,0.4))" : "rgba(2,6,20,0.5)",
      border: `1px solid ${top3 ? "rgba(251,191,36,0.18)" : "rgba(6,182,212,0.08)"}`,
      animationDelay: `${delay}ms`,
    }}>
      {/* Rank badge */}
      <div style={{
        width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 900, flexShrink: 0,
        background: rank === 1 ? "linear-gradient(135deg,#fbbf24,#b45309)" : rank === 2 ? "linear-gradient(135deg,#cbd5e1,#64748b)" : rank === 3 ? "linear-gradient(135deg,#c2884b,#7c5a2e)" : "rgba(30,41,59,0.7)",
        color: rank <= 3 ? "#000" : "#64748b",
      }}>{rank}</div>

      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `2px solid ${gain ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)"}`,
        boxShadow: `0 0 8px ${gain ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: trader.img ? "#0f172a" : avatarBg(trader.username), fontSize: 9, fontWeight: 800, color: "#fff",
      }}>
        {trader.img
          ? <img src={trader.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials(trader.username)}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {trader.username}
      </div>

      {/* PnL */}
      <div style={{ fontSize: 12, fontWeight: 700, color: gain ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
        {gain ? "+" : "-"}{fmt$(trader.pnl)}
      </div>

      {/* ROI multiplier */}
      <div style={{
        fontSize: 9, fontWeight: 900, padding: "2px 5px", borderRadius: 4,
        background: gain ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: gain ? "#10b981" : "#ef4444",
        border: `1px solid ${gain ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}>{mult}x</div>
    </div>
  );
}

function WorldMap({ traders }: { traders: Trader[] }) {
  return (
    <div style={{
      position: "relative", height: 340, borderRadius: 10, overflow: "hidden",
      background: "radial-gradient(ellipse at 30% 25%,rgba(6,182,212,0.06) 0%,transparent 50%),radial-gradient(ellipse at 70% 60%,rgba(139,92,246,0.04) 0%,transparent 50%),linear-gradient(180deg,#060e1e 0%,#040a14 100%)",
    }}>
      {/* Grid overlay */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "linear-gradient(rgba(6,182,212,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.4) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />

      {/* Stylized continents */}
      <ContinentShape left="5%" top="12%" width="22%" height="32%" radius="35% 42% 30% 55%" rgb="6,182,212" />
      <ContinentShape left="17%" top="50%" width="14%" height="35%" radius="30% 55% 45% 35%" rgb="16,185,129" />
      <ContinentShape left="40%" top="8%" width="14%" height="26%" radius="40% 35% 50% 30%" rgb="99,102,241" />
      <ContinentShape left="42%" top="36%" width="15%" height="40%" radius="35% 45% 40% 50%" rgb="245,158,11" />
      <ContinentShape left="58%" top="8%" width="30%" height="42%" radius="30% 40% 45% 35%" rgb="239,68,68" />
      <ContinentShape left="76%" top="60%" width="15%" height="22%" radius="40% 50% 35% 45%" rgb="168,85,247" />

      {/* SVG: connection lines + animated dots */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {traders.slice(0, 8).map((t, i) => {
          const next = traders[(i + 1) % Math.min(8, traders.length)];
          if (!next) return null;
          const a = mapXY(t.userId), b = mapXY(next.userId);
          return <line key={`ln-${t.userId}`} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke="rgba(6,182,212,0.12)" strokeWidth=".5" strokeDasharray="4 4" />;
        })}
        {traders.slice(0, 20).map(t => {
          const p = mapXY(t.userId);
          const g = t.pnl >= 0;
          return (
            <g key={`dot-${t.userId}`}>
              <circle cx={`${p.x}%`} cy={`${p.y}%`} r="8" fill={g ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}>
                <animate attributeName="r" values="8;13;8" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={`${p.x}%`} cy={`${p.y}%`} r="3" fill={g ? "#10b981" : "#ef4444"} stroke={g ? "#a7f3d0" : "#fca5a5"} strokeWidth="1">
                <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Labels for top 5 */}
      {traders.slice(0, 5).map(t => {
        const p = mapXY(t.userId);
        const g = t.pnl >= 0;
        return (
          <div key={`lbl-${t.userId}`} style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y + 4}%`, transform: "translateX(-50%)",
            fontSize: 9, fontWeight: 700, color: g ? "#a7f3d0" : "#fca5a5",
            textShadow: "0 0 8px rgba(0,0,0,.9)", whiteSpace: "nowrap", pointerEvents: "none",
          }}>{t.username}</div>
        );
      })}

      {traders.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 14 }}>
          Waiting for live traders...
        </div>
      )}
    </div>
  );
}

function ContinentShape({ left, top, width, height, radius, rgb }: {
  left: string; top: string; width: string; height: string; radius: string; rgb: string;
}) {
  return (
    <div style={{
      position: "absolute", left, top, width, height, borderRadius: radius,
      background: `radial-gradient(ellipse,rgba(${rgb},0.1) 0%,rgba(${rgb},0.03) 60%,transparent 100%)`,
      border: `1px solid rgba(${rgb},0.06)`,
    }} />
  );
}

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.12)", background: "rgba(2,6,20,0.5)", padding: "10px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase" }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function DonutPanel({ winners, losers }: { winners: number; losers: number }) {
  const total = winners + losers || 1;
  const winPct = Math.round((winners / total) * 100);
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.12)", background: "rgba(2,6,20,0.5)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: `conic-gradient(#10b981 0% ${winPct}%,#ef4444 ${winPct}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#94a3b8" }}>W/L</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>WINNERS VS LOSERS</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>{winPct}%</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#ef4444" }}>{100 - winPct}%</span>
        </div>
      </div>
    </div>
  );
}

function TopPerformerRow({ trader, rank }: { trader: Trader; rank: number }) {
  const gain = trader.pnl >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(6,182,212,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: rank <= 3 ? "#fbbf24" : "#64748b", width: 16 }}>{rank}.</span>
        <div style={{
          width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${gain ? "#10b981" : "#ef4444"}`,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          background: trader.img ? "#0f172a" : avatarBg(trader.username), fontSize: 7, fontWeight: 800, color: "#fff",
        }}>
          {trader.img
            ? <img src={trader.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials(trader.username)}
        </div>
        <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{trader.username}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: gain ? "#10b981" : "#ef4444" }}>
        {gain ? "+" : "-"}{fmt$(trader.pnl)}
      </span>
    </div>
  );
}

function RiskBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = Math.min(100, Math.round((count / total) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color, fontWeight: 700 }}>{label}</span>
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(30,41,59,0.7)", overflow: "hidden" }}>
        <div className="c-bar" style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${color},${color}aa)`, "--bw": `${pct}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}

function Sep() { return <span style={{ color: "#334155", fontSize: 10 }}>│</span>; }

function BarViz() {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 18 }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{
          display: "inline-block", width: 3, height: 4 + Math.sin(i * 0.8) * 7 + 7,
          background: "linear-gradient(to top,#10b981,#22d3ee)", borderRadius: 1, opacity: 0.5 + Math.sin(i * 0.6) * 0.3,
        }} />
      ))}
    </span>
  );
}
