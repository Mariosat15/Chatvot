"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ApiParticipant {
  userId: string;
  username: string;
  profileImage?: string | null;
  livePnl?: number;
  liveRoi?: number;
  liveEquity?: number;
  totalTrades?: number;
  winRate?: number;
  maxDrawdownPercentage?: number;
  rank?: number;
}

interface ApiEvent {
  id: string;
  status: string;
  endTime?: string;
  participants?: ApiParticipant[];
  openPositions?: Array<{ leverage?: number; quantity?: number }>;
}

interface ApiDashboardResponse {
  competitions?: ApiEvent[];
  challenges?: ApiEvent[];
  stats?: {
    totalPrizePool?: number;
    activePlayers?: number;
  };
}

interface TraderRow {
  userId: string;
  username: string;
  profileImage?: string | null;
  pnl: number;
  roi: number;
  equity: number;
  totalTrades: number;
  winRate: number;
  drawdown: number;
}

function formatCurrency(value: number) {
  return `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function hashToUnit(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function deriveMapPosition(userId: string) {
  const x = 8 + hashToUnit(userId) * 84;
  const y = 12 + hashToUnit(`${userId}-map`) * 74;
  return { x, y };
}

function severityFromDrawdown(drawdown: number) {
  if (drawdown < 5) return "low";
  if (drawdown < 15) return "medium";
  return "high";
}

export default function TraderChampionshipClient() {
  const [data, setData] = useState<ApiDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard/competitions", {
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const next = (await res.json()) as ApiDashboardResponse;
        setData(next);
        setLoading(false);
      } catch {
        if (alive) setLoading(false);
      }
    };

    const startPolling = () => {
      fetchData();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(fetchData, 3000);
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const {
    topTraders,
    activeEvents,
    activeTraders,
    totalPrizePool,
    totalTrades,
    volumeLots,
    countdown,
    riskCounts,
  } = useMemo(() => {
    const comps = data?.competitions || [];
    const challs = data?.challenges || [];
    const active = [...comps, ...challs].filter((e) => e.status === "active");

    const map = new Map<string, TraderRow>();
    let allTrades = 0;
    let lots = 0;
    let low = 0;
    let medium = 0;
    let high = 0;

    for (const ev of active) {
      (ev.openPositions || []).forEach((p) => {
        lots += p.quantity || 0;
      });

      (ev.participants || []).forEach((p) => {
        const row: TraderRow = {
          userId: p.userId,
          username: p.username || "Trader",
          profileImage: p.profileImage || null,
          pnl: p.livePnl || 0,
          roi: p.liveRoi || 0,
          equity: p.liveEquity || 0,
          totalTrades: p.totalTrades || 0,
          winRate: p.winRate || 0,
          drawdown: p.maxDrawdownPercentage || 0,
        };
        allTrades += row.totalTrades;

        const risk = severityFromDrawdown(row.drawdown);
        if (risk === "low") low += 1;
        else if (risk === "medium") medium += 1;
        else high += 1;

        const current = map.get(row.userId);
        if (!current || row.pnl > current.pnl) {
          map.set(row.userId, row);
        }
      });
    }

    const leaders = Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
    const nextEnd = active
      .map((e) => (e.endTime ? new Date(e.endTime).getTime() : 0))
      .filter((n) => n > Date.now())
      .sort((a, b) => a - b)[0];

    let countdownLabel = "LIVE";
    if (nextEnd) {
      const diff = Math.max(0, nextEnd - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdownLabel = `${h.toString().padStart(2, "0")}:${m
        .toString()
        .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }

    return {
      topTraders: leaders.slice(0, 12),
      activeEvents: active.length,
      activeTraders: map.size || data?.stats?.activePlayers || 0,
      totalPrizePool: data?.stats?.totalPrizePool || 0,
      totalTrades: allTrades,
      volumeLots: Number(lots.toFixed(2)),
      countdown: countdownLabel,
      riskCounts: { low, medium, high },
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-cyan-300">
        Loading championship view...
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-2xl border border-cyan-500/25 bg-[radial-gradient(circle_at_top,#10254f_0%,#040a18_45%,#02050e_100%)] text-white p-3 md:p-5">
      <div className="rounded-2xl border border-cyan-400/35 bg-black/35 backdrop-blur px-4 py-3 mb-4">
        <div className="text-center text-xs uppercase tracking-[0.35em] text-cyan-200/80">
          Global Trader Championship
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCard label="Total Prize Pool" value={formatCurrency(totalPrizePool)} accent="text-amber-300" />
          <StatCard label="Active Traders" value={String(activeTraders)} accent="text-cyan-200" />
          <StatCard label="Live Events" value={String(activeEvents)} accent="text-violet-300" />
          <StatCard label="Round Timer" value={countdown} accent="text-orange-300" />
          <StatCard label="Volume (Lots)" value={volumeLots.toLocaleString()} accent="text-emerald-300" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px,1fr,290px] gap-4">
        <div className="rounded-2xl border border-cyan-500/25 bg-black/35 p-3">
          <h3 className="text-sm font-semibold tracking-wide text-cyan-200 mb-3">Leaderboard</h3>
          <div className="space-y-2">
            {topTraders.slice(0, 10).map((trader, idx) => (
              <TraderRowItem key={trader.userId} trader={trader} rank={idx + 1} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/25 bg-black/35 p-3">
          <h3 className="text-sm font-semibold tracking-wide text-cyan-200 mb-2">Live Trader Map</h3>
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-cyan-400/25 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,255,0.2),transparent_35%),radial-gradient(circle_at_75%_65%,rgba(244,63,94,0.18),transparent_30%),linear-gradient(120deg,#081224,#040915)]">
            <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "linear-gradient(rgba(125,211,252,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.12) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
            <div className="absolute left-[7%] top-[20%] w-[28%] h-[32%] rounded-[48%] bg-cyan-400/12 blur-[1px]" />
            <div className="absolute left-[36%] top-[14%] w-[24%] h-[35%] rounded-[40%] bg-blue-500/14 blur-[1px]" />
            <div className="absolute left-[62%] top-[18%] w-[30%] h-[38%] rounded-[42%] bg-red-400/14 blur-[1px]" />
            <div className="absolute left-[42%] top-[53%] w-[18%] h-[24%] rounded-[46%] bg-emerald-400/12 blur-[1px]" />
            {topTraders.slice(0, 18).map((t) => {
              const pos = deriveMapPosition(t.userId);
              const gain = t.pnl >= 0;
              return (
                <div
                  key={`${t.userId}-map`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div className={`w-8 h-8 rounded-full border ${gain ? "border-emerald-300/90 shadow-[0_0_20px_rgba(16,185,129,0.65)]" : "border-rose-300/90 shadow-[0_0_20px_rgba(244,63,94,0.6)]"} bg-slate-900/90`} />
                  <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap ${gain ? "text-emerald-300" : "text-rose-300"}`}>
                    {t.username}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <BottomStat label="Trades Today" value={totalTrades.toLocaleString()} accent="text-cyan-200" />
            <BottomStat label="Total Volume" value={`${volumeLots.toLocaleString()} lots`} accent="text-emerald-300" />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/25 bg-black/35 p-3 space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-cyan-200">Top Performers</h3>
          <div className="space-y-2">
            {topTraders.slice(0, 5).map((trader, idx) => (
              <div key={`${trader.userId}-top`} className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-slate-900/70 px-2 py-2">
                <div className="text-sm text-slate-200">{idx + 1}. {trader.username}</div>
                <div className={`text-sm font-semibold ${trader.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {trader.pnl >= 0 ? "+" : "-"}{formatCurrency(trader.pnl)}
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold tracking-wide text-cyan-200 pt-1">Risk Level</h3>
          <RiskBar label="Low" value={riskCounts.low} color="bg-emerald-400" />
          <RiskBar label="Medium" value={riskCounts.medium} color="bg-amber-400" />
          <RiskBar label="High" value={riskCounts.high} color="bg-rose-400" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl md:text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function TraderRowItem({ trader, rank }: { trader: TraderRow; rank: number }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/75 p-2">
      <div className="flex items-center justify-between">
        <div className="text-slate-200 text-sm">{`#${rank} ${trader.username}`}</div>
        <div className={`text-sm font-semibold ${trader.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {trader.pnl >= 0 ? "+" : "-"}{formatCurrency(trader.pnl)}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-slate-300">
        <span>ROI {trader.roi.toFixed(1)}%</span>
        <span>WR {trader.winRate.toFixed(1)}%</span>
        <span>{trader.totalTrades} trades</span>
      </div>
    </div>
  );
}

function BottomStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-3 py-2">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-2 py-2">
      <div className="flex justify-between text-xs text-slate-200">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 rounded bg-slate-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value * 10)}%` }} />
      </div>
    </div>
  );
}
