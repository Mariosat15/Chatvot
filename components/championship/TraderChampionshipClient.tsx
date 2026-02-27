"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ─── Injected CSS ──────────────────────────────────────────────────────────────
const CSS = `
@keyframes cPulse{0%,100%{opacity:1;box-shadow:0 0 6px #ef4444}50%{opacity:.5;box-shadow:0 0 18px #ef4444}}
@keyframes cGlow{0%,100%{box-shadow:0 0 6px rgba(6,182,212,.25)}50%{box-shadow:0 0 22px rgba(6,182,212,.55)}}
@keyframes cSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes cBar{from{width:0}to{width:var(--bw)}}
@keyframes cShine{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes cFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes cSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes cFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.cp{animation:cPulse 1.2s ease-in-out infinite}
.cg-anim{animation:cGlow 2.5s ease-in-out infinite}
.cs-anim{animation:cSlide .4s ease-out both}
.cb-anim{animation:cBar .8s ease-out both}
.cf-anim{animation:cFloat 3s ease-in-out infinite}
.cfu-anim{animation:cFadeUp .6s ease-out both}
`;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RawParticipant {
  userId: string; username: string; profileImage?: string | null;
  livePnl?: number; liveRoi?: number; liveEquity?: number;
  totalTrades?: number; winRate?: number; maxDrawdownPercentage?: number;
  currentOpenPositions?: number; rank?: number; status?: string;
}
interface RawEvent {
  id: string; name?: string; status: string; type?: string;
  startTime?: string; endTime?: string;
  prizePool?: number; startingCapital?: number; entryFee?: number;
  currentParticipants?: number; maxParticipants?: number;
  participants?: RawParticipant[];
  openPositions?: Array<{ leverage?: number; quantity?: number; userId?: string }>;
}
interface ApiRes {
  competitions?: RawEvent[]; challenges?: RawEvent[];
  stats?: {
    totalPrizePool?: number; activePlayers?: number; liveNow?: number;
    upcoming?: number; openPositions?: number; serverTime?: string;
  };
}
interface Trader {
  userId: string; username: string; img: string | null;
  pnl: number; roi: number; equity: number; trades: number;
  winRate: number; drawdown: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : Math.abs(v) >= 1e3 ? `$${(v / 1e3).toFixed(1)}K`
      : `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const hsh = (s: string) => {
  let v = 0;
  for (let i = 0; i < s.length; i++) { v = (v << 5) - v + s.charCodeAt(i); v |= 0; }
  return Math.abs(v % 1000) / 1000;
};
const mxy = (u: string) => ({ x: 6 + hsh(u) * 88, y: 10 + hsh(u + "y") * 78 });
const ini = (n: string) => n ? n.split(/\s+/).map(w => w?.[0] || "").join("").toUpperCase().slice(0, 2) || "??" : "??";
const avBg = (n: string) => {
  const c = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#10b981", "#6366f1"];
  return c[Math.floor(hsh(n) * c.length)] || c[0];
};
const statusColor = (s: string) =>
  s === "active" ? "#10b981" : s === "upcoming" ? "#f59e0b" : s === "completed" ? "#64748b" : "#8b5cf6";
const statusLabel = (s: string) =>
  s === "active" ? "● LIVE" : s === "upcoming" ? "◎ UPCOMING" : s === "completed" ? "✓ COMPLETED" : s.toUpperCase();

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TraderChampionshipClient() {
  const [data, setData] = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = "champ-css";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  useEffect(() => { const c = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(c); }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/dashboard/competitions", { cache: "no-store" });
        if (!r.ok || !alive) return;
        setData(await r.json()); setLoading(false);
      } catch { if (alive) setLoading(false); }
    };
    const start = () => { poll(); if (timerRef.current) clearInterval(timerRef.current); timerRef.current = setInterval(poll, 3000); };
    const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    const vis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; stop(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // ── Process Data ─────────────────────────────────────────────────────────────
  const d = useMemo(() => {
    const comps = data?.competitions || [];
    const challs = data?.challenges || [];
    const all: RawEvent[] = [...comps, ...challs];

    // Reason: Show ALL events (active, upcoming, completed) to avoid empty page when nothing is live
    const active = all.filter(e => e.status === "active");
    const upcoming = all.filter(e => e.status === "upcoming" || e.status === "pending");
    const completed = all.filter(e => ["completed", "finalizing", "emergency_ended"].includes(e.status));

    // Use active first, then completed (which have participant data), then all
    const withData = active.length > 0 ? active : completed.length > 0 ? completed : all;

    const traderMap = new Map<string, Trader>();
    let trades = 0, lots = 0, low = 0, med = 0, high = 0, winners = 0, losers = 0;

    for (const ev of withData) {
      (ev.openPositions || []).forEach(p => { lots += p.quantity || 0; });
      (ev.participants || []).forEach(p => {
        const t: Trader = {
          userId: p.userId, username: p.username || "Trader", img: p.profileImage || null,
          pnl: p.livePnl || 0, roi: p.liveRoi || 0, equity: p.liveEquity || 0,
          trades: p.totalTrades || 0, winRate: p.winRate || 0, drawdown: p.maxDrawdownPercentage || 0,
        };
        trades += t.trades;
        if (t.pnl > 0) winners++; else if (t.pnl < 0) losers++;
        if (t.drawdown < 5) low++; else if (t.drawdown < 15) med++; else high++;
        const ex = traderMap.get(t.userId);
        if (!ex || t.pnl > ex.pnl) traderMap.set(t.userId, t);
      });
    }

    const leaders = Array.from(traderMap.values()).sort((a, b) => b.pnl - a.pnl);
    const nextEnd = active.map(e => e.endTime ? new Date(e.endTime).getTime() : 0).filter(n => n > Date.now()).sort((a, b) => a - b)[0];
    let cd = "LIVE";
    if (nextEnd) {
      const ms = Math.max(0, nextEnd - Date.now());
      cd = `${Math.floor(ms / 3600000).toString().padStart(2, "0")}:${Math.floor((ms % 3600000) / 60000).toString().padStart(2, "0")}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")}`;
    }

    // Reason: Use API-provided stats as primary source — they include ALL server-side data
    const apiStats = data?.stats;
    return {
      traders: leaders.slice(0, 12),
      activeEvents: apiStats?.liveNow ?? active.length,
      upcomingEvents: apiStats?.upcoming ?? upcoming.length,
      completedEvents: completed.length,
      prize: apiStats?.totalPrizePool ?? 0,
      count: apiStats?.activePlayers ?? traderMap.size,
      openPos: apiStats?.openPositions ?? 0,
      trades, lots: Number(lots.toFixed(2)), cd,
      risk: { low, med, high }, winners, losers,
      events: all, // all raw events for the event cards
      hasLive: active.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tick]);

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, border: "3px solid rgba(6,182,212,0.2)", borderTop: "3px solid #22d3ee", borderRadius: "50%", animation: "cSpin 1s linear infinite" }} />
      <div style={{ color: "#67e8f9", fontSize: 14, letterSpacing: 2 }}>LOADING CHAMPIONSHIP...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #0f1f45 0%, #080e20 35%, #040a14 65%, #020510 100%)", color: "#fff", padding: "12px 14px", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Ambient glows */}
      <div style={{ position: "absolute", top: -140, left: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.08),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.06),transparent 70%)", pointerEvents: "none" }} />

      {/* ═══ HEADER ═══ */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {d.hasLive && <span className="cp" style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 900, padding: "3px 10px", borderRadius: 4, letterSpacing: 2 }}>● LIVE</span>}
          <h1 style={{ fontSize: "clamp(16px,3vw,26px)", fontWeight: 900, letterSpacing: 5, textTransform: "uppercase", background: "linear-gradient(90deg,#22d3ee,#a5f3fc,#67e8f9,#22d3ee)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "cShine 4s linear infinite", margin: 0 }}>
            Global Trader Championship
          </h1>
          <span style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", fontSize: 10, fontWeight: 900, padding: "3px 12px", borderRadius: 4, letterSpacing: 1 }}>
            {d.count || d.traders.length || 0} TRADERS
          </span>
        </div>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 14, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(6,182,212,0.18)", background: "linear-gradient(180deg,rgba(6,182,212,0.05),rgba(0,0,0,0.35))", backdropFilter: "blur(8px)" }}>
        <SB l="PRIZE POOL" i="💰" v={fmt$(d.prize)} c="#fbbf24" />
        <SB l="LIVE EVENTS" i="🔴" v={String(d.activeEvents)} c="#ef4444" />
        <SB l="UPCOMING" i="📅" v={String(d.upcomingEvents)} c="#f59e0b" />
        <SB l="TRADERS" i="👥" v={String(d.count || d.traders.length)} c="#22d3ee" />
        <SB l="ROUND TIMER" i="⏱️" v={d.cd} c="#fb923c" />
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      {d.traders.length > 0 ? (
        /* ── HAS TRADERS: Full Dashboard ── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 14 }}>
          {/* Desktop: 3-col */}
          <div style={{ display: "grid", gap: 12 }} className="cg-grid">
            <style>{`.cg-grid{grid-template-columns:1fr}@media(min-width:1280px){.cg-grid{grid-template-columns:280px 1fr 260px}}@media(min-width:768px)and(max-width:1279px){.cg-grid{grid-template-columns:1fr 1fr}}`}</style>

            {/* LEFT: Leaderboard */}
            <GP t="LEADERBOARD" i="🏆">
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {d.traders.slice(0, 10).map((t, i) => <LR key={t.userId} t={t} r={i + 1} d={i * 50} />)}
              </div>
            </GP>

            {/* CENTER: Map + Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <GP t="LIVE TRADER MAP" i="🗺️"><WMap traders={d.traders} /></GP>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
                <MS l="TRADES" v={d.trades.toLocaleString()} i="📈" c="#22d3ee" />
                <MS l="OPEN POSITIONS" v={String(d.openPos)} i="📊" c="#a78bfa" />
                <Donut w={d.winners} lo={d.losers} />
              </div>
            </div>

            {/* RIGHT: Top + Risk */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <GP t="TOP PERFORMERS" i="⭐">
                {d.traders.slice(0, 5).map((t, i) => <TP key={t.userId} t={t} r={i + 1} />)}
              </GP>
              <GP t="RISK LEVEL" i="⚡">
                <RB l="LOW" n={d.risk.low} c="#22c55e" t={d.traders.length || 1} />
                <RB l="MEDIUM" n={d.risk.med} c="#f59e0b" t={d.traders.length || 1} />
                <RB l="HIGH" n={d.risk.high} c="#ef4444" t={d.traders.length || 1} />
              </GP>
            </div>
          </div>
        </div>
      ) : (
        /* ── NO TRADERS: Event Cards + Awaiting State ── */
        <div className="cfu-anim" style={{ marginBottom: 14 }}>
          {/* Hero Empty State */}
          <div style={{ textAlign: "center", padding: "40px 20px", borderRadius: 16, border: "1px solid rgba(6,182,212,0.15)", background: "linear-gradient(180deg,rgba(6,182,212,0.04),rgba(0,0,0,0.3))", marginBottom: 14 }}>
            <div className="cf-anim" style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#a5f3fc", letterSpacing: 3, margin: "0 0 8px" }}>
              {d.events.length > 0 ? "CHAMPIONSHIP HUB" : "NO EVENTS YET"}
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              {d.events.length > 0
                ? "Browse upcoming and recent competitions below. Live leaderboard activates when a competition starts."
                : "No competitions or challenges found. Create one from the admin panel to see live data here."}
            </p>
          </div>

          {/* Event Cards Grid */}
          {d.events.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
              {d.events.slice(0, 8).map((ev, i) => <EC key={ev.id} ev={ev} delay={i * 80} />)}
            </div>
          )}

          {/* World Map always visible */}
          <div style={{ marginTop: 14 }}>
            <GP t="CHAMPIONSHIP MAP" i="🗺️"><WMap traders={[]} /></GP>
          </div>
        </div>
      )}

      {/* ═══ BOTTOM TICKER ═══ */}
      <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.18)", background: "linear-gradient(90deg,rgba(0,0,0,0.6),rgba(6,182,212,0.04),rgba(0,0,0,0.6))", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, fontSize: 12, fontWeight: 700, flexWrap: "wrap" }}>
        <span style={{ color: "#22d3ee" }}>▶ TIMER: <span style={{ color: "#fb923c" }}>{d.cd}</span></span>
        <Sep /><span style={{ color: "#fbbf24" }}>💰 {fmt$(d.prize)} PRIZE POOL</span>
        <Sep /><span style={{ color: "#10b981" }}>🔴 {d.activeEvents} LIVE</span>
        <Sep /><span style={{ color: "#a5f3fc" }}>📅 {d.upcomingEvents} UPCOMING</span>
        <Sep /><span style={{ color: "#a78bfa" }}>✓ {d.completedEvents} COMPLETED</span>
        <BV />
      </div>
    </div>
  );
}

