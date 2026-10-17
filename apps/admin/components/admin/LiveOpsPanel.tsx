"use client";

/**
 * LiveOpsPanel — admin-only live operations monitor.
 *
 * Shows four real-time streams:
 *   - Deposits (latest 50)
 *   - Withdrawals (latest 50)
 *   - Online users (IP/geo/page/session)
 *   - Security alerts (unacknowledged)
 *
 * Load strategy (must not create extra server load):
 *   - ONE HTTP poll every 5s hits a single aggregate endpoint
 *     (`/api/live-ops`) that runs four indexed MongoDB reads in parallel.
 *   - Polling pauses when the tab is hidden (`document.hidden`).
 *   - Paused tabs never fire requests — idle admins = zero cost.
 *   - No persistent connections (no SSE/WS), so no socket bookkeeping.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Globe2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 5000;

interface DepositEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string;
  paymentMethod?: string;
  providerTransactionId?: string;
  failureReason?: string;
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  cardLast4?: string;
  classification?: string;
  createdAt: string;
}

interface WithdrawalEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string;
  paymentMethod?: string;
  destination?: string;
  approvalStatus?: string;
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  failureReason?: string;
  createdAt: string;
}

interface OnlineUserEntry {
  userId: string;
  userName?: string;
  userEmail?: string;
  status: string;
  currentPage?: string;
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  userAgent?: string;
  isInCompetition?: boolean;
  isInChallenge?: boolean;
  lastHeartbeat?: string;
}

interface SecurityAlertEntry {
  id: string;
  alertType: string;
  severity: string;
  source: string;
  provider?: string;
  ip?: string;
  userId?: string;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
}

interface LiveOpsPayload {
  success: boolean;
  generatedAt?: string;
  deposits: DepositEntry[];
  withdrawals: WithdrawalEntry[];
  onlineUsers: OnlineUserEntry[];
  securityAlerts: SecurityAlertEntry[];
  counts?: {
    deposits: number;
    withdrawals: number;
    onlineUsers: number;
    securityAlerts: number;
  };
}

function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  } catch {
    return `${(value ?? 0).toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffS = Math.round((Date.now() - t) / 1000);
  if (diffS < 5) return "just now";
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.round(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.round(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

function statusBadgeClasses(status: string): string {
  const s = status?.toLowerCase() ?? "";
  if (s === "completed") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (s === "pending") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (s === "failed" || s === "cancelled")
    return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "disputed")
    return "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function formatGeoInline(
  city?: string,
  region?: string,
  country?: string,
): string | undefined {
  const parts = [city, region, country].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function severityBadgeClasses(severity: string): string {
  const s = severity?.toLowerCase() ?? "";
  if (s === "critical") return "bg-red-600/30 text-red-300 border-red-600/50";
  if (s === "high") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "medium") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (s === "low") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

export default function LiveOpsPanel() {
  const [data, setData] = useState<LiveOpsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic-dismiss state so the row disappears immediately on click
  // even before the next poll completes. `undoing` marks a row that's
  // currently being acknowledged so we can show a spinner + lock the button.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchLive = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/live-ops", {
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        setError("Unauthorized");
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as LiveOpsPayload;
      setData(json);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Schedule polling with visibility gating.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (!paused && !document.hidden) {
        await fetchLive();
      }
      if (cancelled) return;
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Initial load immediately.
    tick();

    const onVisibilityChange = () => {
      if (document.hidden) return;
      // Refresh right away when the tab becomes visible again.
      fetchLive();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchLive, paused]);

  // Reason: derive slices via useMemo so they keep stable refs across
  // renders (otherwise react-hooks/exhaustive-deps complains about the
  // derived-memos below).
  const deposits = useMemo(() => data?.deposits ?? [], [data]);
  const withdrawals = useMemo(() => data?.withdrawals ?? [], [data]);
  const onlineUsers = useMemo(() => data?.onlineUsers ?? [], [data]);
  // Hide optimistically-dismissed alerts until the server confirms.
  // On the next successful poll, the backend will no longer return them
  // (they're acknowledged=true and GET filters those out by default).
  const securityAlerts = useMemo(
    () =>
      (data?.securityAlerts ?? []).filter((a) => !dismissedIds.has(a.id)),
    [data, dismissedIds],
  );

  // Prune the dismissedIds set once the server confirms an alert is gone
  // from the feed — keeps the set small across long-lived sessions.
  useEffect(() => {
    if (dismissedIds.size === 0) return;
    const stillPresent = new Set(
      (data?.securityAlerts ?? []).map((a) => a.id),
    );
    let changed = false;
    const next = new Set<string>();
    for (const id of dismissedIds) {
      if (stillPresent.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    }
    if (changed) setDismissedIds(next);
  }, [data, dismissedIds]);

  const ackAlert = useCallback(async (id: string) => {
    setDismissingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/security/alerts", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertId: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setDismissedIds((prev) => new Set(prev).add(id));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Failed to dismiss alert: ${err.message}`
          : "Failed to dismiss alert. Please contact support.",
      );
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const ackAllVisible = useCallback(async () => {
    const ids = securityAlerts.map((a) => a.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      // Fire concurrently but bounded — 30 rows max. The API is a tiny
      // findByIdAndUpdate, so load is trivial.
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch("/api/security/alerts", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ alertId: id }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return id;
        }),
      );
      const okIds = new Set<string>();
      let failed = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          okIds.add(r.value);
        } else {
          failed += 1;
        }
      }
      if (okIds.size > 0) {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          okIds.forEach((id) => next.add(id));
          return next;
        });
      }
      if (failed > 0) {
        toast.error(
          `${okIds.size} dismissed, ${failed} failed. Please contact support.`,
        );
      } else {
        toast.success(`${okIds.size} alerts dismissed.`);
      }
    } finally {
      setBulkBusy(false);
    }
  }, [securityAlerts]);

  const onlineCount = useMemo(
    () => onlineUsers.filter((u) => u.status === "online").length,
    [onlineUsers],
  );

  const criticalAlerts = useMemo(
    () =>
      securityAlerts.filter((a) => {
        const s = a.severity?.toLowerCase();
        return s === "critical" || s === "high";
      }).length,
    [securityAlerts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Live Operations
            {!error ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full border",
                  paused
                    ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                )}
              >
                {paused ? (
                  <>
                    <WifiOff className="w-3 h-3" /> Paused
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3" /> Live
                  </>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/30">
                <WifiOff className="w-3 h-3" /> {error}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Polls every {POLL_INTERVAL_MS / 1000}s. Pauses automatically when
            this tab is hidden.
            {lastUpdated && (
              <> · Updated {formatRelative(new Date(lastUpdated).toISOString())}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLive()}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <>
                <Play className="w-4 h-4 mr-1" /> Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-1" /> Pause
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Top-line counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CounterCard
          label="Recent Deposits"
          value={deposits.length}
          icon={<ArrowDownToLine className="w-4 h-4 text-emerald-400" />}
        />
        <CounterCard
          label="Recent Withdrawals"
          value={withdrawals.length}
          icon={<ArrowUpFromLine className="w-4 h-4 text-sky-400" />}
        />
        <CounterCard
          label="Online Users"
          value={onlineCount}
          icon={<Users className="w-4 h-4 text-fuchsia-400" />}
        />
        <CounterCard
          label="Open Alerts"
          value={securityAlerts.length}
          badge={criticalAlerts > 0 ? `${criticalAlerts} high+` : undefined}
          icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
          highlight={criticalAlerts > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DepositsCard entries={deposits} />
        <WithdrawalsCard entries={withdrawals} />
        <OnlineUsersCard entries={onlineUsers} />
        <SecurityAlertsCard
          entries={securityAlerts}
          onAck={ackAlert}
          onAckAll={ackAllVisible}
          dismissingIds={dismissingIds}
          bulkBusy={bulkBusy}
        />
      </div>
    </div>
  );
}

function CounterCard({
  label,
  value,
  icon,
  badge,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-slate-900/50 border-slate-800",
        highlight && "border-red-500/40",
      )}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
            {value}
            {badge && (
              <Badge variant="outline" className="text-xs border-red-500/40 text-red-400">
                {badge}
              </Badge>
            )}
          </div>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="text-center py-6 text-slate-500 text-sm">{message}</div>
  );
}

function DepositsCard({ entries }: { entries: DepositEntry[] }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-emerald-400" /> Live Deposits
        </CardTitle>
        <CardDescription>
          Newest transactions first. Shows user, amount, PSP, card last-4 and IP
          when captured in metadata.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-y-auto">
          {entries.length === 0 ? (
            <EmptyRow message="No deposits yet." />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">PSP</th>
                  <th className="text-left px-3 py-2">Card</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-slate-800 text-slate-300"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatRelative(d.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white truncate max-w-[180px]">
                        {d.userName || "(unknown)"}
                      </div>
                      <div className="text-slate-500 truncate max-w-[180px]">
                        {d.userEmail || d.userId}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-white">
                      {formatAmount(d.amount, d.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <div>{d.provider || "—"}</div>
                      {d.paymentMethod && (
                        <div className="text-slate-500">{d.paymentMethod}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {d.cardLast4 ? `•••• ${d.cardLast4}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono">{d.ip || "—"}</div>
                      {(() => {
                        const g = formatGeoInline(d.city, d.region, d.country);
                        return g ? (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-slate-500">
                            <Globe2 className="w-3 h-3" />
                            {g}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(statusBadgeClasses(d.status))}
                      >
                        {d.status}
                      </Badge>
                      {d.classification && (
                        <div className="mt-1">
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 text-amber-400"
                          >
                            {d.classification}
                          </Badge>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WithdrawalsCard({ entries }: { entries: WithdrawalEntry[] }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <ArrowUpFromLine className="w-4 h-4 text-sky-400" /> Live Withdrawals
        </CardTitle>
        <CardDescription>
          Pending approvals, processing, completed. IP captured where available.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-y-auto">
          {entries.length === 0 ? (
            <EmptyRow message="No withdrawals yet." />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Target</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Approval</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t border-slate-800 text-slate-300"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatRelative(w.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white truncate max-w-[180px]">
                        {w.userName || "(unknown)"}
                      </div>
                      <div className="text-slate-500 truncate max-w-[180px]">
                        {w.userEmail || w.userId}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-white">
                      {formatAmount(Math.abs(w.amount), w.currency)}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[160px]">
                      {w.destination || w.paymentMethod || w.provider || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono">{w.ip || "—"}</div>
                      {(() => {
                        const g = formatGeoInline(w.city, w.region, w.country);
                        return g ? (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-slate-500">
                            <Globe2 className="w-3 h-3" />
                            {g}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {w.approvalStatus ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 text-amber-400"
                        >
                          {w.approvalStatus}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(statusBadgeClasses(w.status))}
                      >
                        {w.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OnlineUsersCard({ entries }: { entries: OnlineUserEntry[] }) {
  const online = entries.filter((e) => e.status === "online");
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-fuchsia-400" /> Online Users
          <Badge variant="outline" className="ml-1 border-fuchsia-500/30 text-fuchsia-400">
            {online.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Active in last 2 minutes. Geo uses Cloudflare headers (zero-cost).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-y-auto">
          {online.length === 0 ? (
            <EmptyRow message="No users online right now." />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Geo</th>
                  <th className="text-left px-3 py-2">Page</th>
                  <th className="text-left px-3 py-2">Session</th>
                  <th className="text-right px-3 py-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {online.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-t border-slate-800 text-slate-300"
                  >
                    <td className="px-3 py-2">
                      <div className="text-white truncate max-w-[180px]">
                        {u.userName || "(unknown)"}
                      </div>
                      <div className="text-slate-500 truncate max-w-[180px]">
                        {u.userEmail || u.userId}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{u.ip || "—"}</td>
                    <td className="px-3 py-2">
                      {u.country || u.city ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="w-3 h-3 text-slate-500" />
                          {[u.city, u.region, u.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[180px] font-mono text-slate-400">
                      {u.currentPage || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {u.isInCompetition && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 text-emerald-400"
                          >
                            comp
                          </Badge>
                        )}
                        {u.isInChallenge && (
                          <Badge
                            variant="outline"
                            className="border-sky-500/30 text-sky-400"
                          >
                            challenge
                          </Badge>
                        )}
                        {!u.isInCompetition && !u.isInChallenge && "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatRelative(u.lastHeartbeat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityAlertsCard({
  entries,
  onAck,
  onAckAll,
  dismissingIds,
  bulkBusy,
}: {
  entries: SecurityAlertEntry[];
  onAck: (id: string) => void;
  onAckAll: () => void;
  dismissingIds: Set<string>;
  bulkBusy: boolean;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Live Security
              Alerts
            </CardTitle>
            <CardDescription>
              Unacknowledged runtime security events from webhooks, auth,
              anti-fraud, etc.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAckAll}
            disabled={bulkBusy || entries.length === 0}
            className="shrink-0"
          >
            {bulkBusy ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3 mr-1" />
            )}
            Dismiss all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-y-auto">
          {entries.length === 0 ? (
            <EmptyRow message="No open alerts. All clear." />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase bg-slate-900/70 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Severity</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Reason</th>
                  <th className="text-right px-3 py-2 w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {entries.map((a) => {
                  const busy = dismissingIds.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-slate-800 text-slate-300"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatRelative(a.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-mono">{a.alertType}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(severityBadgeClasses(a.severity))}
                        >
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 truncate max-w-[160px]">
                        {a.source}
                        {a.provider && (
                          <span className="text-slate-500"> / {a.provider}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{a.ip || "—"}</td>
                      <td className="px-3 py-2 truncate max-w-[280px] text-slate-400">
                        {a.reason}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white hover:bg-red-500/10"
                          onClick={() => onAck(a.id)}
                          disabled={busy}
                          title="Dismiss / acknowledge"
                        >
                          {busy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
