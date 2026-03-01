"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  TrendingUp,
  Camera,
  Moon,
  CalendarOff,
  Sun,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  Zap,
  Globe,
  Bitcoin,
  BarChart3,
  Layers,
  Gem,
  Signal,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetClass = "forex" | "crypto" | "stocks" | "indices" | "commodities";

interface SymbolHealth {
  symbol: string;
  status: "healthy" | "degraded" | "critical" | "market_closed";
  lastUpdate: number;
  staleDuration: number;
  isStale: boolean;
  isAnomaly: boolean;
  source: string;
  lastPrice: number;
  assetClass: AssetClass;
  closedReason?: string;
}

interface Alert {
  id: string;
  type: string;
  severity: "warning" | "error" | "critical";
  symbol?: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface MarketStatusInfo {
  isOpen: boolean;
  reason?: string;
  isHoliday?: boolean;
  holidayName?: string;
  nextOpenDescription?: string;
}

interface PriceHealthData {
  timestamp: string;
  overallStatus: "healthy" | "degraded" | "critical" | "market_closed" | "unknown";
  connectionStatus: "connected" | "reconnecting" | "disconnected" | "unknown";
  reconnectAttempts: number;
  healthyCount: number;
  degradedCount: number;
  criticalCount: number;
  marketClosedCount: number;
  symbols: SymbolHealth[];
  alerts: Alert[];
  message?: string;
  marketStatus?: Record<AssetClass, MarketStatusInfo>;
}

interface SnapshotStatus {
  isRunning: boolean;
  lastSnapshotTime: number;
  snapshotCount: number;
  snapshotInterval: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASS_CONFIG: Record<
  AssetClass,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  forex: { label: "Forex", icon: Globe, color: "text-blue-400", bg: "bg-blue-500" },
  crypto: { label: "Crypto", icon: Bitcoin, color: "text-orange-400", bg: "bg-orange-500" },
  stocks: { label: "Stocks", icon: TrendingUp, color: "text-green-400", bg: "bg-green-500" },
  indices: { label: "Indices", icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500" },
  commodities: { label: "Commodities", icon: Gem, color: "text-amber-400", bg: "bg-amber-500" },
};

const STATUS_CONFIG = {
  healthy: { color: "text-green-400", bg: "bg-green-500", ring: "ring-green-500/30" },
  degraded: { color: "text-yellow-400", bg: "bg-yellow-500", ring: "ring-yellow-500/30" },
  critical: { color: "text-red-400", bg: "bg-red-500", ring: "ring-red-500/30" },
  market_closed: { color: "text-blue-400", bg: "bg-blue-500", ring: "ring-blue-500/30" },
  unknown: { color: "text-gray-400", bg: "bg-gray-500", ring: "ring-gray-500/30" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatPrice(symbol: string, price: number): string {
  if (!price) return "—";
  return price.toFixed(symbol.includes("JPY") ? 3 : 5);
}

function StatusDot({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown;
  const dim = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  return <div className={`${dim} rounded-full ${s.bg} shrink-0`} />;
}

function SourceBadge({ source }: { source: string }) {
  const label = source === "websocket" ? "WS" : source === "rest" ? "REST" : source === "cache" ? "CACHE" : "—";
  const c = source === "websocket" ? "text-green-400 border-green-500/30" : source === "rest" ? "text-blue-400 border-blue-500/30" : "text-gray-500 border-gray-600/30";
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${c}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PriceHealthWidget() {
  const [healthData, setHealthData] = useState<PriceHealthData | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/price-health");
      if (!response.ok) throw new Error("Failed to fetch health data");
      const data = await response.json();
      setHealthData(data.health);
      setSnapshotStatus(data.snapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // ─── Actions ────────────────────────────────────────────────────────

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const r = await fetch("/api/price-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", alertId, acknowledgedBy: "admin" }),
      });
      if (r.ok) { toast.success("Alert acknowledged"); fetchHealth(); }
      else { const d = await r.json().catch(() => ({})); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to acknowledge alert"); }
  };

  const acknowledgeAllAlerts = async () => {
    try {
      const r = await fetch("/api/price-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledgeAll", acknowledgedBy: "admin" }),
      });
      if (r.ok) {
        const d = await r.json();
        toast.success(`${d.acknowledgedCount || 0} alert(s) acknowledged`);
        fetchHealth();
      } else { toast.error("Failed to acknowledge alerts"); }
    } catch { toast.error("Failed to acknowledge alerts"); }
  };

