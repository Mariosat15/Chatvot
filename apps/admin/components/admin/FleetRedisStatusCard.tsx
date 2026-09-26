"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import type {
  FleetRedisServerRow,
  FleetRedisSummary,
} from "@/lib/admin/fleet-redis-status";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

type FleetStatusResponse = {
  servers: FleetRedisServerRow[];
  summary: FleetRedisSummary;
  error?: string;
};

/**
 * Shows each fleet server's last Redis PING result from its heartbeat.
 * Refresh re-reads Mongo — it does not SSH into boxes or force a live re-ping
 * (the next heartbeat, ~30s, is the live re-check).
 */
export default function FleetRedisStatusCard() {
  const [rows, setRows] = useState<FleetRedisServerRow[]>([]);
  const [summary, setSummary] = useState<FleetRedisSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/redis-settings/fleet-status");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | FleetStatusResponse
          | null;
        setError(body?.error || `Failed to load fleet status (${response.status})`);
        setRows([]);
        setSummary(null);
        return;
      }
      const data = (await response.json()) as FleetStatusResponse;
      setRows(data.servers ?? []);
      setSummary(data.summary ?? null);
    } catch {
      setError("Failed to load fleet Redis status");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(
      () => void fetchStatus(),
      PERFORMANCE_INTERVALS.REDIS_STATS,
    );
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Server className="h-5 w-5 text-cyan-400" />
            Fleet Redis Checks
          </CardTitle>
          <CardDescription className="mt-1">
            Each server reports Redis from its own heartbeat (PING every ~30s).
            Same signal as Dev Zone → Server Fleet.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchStatus()}
            disabled={loading}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          <Link
            href="/dashboard?activeTab=server-fleet"
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            Server Fleet
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && summary.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryPill label="Servers" value={summary.total} tone="neutral" />
            <SummaryPill label="Redis OK" value={summary.redisOk} tone="good" />
            <SummaryPill
              label="Redis fail"
              value={summary.redisFail}
              tone={summary.redisFail > 0 ? "bad" : "neutral"}
            />
            <SummaryPill
              label="Offline"
              value={summary.offline}
              tone={summary.offline > 0 ? "bad" : "neutral"}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {!error && !loading && rows.length === 0 && (
          <p className="text-sm text-gray-400">
            No servers registered yet. They appear here automatically when an app
            server starts with <code className="text-gray-300">SERVER_ID</code>{" "}
            set and begins heartbeating.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.serverId}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {row.hostname}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        row.role === "primary"
                          ? "border-blue-500/50 text-blue-300"
                          : "border-purple-500/50 text-purple-300"
                      }
                    >
                      {row.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "online"
                          ? "border-green-500/50 text-green-300"
                          : row.status === "degraded"
                            ? "border-yellow-500/50 text-yellow-300"
                            : "border-red-500/50 text-red-300"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {row.domain || row.serverId}
                    {" · "}
                    heartbeat {formatAge(row.timeSinceHeartbeatSeconds)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.status !== "offline" && row.redisConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">Redis OK</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-400">
                        {row.status === "offline"
                          ? "Server offline"
                          : "Redis not connected"}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good"
      ? "text-green-400 border-green-700/50"
      : tone === "bad"
        ? "text-red-400 border-red-700/50"
        : "text-white border-gray-700";
  return (
    <div className={`rounded-lg border bg-gray-900/40 px-3 py-2 ${color}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}
