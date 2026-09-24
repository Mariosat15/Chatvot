"use client";

/**
 * Dev Zone → Command Alerts
 *
 * Surfaces the same SecurityAlert documents that print `🚨 [SECURITY]` in PM2 /
 * worker logs. Read-only against production paths except delete + retention settings.
 * Soft-polls every 30s only while the tab is visible — no websocket, no tailing files.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Terminal } from "lucide-react";
import { toast } from "sonner";
import {
  COMMAND_ALERT_CATEGORIES,
  countForCategory,
  labelForCategory,
  type CommandAlertCategory,
} from "@/lib/admin/command-alert-categories";
import {
  CommandAlertsRetentionCard,
  type RetentionSettings,
} from "@/components/admin/CommandAlertsRetentionCard";
import {
  CommandAlertsTable,
  type CommandAlertRow,
} from "@/components/admin/CommandAlertsTable";
import { CommandAlertDetailDrawer } from "@/components/admin/CommandAlertDetailDrawer";

type CommandAlert = CommandAlertRow;

type StatusFilter = "open" | "ack" | "all";

export default function CommandAlertsSection() {
  const [alerts, setAlerts] = useState<CommandAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [bySeverity, setBySeverity] = useState<
    Record<CommandAlert["severity"], number>
  >({ low: 0, medium: 0, high: 0, critical: 0 });
  const [byCategory, setByCategory] = useState<
    Record<CommandAlertCategory, number>
  >({ provider: 0, security: 0, payment: 0, other: 0 });
  const [settings, setSettings] = useState<RetentionSettings>({
    autoDeleteEnabled: false,
    retentionDays: 7,
  });
  const [retentionOptions, setRetentionOptions] = useState<number[]>([
    1, 5, 7, 30,
  ]);
  const [pageSizes, setPageSizes] = useState<number[]>([10, 25, 50, 100]);

  const [status, setStatus] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<CommandAlert | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("status", status);
    if (severity !== "all") params.set("severity", severity);
    if (category !== "all") params.set("category", category);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [page, pageSize, status, severity, category, q]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dev-zone/command-alerts?${queryString}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load");
      }
      setAlerts(data.alerts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
      setBySeverity(
        data.bySeverity || { low: 0, medium: 0, high: 0, critical: 0 },
      );
      setByCategory(
        data.byCategoryRough || {
          provider: 0,
          security: 0,
          payment: 0,
          other: 0,
        },
      );
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.pageSizes)) setPageSizes(data.pageSizes);
      if (Array.isArray(data.retentionOptions))
        setRetentionOptions(data.retentionOptions);
      setSelected(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Failed to load command alerts");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  // Soft live refresh — only while this document is visible.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void fetchAlerts();
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [fetchAlerts]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/dev-zone/command-alerts", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "save failed");
      setSettings(data.settings);
      toast.success(
        data.settings.autoDeleteEnabled
          ? `Auto-delete on after ${data.settings.retentionDays} day(s)`
          : "Auto-delete off",
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save retention settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const acknowledgeIds = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const res = await fetch("/api/dev-zone/command-alerts", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "acknowledge failed");
      toast.success(
        `Acknowledged ${data.acknowledged} alert(s) — still in history`,
      );
      if (detail && ids.includes(detail._id)) setDetail(null);
      await fetchAlerts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to acknowledge alerts");
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set("format", "csv");
      const res = await fetch(`/api/dev-zone/command-alerts?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "export failed",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || "command-alerts.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded (up to 5,000 matching rows)");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (
      !window.confirm(
        `Delete ${ids.length} alert(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/dev-zone/command-alerts", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "delete failed");
      toast.success(`Deleted ${data.deleted} alert(s)`);
      if (detail && ids.includes(detail._id)) setDetail(null);
      await fetchAlerts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete alerts");
    }
  };

  const deleteMatching = async () => {
    if (
      !window.confirm(
        `Delete up to 5,000 alerts matching the current filters (status=${status}, category=${category}, severity=${severity})?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/dev-zone/command-alerts", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchCurrentFilters: true,
          status,
          severity: severity === "all" ? undefined : severity,
          category: category === "all" ? undefined : category,
          q: q.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "delete failed");
      toast.success(`Deleted ${data.deleted} alert(s)`);
      setPage(1);
      await fetchAlerts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete matching alerts");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-lime-400" />
            Command Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Live SecurityAlert feed — the same events that appear as{" "}
            <code className="text-lime-300/80">🚨 [SECURITY]</code> in worker /
            app logs. No file tailing; light poll while this tab is open.
            Deleting a row does not stop the monitor — if the condition still
            exists it will recreate; prefer Acknowledge to clear the live list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchAlerts()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Retention */}
      <CommandAlertsRetentionCard
        settings={settings}
        retentionOptions={retentionOptions}
        saving={savingSettings}
        onChange={setSettings}
        onSave={() => void saveSettings()}
      />

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", total] as const,
            ...COMMAND_ALERT_CATEGORIES.map(
              (c) =>
                [c, labelForCategory(c), countForCategory(byCategory, c)] as const,
            ),
          ] as Array<readonly [string, string, number]>
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCategory(id);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              category === id
                ? "bg-lime-500/20 border-lime-500/50 text-lime-200"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Severity strip */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Any severity"],
            ["critical", `Critical (${bySeverity.critical})`],
            ["high", `High (${bySeverity.high})`],
            ["medium", `Medium (${bySeverity.medium})`],
            ["low", `Low (${bySeverity.low})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSeverity(id);
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded text-xs border ${
              severity === id
                ? "bg-gray-700 border-gray-500 text-white"
                : "bg-gray-900 border-gray-800 text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="open">Open (unacknowledged)</option>
          <option value="ack">Acknowledged only</option>
          <option value="all">All</option>
        </select>
        <div className="flex items-center gap-1 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gray-500 shrink-0" />
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQ(qDraft);
                setPage(1);
              }
            }}
            placeholder="Search reason, source, type…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => {
              setQ(qDraft);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-gray-700 text-sm text-white"
          >
            Search
          </button>
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      <CommandAlertsTable
        alerts={alerts}
        loading={loading}
        selected={selected}
        total={total}
        page={page}
        totalPages={totalPages}
        exporting={exporting}
        onToggle={toggleSelect}
        onSelectPage={(ids) => setSelected(new Set(ids))}
        onClearSelection={() => setSelected(new Set())}
        onDeleteIds={(ids) => void deleteIds(ids)}
        onDeleteMatching={() => void deleteMatching()}
        onAcknowledgeIds={(ids) => void acknowledgeIds(ids)}
        onExportCsv={() => void exportCsv()}
        onOpenDetail={setDetail}
        onCopy={(text) => void copyText(text)}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      <CommandAlertDetailDrawer
        alert={detail}
        onClose={() => setDetail(null)}
        onAcknowledge={(id) => void acknowledgeIds([id])}
        onDelete={(id) => void deleteIds([id])}
      />
    </div>
  );
}
