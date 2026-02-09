"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

interface SymbolHealth {
  symbol: string;
  status: "healthy" | "degraded" | "critical";
  lastUpdate: number;
  staleDuration: number;
  isStale: boolean;
  isAnomaly: boolean;
  source: string;
  lastPrice: number;
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

interface PriceHealthData {
  timestamp: string;
  overallStatus: "healthy" | "degraded" | "critical" | "unknown";
  connectionStatus: "connected" | "reconnecting" | "disconnected" | "unknown";
  reconnectAttempts: number;
  healthyCount: number;
  degradedCount: number;
  criticalCount: number;
  symbols: SymbolHealth[];
  alerts: Alert[];
  message?: string;
}

interface SnapshotStatus {
  isRunning: boolean;
  lastSnapshotTime: number;
  snapshotCount: number;
  snapshotInterval: number;
}

export default function PriceHealthWidget() {
  const [healthData, setHealthData] = useState<PriceHealthData | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

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

    // Poll every 30 seconds — health status doesn't change rapidly
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      // Use the admin's API which proxies to the main app securely
      const response = await fetch("/api/price-health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Degraded
          </Badge>
        );
      case "critical":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Critical
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            Unknown
          </Badge>
        );
    }
  };

  const getConnectionIcon = () => {
    if (!healthData) return <WifiOff className="h-5 w-5 text-gray-500" />;

    switch (healthData.connectionStatus) {
      case "connected":
        return <Wifi className="h-5 w-5 text-green-500" />;
      case "reconnecting":
        return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
      case "disconnected":
        return <WifiOff className="h-5 w-5 text-red-500" />;
      default:
        return <WifiOff className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const unacknowledgedAlerts =
    healthData?.alerts.filter((a) => !a.acknowledged) || [];

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
          <Button
            onClick={fetchHealth}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Price Feed Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {getConnectionIcon()}
            {healthData && getStatusBadge(healthData.overallStatus)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {healthData?.healthyCount || 0}
            </div>
            <div className="text-xs text-gray-500">Healthy</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {healthData?.degradedCount || 0}
            </div>
            <div className="text-xs text-gray-500">Degraded</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {healthData?.criticalCount || 0}
            </div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {healthData?.reconnectAttempts || 0}
            </div>
            <div className="text-xs text-gray-500">Reconnects</div>
          </div>
        </div>

        {/* Snapshot Status */}
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
                  {formatDuration(Date.now() - snapshotStatus.lastSnapshotTime)}{" "}
                  ago
                </span>
              )}
            </div>
          </div>
        )}

        {/* Alerts */}
        {unacknowledgedAlerts.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {unacknowledgedAlerts.length} Unacknowledged Alert
                {unacknowledgedAlerts.length > 1 ? "s" : ""}
              </span>
              <span className="text-gray-500 text-xs">
                {showAlerts ? "Hide" : "Show"}
              </span>
            </button>

            {showAlerts && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {unacknowledgedAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2 rounded-lg text-sm flex items-start justify-between gap-2 ${
                      alert.severity === "critical"
                        ? "bg-red-500/10 border border-red-500/30"
                        : alert.severity === "error"
                          ? "bg-orange-500/10 border border-orange-500/30"
                          : "bg-yellow-500/10 border border-yellow-500/30"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-200">
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                        {alert.symbol && ` • ${alert.symbol}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="shrink-0"
                    >
                      Ack
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Symbol List */}
        <div className="space-y-2">
          <button
            onClick={() => setShowAllSymbols(!showAllSymbols)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Symbol Status
            </span>
            <span className="text-gray-500 text-xs">
              {showAllSymbols ? "Hide" : "Show"}
            </span>
          </button>

          {showAllSymbols && healthData?.symbols && (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {healthData.symbols.map((symbol) => (
                <div
                  key={symbol.symbol}
                  className="flex items-center justify-between bg-gray-800/30 rounded px-2 py-1"
                >
                  <span className="text-sm text-gray-300">{symbol.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {symbol.lastPrice.toFixed(
                        symbol.symbol.includes("JPY") ? 3 : 5,
                      )}
                    </span>
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(symbol.status)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Update */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated:{" "}
            {healthData?.timestamp
              ? new Date(healthData.timestamp).toLocaleTimeString()
              : "N/A"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealth}
            className="h-6 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Message if data unavailable */}
        {healthData?.message && (
          <div className="text-xs text-amber-400 bg-amber-500/10 rounded p-2">
            {healthData.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