// ═══ Sub-Components ══════════════════════════════════════════════════════════════

function SB({ l, i, v, c }: { l: string; i: string; v: string; c: string }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid rgba(6,182,212,0.1)", background: "rgba(2,6,20,0.6)", padding: "8px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>{i} {l}</div>
      <div style={{ fontSize: "clamp(18px,2.5vw,26px)", fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
    </div>
  );
}

function GP({ t, i, children }: { t: string; i: string; children: React.ReactNode }) {
  return (
    <div className="cg-anim" style={{ borderRadius: 12, border: "1px solid rgba(6,182,212,0.15)", background: "linear-gradient(180deg,rgba(6,182,212,0.04),rgba(0,0,0,0.35))", padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#a5f3fc", marginBottom: 10, textTransform: "uppercase", borderBottom: "1px solid rgba(6,182,212,0.1)", paddingBottom: 6 }}>
        {i} {t}
      </div>
      {children}
    </div>
  );
}

/* ── Event Card ── */
function EC({ ev, delay }: { ev: RawEvent; delay: number }) {
  const sc = statusColor(ev.status);
  const pCount = ev.participants?.length || ev.currentParticipants || 0;
  const maxP = ev.maxParticipants || 0;
  const endStr = ev.endTime ? new Date(ev.endTime).toLocaleDateString() : "TBD";
  const startStr = ev.startTime ? new Date(ev.startTime).toLocaleDateString() : "TBD";

  return (
    <div className="cs-anim" style={{
      borderRadius: 12, border: `1px solid ${sc}33`, padding: 14,
      background: `linear-gradient(135deg,${sc}08,rgba(0,0,0,0.4))`,
      animationDelay: `${delay}ms`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: sc, letterSpacing: 1.5 }}>{statusLabel(ev.status)}</span>
        <span style={{ fontSize: 10, color: "#64748b" }}>{ev.type === "challenge" ? "⚔️ Challenge" : "🏆 Competition"}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>{ev.name || "Championship Event"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
        <div><span style={{ color: "#64748b" }}>Prize: </span><span style={{ color: "#fbbf24", fontWeight: 700 }}>{fmt$(ev.prizePool || 0)}</span></div>
        <div><span style={{ color: "#64748b" }}>Entry: </span><span style={{ color: "#22d3ee", fontWeight: 700 }}>{ev.entryFee ? fmt$(ev.entryFee) : "Free"}</span></div>
        <div><span style={{ color: "#64748b" }}>Traders: </span><span style={{ color: "#e2e8f0", fontWeight: 600 }}>{pCount}{maxP ? `/${maxP}` : ""}</span></div>
        <div><span style={{ color: "#64748b" }}>{ev.status === "upcoming" ? "Starts: " : "Ends: "}</span><span style={{ color: "#e2e8f0", fontWeight: 600 }}>{ev.status === "upcoming" ? startStr : endStr}</span></div>
      </div>
      {/* Participants preview */}
      {(ev.participants?.length || 0) > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          {ev.participants!.slice(0, 6).map(p => (
            <div key={p.userId} style={{
              width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${(p.livePnl || 0) >= 0 ? "#10b981" : "#ef4444"}`,
              overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              background: p.profileImage ? "#0f172a" : avBg(p.username), fontSize: 7, fontWeight: 800, color: "#fff",
            }}>
              {p.profileImage ? <img src={p.profileImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(p.username)}
            </div>
          ))}
          {(ev.participants!.length > 6) && <div style={{ fontSize: 10, color: "#64748b", alignSelf: "center" }}>+{ev.participants!.length - 6}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Leaderboard Row ── */
function LR({ t, r, d }: { t: Trader; r: number; d: number }) {
  const top3 = r <= 3;
  const g = t.pnl >= 0;
  const mult = Math.max(1, Math.round(Math.abs(t.roi) / 10));
  return (
    <div className="cs-anim" style={{
      display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 8,
      background: top3 ? "linear-gradient(90deg,rgba(251,191,36,0.06),rgba(0,0,0,0.4))" : "rgba(2,6,20,0.5)",
      border: `1px solid ${top3 ? "rgba(251,191,36,0.18)" : "rgba(6,182,212,0.08)"}`,
      animationDelay: `${d}ms`,
    }}>
      <div style={{ width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0, background: r === 1 ? "linear-gradient(135deg,#fbbf24,#b45309)" : r === 2 ? "linear-gradient(135deg,#cbd5e1,#64748b)" : r === 3 ? "linear-gradient(135deg,#c2884b,#7c5a2e)" : "rgba(30,41,59,0.7)", color: r <= 3 ? "#000" : "#64748b" }}>{r}</div>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${g ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)"}`, boxShadow: `0 0 8px ${g ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: t.img ? "#0f172a" : avBg(t.username), fontSize: 9, fontWeight: 800, color: "#fff" }}>
        {t.img ? <img src={t.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.username)}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.username}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: g ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>{g ? "+" : "-"}{fmt$(t.pnl)}</div>
      <div style={{ fontSize: 9, fontWeight: 900, padding: "2px 5px", borderRadius: 4, background: g ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: g ? "#10b981" : "#ef4444", border: `1px solid ${g ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}` }}>{mult}x</div>
    </div>
  );
}

/* ── World Map ── */
function WMap({ traders }: { traders: Trader[] }) {
  return (
    <div style={{ position: "relative", height: 320, borderRadius: 10, overflow: "hidden", background: "radial-gradient(ellipse at 30% 25%,rgba(6,182,212,0.06),transparent 50%),radial-gradient(ellipse at 70% 60%,rgba(139,92,246,0.04),transparent 50%),linear-gradient(180deg,#060e1e,#040a14)" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "linear-gradient(rgba(6,182,212,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.4) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
      <CS l="5%" tp="12%" w="22%" ht="30%" br="35% 42% 30% 55%" rgb="6,182,212" />
      <CS l="17%" tp="52%" w="14%" ht="32%" br="30% 55% 45% 35%" rgb="16,185,129" />
      <CS l="40%" tp="8%" w="14%" ht="24%" br="40% 35% 50% 30%" rgb="99,102,241" />
      <CS l="42%" tp="36%" w="16%" ht="38%" br="35% 45% 40% 50%" rgb="245,158,11" />
      <CS l="58%" tp="8%" w="30%" ht="40%" br="30% 40% 45% 35%" rgb="239,68,68" />
      <CS l="76%" tp="58%" w="16%" ht="22%" br="40% 50% 35% 45%" rgb="168,85,247" />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {traders.slice(0, 8).map((t, i) => {
          const n = traders[(i + 1) % Math.min(8, traders.length)];
          if (!n) return null;
          const a = mxy(t.userId), b = mxy(n.userId);
          return <line key={`ln-${t.userId}`} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke="rgba(6,182,212,0.15)" strokeWidth=".5" strokeDasharray="4 4" />;
        })}
        {traders.slice(0, 20).map(t => {
          const p = mxy(t.userId); const g = t.pnl >= 0;
          return (
            <g key={`d-${t.userId}`}>
              <circle cx={`${p.x}%`} cy={`${p.y}%`} r="8" fill={g ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}><animate attributeName="r" values="8;14;8" dur="2.5s" repeatCount="indefinite" /></circle>
              <circle cx={`${p.x}%`} cy={`${p.y}%`} r="3" fill={g ? "#10b981" : "#ef4444"} stroke={g ? "#a7f3d0" : "#fca5a5"} strokeWidth="1"><animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" /></circle>
            </g>
          );
        })}
      </svg>
      {traders.slice(0, 5).map(t => {
        const p = mxy(t.userId); const g = t.pnl >= 0;
        return <div key={`lb-${t.userId}`} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y + 4}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: g ? "#a7f3d0" : "#fca5a5", textShadow: "0 0 8px rgba(0,0,0,.9)", whiteSpace: "nowrap", pointerEvents: "none" }}>{t.username}</div>;
      })}
      {traders.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ color: "#334155", fontSize: 40 }}>🌍</div>
          <div style={{ color: "#475569", fontSize: 13 }}>Trader positions appear here during live events</div>
        </div>
      )}
    </div>
  );
}

function CS({ l, tp, w, ht, br, rgb }: { l: string; tp: string; w: string; ht: string; br: string; rgb: string }) {
  return <div style={{ position: "absolute", left: l, top: tp, width: w, height: ht, borderRadius: br, background: `radial-gradient(ellipse,rgba(${rgb},0.1),rgba(${rgb},0.03) 60%,transparent)`, border: `1px solid rgba(${rgb},0.06)` }} />;
}

function MS({ l, v, i, c }: { l: string; v: string; i: string; c: string }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.1)", background: "rgba(2,6,20,0.5)", padding: "10px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase" }}>{i} {l}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 3 }}>{v}</div>
    </div>
  );
}

function Donut({ w, lo }: { w: number; lo: number }) {
  const t = w + lo || 1;
  const wp = Math.round((w / t) * 100);
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(6,182,212,0.1)", background: "rgba(2,6,20,0.5)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: `conic-gradient(#10b981 0% ${wp}%,#ef4444 ${wp}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#94a3b8" }}>W/L</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>WIN / LOSS</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>{wp}%</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#ef4444" }}>{100 - wp}%</span>
        </div>
      </div>
    </div>
  );
}

function TP({ t, r }: { t: Trader; r: number }) {
  const g = t.pnl >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(6,182,212,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: r <= 3 ? "#fbbf24" : "#64748b", width: 16 }}>{r}.</span>
        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${g ? "#10b981" : "#ef4444"}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: t.img ? "#0f172a" : avBg(t.username), fontSize: 7, fontWeight: 800, color: "#fff" }}>
          {t.img ? <img src={t.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.username)}
        </div>
        <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{t.username}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: g ? "#10b981" : "#ef4444" }}>{g ? "+" : "-"}{fmt$(t.pnl)}</span>
    </div>
  );
}

function RB({ l, n, c, t }: { l: string; n: number; c: string; t: number }) {
  const pct = Math.min(100, Math.round((n / t) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: c, fontWeight: 700 }}>{l}</span>
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{n}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(30,41,59,0.7)", overflow: "hidden" }}>
        <div className="cb-anim" style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${c},${c}aa)`, "--bw": `${pct}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}

function Sep() { return <span style={{ color: "#334155", fontSize: 10 }}>│</span>; }

function BV() {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 18 }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{ display: "inline-block", width: 3, height: 4 + Math.sin(i * 0.8) * 7 + 7, background: "linear-gradient(to top,#10b981,#22d3ee)", borderRadius: 1, opacity: 0.5 + Math.sin(i * 0.6) * 0.3 }} />
      ))}
    </span>
  );
}
