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
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === "healthy"
      ? "bg-green-500"
      : status === "degraded"
        ? "bg-yellow-500"
        : status === "critical"
          ? "bg-red-500"
          : status === "market_closed"
            ? "bg-blue-500"
            : "bg-gray-500";
  return <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function StatBox({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PriceHealthWidget() {
  const [healthData, setHealthData] = useState<PriceHealthData | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch("/api/price-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge",
          alertId,
          acknowledgedBy: "admin",
        }),
      });

      if (response.ok) {
        toast.success("Alert acknowledged");
        fetchHealth();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to acknowledge alert");
      }
    } catch {
      toast.error("Failed to acknowledge alert");
    }
  };

  // ─── Grouped symbol data ──────────────────────────────────────────────

  const { groupedSymbols, unacknowledgedAlerts, forexStatus } = useMemo(() => {
    const grouped: Record<string, SymbolHealth[]> = {};
    if (healthData?.symbols) {
      for (const sym of healthData.symbols) {
        const group = sym.assetClass || "forex";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(sym);
      }
      // Sort each group: critical first, then degraded, healthy, market_closed
      const order = { critical: 0, degraded: 1, healthy: 2, market_closed: 3 };
      for (const key of Object.keys(grouped)) {
        grouped[key].sort(
          (a, b) =>
            (order[a.status as keyof typeof order] ?? 4) -
            (order[b.status as keyof typeof order] ?? 4),
        );
      }
    }

    const forex = healthData?.marketStatus?.forex ?? { isOpen: true };

    return {
      groupedSymbols: grouped,
      unacknowledgedAlerts:
        healthData?.alerts?.filter((a) => !a.acknowledged) || [],
      forexStatus: forex,
    };
  }, [healthData]);

  const toggle = (section: string) =>
    setExpandedSection((prev) => (prev === section ? null : section));

  // ─── Formatting helpers ───────────────────────────────────────────────

  const formatDuration = (ms: number) => {
    if (!isFinite(ms) || ms < 0) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    return `${(ms / 3_600_000).toFixed(1)}h`;
  };

  const formatPrice = (symbol: string, price: number) => {
    if (!price) return "—";
    return price.toFixed(symbol.includes("JPY") ? 3 : 5);
  };

  const getOverallStatusBadge = () => {
    if (!healthData) return null;
    const s = healthData.overallStatus;
    if (s === "healthy")
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          All Healthy
        </Badge>
      );
    if (s === "degraded")
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Degraded
        </Badge>
      );
    if (s === "critical")
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          Critical
        </Badge>
      );
    if (s === "market_closed")
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Moon className="h-3 w-3 mr-1" />
          Markets Closed
        </Badge>
      );
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        Unknown
      </Badge>
    );
  };

  const getConnectionBadge = () => {
    if (!healthData) return null;
    const cs = healthData.connectionStatus;
    if (cs === "connected")
      return (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <Wifi className="h-3.5 w-3.5" /> Connected
        </span>
      );
    if (cs === "reconnecting")
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Reconnecting
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <WifiOff className="h-3.5 w-3.5" /> Disconnected
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading price health data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
          <Button onClick={fetchHealth} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header Card ── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Price Feed Health Monitor
            </CardTitle>
            <div className="flex items-center gap-3">
              {getConnectionBadge()}
              {getOverallStatusBadge()}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHealth}
                className="h-7 px-2"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Market Status Banner ── */}
          {healthData?.overallStatus === "market_closed" && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
              <Moon className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">
                  Markets Are Currently Closed
                </p>
                <p className="text-xs text-blue-400/70 mt-0.5">
                  {forexStatus.isHoliday
                    ? `Holiday: ${forexStatus.holidayName}`
                    : forexStatus.reason || "Weekend / Off-hours"}
                  {forexStatus.nextOpenDescription &&
                    ` • ${forexStatus.nextOpenDescription}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  All symbols marked as &quot;Market Closed&quot; — no stale
                  alerts will fire until the market reopens.
                </p>
              </div>
            </div>
          )}

          {/* Holiday warning when market is open but a holiday affects some assets */}
          {healthData?.marketStatus &&
            Object.entries(healthData.marketStatus).some(
              ([, ms]) => ms.isHoliday,
            ) &&
            healthData.overallStatus !== "market_closed" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
                <CalendarOff className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    Holiday Detected
                  </p>
                  {Object.entries(healthData.marketStatus)
                    .filter(([, ms]) => ms.isHoliday)
                    .map(([ac, ms]) => (
                      <p key={ac} className="text-xs text-amber-400/70 mt-0.5">
                        {ac.charAt(0).toUpperCase() + ac.slice(1)}:{" "}
                        {ms.holidayName}
                      </p>
                    ))}
                </div>
              </div>
            )}

          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-5 gap-3">
            <StatBox
              label="Healthy"
              value={healthData?.healthyCount || 0}
              color="text-green-400"
              icon={CheckCircle}
            />
            <StatBox
              label="Degraded"
              value={healthData?.degradedCount || 0}
              color="text-yellow-400"
              icon={AlertTriangle}
            />
            <StatBox
              label="Critical"
              value={healthData?.criticalCount || 0}
              color="text-red-400"
              icon={XCircle}
            />
            <StatBox
              label="Mkt Closed"
              value={healthData?.marketClosedCount || 0}
              color="text-blue-400"
              icon={Moon}
            />
            <StatBox
              label="Reconnects"
              value={healthData?.reconnectAttempts || 0}
              color="text-purple-400"
              icon={RefreshCw}
            />
          </div>

          {/* ── Snapshot Status ── */}
          {snapshotStatus && (
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-300">Price Snapshots</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={
                    snapshotStatus.isRunning ? "text-green-400" : "text-red-400"
                  }
                >
                  {snapshotStatus.isRunning ? "Running" : "Stopped"}
                </span>
                <span className="text-gray-500">
                  {snapshotStatus.snapshotCount} snapshots
                </span>
                {snapshotStatus.lastSnapshotTime > 0 && (
                  <span className="text-gray-500">
                    Last:{" "}
                    {formatDuration(
                      Date.now() - snapshotStatus.lastSnapshotTime,
                    )}{" "}
                    ago
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Alerts Card ── */}
      {unacknowledgedAlerts.length > 0 && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <button
              onClick={() => toggle("alerts")}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {unacknowledgedAlerts.length} Unacknowledged Alert
                {unacknowledgedAlerts.length > 1 ? "s" : ""}
              </CardTitle>
              {expandedSection === "alerts" ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </CardHeader>
          {expandedSection === "alerts" && (
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unacknowledgedAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2.5 rounded-lg text-sm flex items-start justify-between gap-2 ${
                      alert.severity === "critical"
                        ? "bg-red-500/10 border border-red-500/30"
                        : alert.severity === "error"
                          ? "bg-orange-500/10 border border-orange-500/30"
                          : "bg-yellow-500/10 border border-yellow-500/30"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200 truncate">
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.timestamp).toLocaleTimeString()}
                        {alert.symbol && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0"
                          >
                            {alert.symbol}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 ${
                            alert.severity === "critical"
                              ? "text-red-400 border-red-500/40"
                              : alert.severity === "error"
                                ? "text-orange-400 border-orange-500/40"
                                : "text-yellow-400 border-yellow-500/40"
                          }`}
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="shrink-0 h-7 text-xs"
                    >
                      Acknowledge
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Market Schedule Card ── */}
      {healthData?.marketStatus && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <button
              onClick={() => toggle("markets")}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Market Schedule Status
              </CardTitle>
              {expandedSection === "markets" ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </CardHeader>
          {expandedSection === "markets" && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(
                  Object.entries(healthData.marketStatus) as [
                    AssetClass,
                    MarketStatusInfo,
                  ][]
                ).map(([ac, ms]) => (
                  <div
                    key={ac}
                    className={`rounded-lg p-3 border ${
                      ms.isOpen
                        ? "bg-green-500/5 border-green-500/20"
                        : ms.isHoliday
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-300 capitalize">
                        {ac}
                      </span>
                      {ms.isOpen ? (
                        <Sun className="h-3.5 w-3.5 text-green-400" />
                      ) : ms.isHoliday ? (
                        <CalendarOff className="h-3.5 w-3.5 text-amber-400" />
                      ) : (
                        <Moon className="h-3.5 w-3.5 text-blue-400" />
                      )}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        ms.isOpen ? "text-green-400" : "text-blue-400"
                      }`}
                    >
                      {ms.isOpen ? "OPEN" : "CLOSED"}
                    </div>
                    {!ms.isOpen && ms.reason && (
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                        {ms.isHoliday ? ms.holidayName : ms.reason}
                      </div>
                    )}
                    {ms.nextOpenDescription && (
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {ms.nextOpenDescription}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Symbol Details Card ── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-2">
          <button
            onClick={() => toggle("symbols")}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Symbol Status ({healthData?.symbols?.length || 0} monitored)
            </CardTitle>
            {expandedSection === "symbols" ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </CardHeader>
        {expandedSection === "symbols" && healthData?.symbols && (
          <CardContent className="pt-0 space-y-4">
            {Object.entries(groupedSymbols).map(([assetClass, symbols]) => {
              const ac = assetClass as AssetClass;
              const ms = healthData.marketStatus?.[ac];
              const acHealthy = symbols.filter(
                (s) => s.status === "healthy",
              ).length;
              const acCritical = symbols.filter(
                (s) => s.status === "critical",
              ).length;
              const acClosed = symbols.filter(
                (s) => s.status === "market_closed",
              ).length;

              return (
                <div key={assetClass}>
                  {/* Asset class header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {assetClass}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      ({symbols.length} symbols)
                    </span>
                    {ms && !ms.isOpen && (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[10px] px-1.5 py-0">
                        <Moon className="h-2.5 w-2.5 mr-0.5" />
                        Closed
                      </Badge>
                    )}
                    {ms && ms.isOpen && acHealthy === symbols.length && (
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[10px] px-1.5 py-0">
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                        All OK
                      </Badge>
                    )}
                    {acCritical > 0 && (
                      <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px] px-1.5 py-0">
                        {acCritical} critical
                      </Badge>
                    )}
                  </div>

                  {/* Market closed info for this asset class */}
                  {acClosed === symbols.length && ms && !ms.isOpen && (
                    <div className="text-xs text-blue-400/60 bg-blue-500/5 rounded px-2 py-1.5 mb-2 flex items-center gap-1.5">
                      <Info className="h-3 w-3 shrink-0" />
                      {ms.isHoliday
                        ? `Holiday: ${ms.holidayName}`
                        : ms.reason || "Market closed"}{" "}
                      {ms.nextOpenDescription
                        ? `• ${ms.nextOpenDescription}`
                        : ""}
                    </div>
                  )}

                  {/* Symbol grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {symbols.map((sym) => (
                      <div
                        key={sym.symbol}
                        className={`flex items-center justify-between rounded px-2.5 py-1.5 text-sm ${
                          sym.status === "critical"
                            ? "bg-red-500/10 border border-red-500/20"
                            : sym.status === "degraded"
                              ? "bg-yellow-500/10 border border-yellow-500/20"
                              : sym.status === "market_closed"
                                ? "bg-gray-800/30 border border-gray-700/30"
                                : "bg-gray-800/30 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot status={sym.status} />
                          <span
                            className={`font-mono text-xs ${
                              sym.status === "market_closed"
                                ? "text-gray-500"
                                : "text-gray-300"
                            }`}
                          >
                            {sym.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs font-mono ${
                              sym.status === "market_closed"
                                ? "text-gray-600"
                                : "text-gray-400"
                            }`}
                          >
                            {formatPrice(sym.symbol, sym.lastPrice)}
                          </span>
                          <span className="text-[10px] text-gray-600 w-12 text-right">
                            {sym.status === "market_closed"
                              ? "closed"
                              : sym.lastUpdate === 0
                                ? "never"
                                : formatDuration(sym.staleDuration)}
                          </span>
                          <span className="text-[10px] text-gray-600 w-8 text-right">
                            {sym.source === "websocket"
                              ? "WS"
                              : sym.source === "rest"
                                ? "REST"
                                : sym.source === "cache"
                                  ? "Cache"
                                  : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-xs text-gray-600 px-1">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last updated:{" "}
          {healthData?.timestamp
            ? new Date(healthData.timestamp).toLocaleTimeString()
            : "N/A"}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <StatusDot status="healthy" />{" "}
            <span className="text-gray-500">Healthy</span>
          </span>
          <span className="flex items-center gap-1">
            <StatusDot status="degraded" />{" "}
            <span className="text-gray-500">Degraded</span>
          </span>
          <span className="flex items-center gap-1">
            <StatusDot status="critical" />{" "}
            <span className="text-gray-500">Critical</span>
          </span>
          <span className="flex items-center gap-1">
            <StatusDot status="market_closed" />{" "}
            <span className="text-gray-500">Mkt Closed</span>
          </span>
        </div>
      </div>

      {/* Info message if present */}
      {healthData?.message && (
        <div className="text-xs text-amber-400 bg-amber-500/10 rounded p-2">
          {healthData.message}
        </div>
      )}
    </div>
  );
}