  // ─── Computed data ──────────────────────────────────────────────────

  const { groupedSymbols, unackAlerts, allAlerts, assetClassSummary, totalSymbols } = useMemo(() => {
    const grouped: Record<AssetClass, SymbolHealth[]> = {
      forex: [], crypto: [], stocks: [], indices: [], commodities: [],
    };
    if (healthData?.symbols) {
      for (const sym of healthData.symbols) {
        const g = (sym.assetClass || "forex") as AssetClass;
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(sym);
      }
      const order = { critical: 0, degraded: 1, healthy: 2, market_closed: 3 };
      for (const key of Object.keys(grouped) as AssetClass[]) {
        grouped[key].sort(
          (a, b) => (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4),
        );
      }
    }

    const summary: Record<AssetClass, { total: number; healthy: number; degraded: number; critical: number; closed: number }> = {
      forex: { total: 0, healthy: 0, degraded: 0, critical: 0, closed: 0 },
      crypto: { total: 0, healthy: 0, degraded: 0, critical: 0, closed: 0 },
      stocks: { total: 0, healthy: 0, degraded: 0, critical: 0, closed: 0 },
      indices: { total: 0, healthy: 0, degraded: 0, critical: 0, closed: 0 },
      commodities: { total: 0, healthy: 0, degraded: 0, critical: 0, closed: 0 },
    };
    for (const [ac, syms] of Object.entries(grouped)) {
      const k = ac as AssetClass;
      summary[k].total = syms.length;
      summary[k].healthy = syms.filter((s) => s.status === "healthy").length;
      summary[k].degraded = syms.filter((s) => s.status === "degraded").length;
      summary[k].critical = syms.filter((s) => s.status === "critical").length;
      summary[k].closed = syms.filter((s) => s.status === "market_closed").length;
    }

    return {
      groupedSymbols: grouped,
      unackAlerts: healthData?.alerts?.filter((a) => !a.acknowledged) || [],
      allAlerts: healthData?.alerts || [],
      assetClassSummary: summary,
      totalSymbols: healthData?.symbols?.length || 0,
    };
  }, [healthData]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Rendering ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-8 flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading price health dashboard...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" /> {error}
          </div>
          <Button onClick={fetchHealth} variant="outline" size="sm">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const os = healthData?.overallStatus || "unknown";
  const osCfg = STATUS_CONFIG[os as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown;

  return (
    <div className="space-y-4">
      {/* ════════════════════════ HEADER ════════════════════════ */}
      <Card className="bg-gray-900 border-gray-700 overflow-hidden">
        {/* Top status bar */}
        <div className={`h-1 w-full ${osCfg.bg}`} />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-blue-400" />
              Price Feed Health Dashboard
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Connection status */}
              {healthData?.connectionStatus === "connected" ? (
                <Badge variant="outline" className="text-green-400 border-green-500/30 gap-1">
                  <Wifi className="h-3 w-3" /> Connected
                </Badge>
              ) : healthData?.connectionStatus === "reconnecting" ? (
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Reconnecting
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-400 border-red-500/30 gap-1">
                  <WifiOff className="h-3 w-3" /> Disconnected
                </Badge>
              )}
              {/* Overall status badge */}
              <Badge className={`${osCfg.bg}/20 ${osCfg.color} border ${osCfg.ring} gap-1`}>
                {os === "healthy" && <CheckCircle className="h-3 w-3" />}
                {os === "degraded" && <AlertTriangle className="h-3 w-3" />}
                {os === "critical" && <XCircle className="h-3 w-3" />}
                {os === "market_closed" && <Moon className="h-3 w-3" />}
                {os === "healthy" ? "All Healthy" : os === "market_closed" ? "Markets Closed" : os.charAt(0).toUpperCase() + os.slice(1)}
              </Badge>
              <Button variant="ghost" size="sm" onClick={fetchHealth} className="h-7 px-2" title="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Market closed banner ── */}
          {os === "market_closed" && (
            <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-3 flex items-start gap-3">
              <Moon className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">Markets Are Currently Closed</p>
                <p className="text-xs text-blue-400/70 mt-0.5">
                  {healthData?.marketStatus?.forex?.isHoliday
                    ? `Holiday: ${healthData.marketStatus.forex.holidayName}`
                    : healthData?.marketStatus?.forex?.reason || "Weekend / Off-hours"}
                </p>
                <p className="text-xs text-gray-500 mt-1">No stale alerts will fire until markets reopen.</p>
              </div>
            </div>
          )}

          {/* Holiday warning */}
          {healthData?.marketStatus && os !== "market_closed" && Object.entries(healthData.marketStatus).some(([, ms]) => ms.isHoliday) && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 flex items-start gap-3">
              <CalendarOff className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Holiday Detected</p>
                {Object.entries(healthData.marketStatus).filter(([, ms]) => ms.isHoliday).map(([ac, ms]) => (
                  <p key={ac} className="text-xs text-amber-400/70 mt-0.5">{ac.charAt(0).toUpperCase() + ac.slice(1)}: {ms.holidayName}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── Overview Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-center">
              <CheckCircle className="h-4 w-4 text-green-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-green-400">{healthData?.healthyCount || 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Healthy</div>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-center">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-yellow-400">{healthData?.degradedCount || 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Degraded</div>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-center">
              <XCircle className="h-4 w-4 text-red-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-red-400">{healthData?.criticalCount || 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Critical</div>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
              <Moon className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-blue-400">{healthData?.marketClosedCount || 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mkt Closed</div>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-center">
              <Signal className="h-4 w-4 text-purple-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-purple-400">{totalSymbols}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Monitored</div>
            </div>
          </div>

          {/* ── Snapshot + Connection Bar ── */}
          <div className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Camera className="h-3.5 w-3.5 text-purple-400" />
                Snapshots: <span className={snapshotStatus?.isRunning ? "text-green-400" : "text-red-400"}>{snapshotStatus?.isRunning ? "Active" : "Stopped"}</span>
                {snapshotStatus && <span className="text-gray-600">({snapshotStatus.snapshotCount} taken)</span>}
              </div>
              {healthData?.reconnectAttempts ? (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <Zap className="h-3.5 w-3.5" /> {healthData.reconnectAttempts} reconnect(s)
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : "N/A"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════ ALERTS ════════════════════════ */}
      {allAlerts.length > 0 && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <button onClick={() => toggleSection("alerts")} className="flex items-center gap-2">
                {expandedSections.has("alerts") ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Alerts
                  {unackAlerts.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 h-4">{unackAlerts.length} new</Badge>
                  )}
                </CardTitle>
              </button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={() => setShowAcknowledged(!showAcknowledged)}>
                  {showAcknowledged ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showAcknowledged ? "Hide Ack'd" : "Show All"}
                </Button>
                {unackAlerts.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={acknowledgeAllAlerts}>
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Acknowledge All ({unackAlerts.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSections.has("alerts") && (
            <CardContent className="pt-0">
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(showAcknowledged ? allAlerts : unackAlerts).map((alert) => (
                  <div key={alert.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                    alert.acknowledged ? "bg-gray-800/20 opacity-60" :
                    alert.severity === "critical" ? "bg-red-500/10 border border-red-500/25" :
                    alert.severity === "error" ? "bg-orange-500/10 border border-orange-500/25" :
                    "bg-yellow-500/10 border border-yellow-500/25"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <StatusDot status={alert.severity === "critical" ? "critical" : alert.severity === "error" ? "degraded" : "degraded"} />
                      <span className="text-xs text-gray-300 truncate">{alert.message}</span>
                      {alert.symbol && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{alert.symbol}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      {!alert.acknowledged && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => acknowledgeAlert(alert.id)}>Ack</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ════════════════════════ MARKET SCHEDULE ════════════════════════ */}
      {healthData?.marketStatus && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <button onClick={() => toggleSection("markets")} className="flex items-center gap-2 w-full">
              {expandedSections.has("markets") ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" /> Market Hours Schedule
              </CardTitle>
            </button>
          </CardHeader>
          {expandedSections.has("markets") && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(Object.entries(healthData.marketStatus) as [AssetClass, MarketStatusInfo][]).map(([ac, ms]) => {
                  const cfg = ASSET_CLASS_CONFIG[ac] || ASSET_CLASS_CONFIG.forex;
                  const Icon = cfg.icon;
                  return (
                    <div key={ac} className={`rounded-lg p-3 border ${ms.isOpen ? "bg-green-500/5 border-green-500/20" : ms.isHoliday ? "bg-amber-500/5 border-amber-500/20" : "bg-blue-500/5 border-blue-500/20"}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                        <span className="text-xs font-medium text-gray-300">{cfg.label}</span>
                      </div>
                      <div className={`text-sm font-bold ${ms.isOpen ? "text-green-400" : ms.isHoliday ? "text-amber-400" : "text-blue-400"}`}>
                        {ms.isOpen ? "OPEN" : ms.isHoliday ? "HOLIDAY" : "CLOSED"}
                      </div>
                      {!ms.isOpen && (
                        <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                          {ms.isHoliday ? ms.holidayName : ms.reason || "Off-hours"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ════════════════════════ ASSET CLASS SECTIONS ════════════════════════ */}
      {(Object.entries(groupedSymbols) as [AssetClass, SymbolHealth[]][])
        .filter(([, syms]) => syms.length > 0)
        .map(([ac, symbols]) => {
          const cfg = ASSET_CLASS_CONFIG[ac] || ASSET_CLASS_CONFIG.forex;
          const Icon = cfg.icon;
          const ms = healthData?.marketStatus?.[ac];
          const summary = assetClassSummary[ac];
          const isExpanded = expandedSections.has(ac);

          // Health bar percentages
          const t = summary.total || 1;
          const pHealthy = (summary.healthy / t) * 100;
          const pDegraded = (summary.degraded / t) * 100;
          const pCritical = (summary.critical / t) * 100;
          const pClosed = (summary.closed / t) * 100;

          return (
            <Card key={ac} className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2">
                <button onClick={() => toggleSection(ac)} className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <span className="text-sm font-medium text-gray-200">{cfg.label}</span>
                      <span className="text-xs text-gray-500">({summary.total} pairs)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {ms && !ms.isOpen && (
                        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[10px] px-1.5 py-0 gap-0.5">
                          <Moon className="h-2.5 w-2.5" /> Closed
                        </Badge>
                      )}
                      {ms?.isOpen && summary.healthy === summary.total && (
                        <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[10px] px-1.5 py-0 gap-0.5">
                          <ShieldCheck className="h-2.5 w-2.5" /> All OK
                        </Badge>
                      )}
                      {summary.critical > 0 && (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px] px-1.5 py-0">
                          {summary.critical} critical
                        </Badge>
                      )}
                      {summary.degraded > 0 && (
                        <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/25 text-[10px] px-1.5 py-0">
                          {summary.degraded} degraded
                        </Badge>
                      )}
                      {/* Mini counts */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="text-green-400">{summary.healthy}</span>/
                        <span className="text-yellow-400">{summary.degraded}</span>/
                        <span className="text-red-400">{summary.critical}</span>/
                        <span className="text-blue-400">{summary.closed}</span>
                      </div>
                    </div>
                  </div>
                  {/* Health bar */}
                  <div className="flex h-1 rounded-full overflow-hidden mt-2 bg-gray-800">
                    {pHealthy > 0 && <div className="bg-green-500 transition-all" style={{ width: `${pHealthy}%` }} />}
                    {pDegraded > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${pDegraded}%` }} />}
                    {pCritical > 0 && <div className="bg-red-500 transition-all" style={{ width: `${pCritical}%` }} />}
                    {pClosed > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${pClosed}%` }} />}
                  </div>
                </button>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {/* Market closed info */}
                  {ms && !ms.isOpen && summary.closed === summary.total && (
                    <div className="text-xs text-blue-400/60 bg-blue-500/5 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      {ms.isHoliday ? `Holiday: ${ms.holidayName}` : ms.reason || "Market closed"}
                      {ms.nextOpenDescription ? ` • ${ms.nextOpenDescription}` : ""}
                    </div>
                  )}

                  {/* ── Symbol table header ── */}
                  <div className="grid grid-cols-12 gap-2 px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800 mb-1">
                    <div className="col-span-1">Status</div>
                    <div className="col-span-3">Symbol</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Stale</div>
                    <div className="col-span-2 text-right">Last Update</div>
                    <div className="col-span-2 text-right">Source</div>
                  </div>

                  {/* ── Symbol rows ── */}
                  <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                    {symbols.map((sym) => {
                      const sCfg = STATUS_CONFIG[sym.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown;
                      return (
                        <div key={sym.symbol} className={`grid grid-cols-12 gap-2 items-center rounded px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-800/40 ${
                          sym.status === "critical" ? "bg-red-500/5" : sym.status === "degraded" ? "bg-yellow-500/5" : ""
                        }`}>
                          <div className="col-span-1 flex items-center">
                            <StatusDot status={sym.status} size="md" />
                          </div>
                          <div className="col-span-3 flex items-center gap-1.5">
                            <span className={`font-mono text-xs ${sym.status === "market_closed" ? "text-gray-500" : "text-gray-200"}`}>
                              {sym.symbol}
                            </span>
                            {sym.isAnomaly && (
                              <span className="text-[9px] text-orange-400 bg-orange-500/10 rounded px-1">anomaly</span>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`font-mono text-xs ${sym.status === "market_closed" ? "text-gray-600" : "text-gray-300"}`}>
                              {formatPrice(sym.symbol, sym.lastPrice)}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`text-xs ${sym.status === "market_closed" ? "text-gray-600" : sCfg.color}`}>
                              {sym.status === "market_closed" ? "—" : sym.lastUpdate === 0 ? "never" : formatDuration(sym.staleDuration)}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-[10px] text-gray-500">
                              {sym.status === "market_closed" ? (sym.closedReason || "closed") :
                               sym.lastUpdate === 0 ? "—" : new Date(sym.lastUpdate).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <SourceBadge source={sym.source} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

      {/* ════════════════════════ FOOTER LEGEND ════════════════════════ */}
      <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
        <span>Auto-refresh every 30s</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><StatusDot status="healthy" /> Healthy</span>
          <span className="flex items-center gap-1"><StatusDot status="degraded" /> Degraded</span>
          <span className="flex items-center gap-1"><StatusDot status="critical" /> Critical</span>
          <span className="flex items-center gap-1"><StatusDot status="market_closed" /> Mkt Closed</span>
        </div>
      </div>

      {healthData?.message && (
        <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2.5 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 shrink-0" /> {healthData.message}
        </div>
      )}
    </div>
  );
}
