"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye,
  RefreshCw,
  Trash2,
  Download,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import VisitorOverviewCards from "./VisitorOverviewCards";
import LiveVisitorsFeed from "./LiveVisitorsFeed";
import VisitorCharts from "./VisitorCharts";
import VisitorHistory from "./VisitorHistory";
import BlockedVisitorsList from "./BlockedVisitorsList";
import type { FullAnalytics, LiveData, BlockedRule } from "./visitor-types";

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = "live" | "analytics" | "history" | "blocked";

/**
 * VisitorAnalyticsSection — Admin section for site-wide visitor tracking.
 * Tabs: Live Dashboard, Full Analytics, Visit History, Blocked Rules.
 */
export default function VisitorAnalyticsSection() {
  const [tab, setTab] = useState<Tab>("live");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<FullAnalytics | null>(null);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [blocked, setBlocked] = useState<BlockedRule[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("day");
  const [pageCategory, setPageCategory] = useState("all");
  const [device, setDevice] = useState("all");

  // Block IP prefill
  const [prefillIp, setPrefillIp] = useState("");

  // Live polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch full analytics ───────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ groupBy });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (pageCategory !== "all") params.set("pageCategory", pageCategory);
      if (device !== "all") params.set("device", device);

      const res = await fetch(`/api/visitors?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data: FullAnalytics = await res.json();
      setAnalytics(data);
    } catch {
      toast.error("Failed to load visitor analytics");
    } finally {
      setLoading(false);
    }
  }, [groupBy, dateFrom, dateTo, pageCategory, device]);

  // ── Fetch live data ────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/visitors/live");
      if (!res.ok) throw new Error("Failed");
      const data: LiveData = await res.json();
      setLiveData(data);
    } catch {
      // Silent fail for live polling
    }
  }, []);

  // ── Fetch blocked rules ────────────────────────────────────────────────
  const fetchBlocked = useCallback(async () => {
    try {
      const res = await fetch("/api/visitors/block");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBlocked(data.blocked || []);
    } catch {
      // Silent
    }
  }, []);

  // ── Initial load + live polling ────────────────────────────────────────
  useEffect(() => {
    fetchAnalytics();
    fetchLive();
    fetchBlocked();
  }, [fetchAnalytics, fetchLive, fetchBlocked]);

  useEffect(() => {
    // Reason: Poll live data every 15 seconds when on live tab
    if (tab === "live") {
      pollRef.current = setInterval(fetchLive, 15_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tab, fetchLive]);

  // ── Clear all visit data ───────────────────────────────────────────────
  const handleClearAll = async (includeBlocks: boolean) => {
    try {
      const res = await fetch(
        `/api/visitors/clear?includeBlocks=${includeBlocks}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success(
        `Cleared ${data.visitsDeleted} visits${includeBlocks ? ` and ${data.blocksDeleted} block rules` : ""}`,
      );
      fetchAnalytics();
      fetchLive();
      if (includeBlocks) fetchBlocked();
    } catch {
      toast.error("Failed to clear data");
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!analytics?.recentVisits) return;
    const headers = "Time,Path,Category,Country,Device,Browser,OS,IP,Bot,Suspicious\n";
    const rows = analytics.recentVisits
      .map(
        (v) =>
          `${v.visitedAt},${v.path},${v.pageCategory},${v.country},${v.device},${v.browser},${v.os},${v.ip},${v.isBot},${v.isSuspicious}`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Block IP handler (from child components) ──────────────────────────
  const handleBlockIp = (ip: string) => {
    setPrefillIp(ip);
    setTab("blocked");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "live", label: "Live Dashboard" },
    { id: "analytics", label: "Full Analytics" },
    { id: "history", label: "Visit History" },
    { id: "blocked", label: "Block Rules" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-indigo-400" />
          <div>
            <h2 className="text-xl font-bold text-white">
              Visitor Analytics
            </h2>
            <p className="text-xs text-gray-400">
              Site-wide tracking — pages, visitors, bots, threats
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleExport}
            disabled={!analytics}
          >
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              fetchAnalytics();
              fetchLive();
              fetchBlocked();
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Clear Visitor Data
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  This will permanently delete all visit history. Block rules
                  will be kept unless you choose to delete them too.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex gap-2">
                <AlertDialogCancel className="bg-gray-800 text-gray-300 border-gray-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleClearAll(false)}
                >
                  Clear Visits Only
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => handleClearAll(true)}
                >
                  Clear Visits + Blocks
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? "bg-gray-800 text-white border-b-2 border-indigo-500"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Cards (always visible) */}
      <VisitorOverviewCards
        overview={analytics?.overview || null}
        liveData={liveData}
      />

      {/* Filters (for analytics/history tabs) */}
      {(tab === "analytics" || tab === "history") && (
        <div className="flex items-end gap-3 flex-wrap p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <Filter className="h-4 w-4 text-gray-400 mb-2" />
          <div>
            <Label className="text-[10px] text-gray-500">From</Label>
            <Input
              type="date"
              className="h-8 w-[140px] bg-gray-800 border-gray-700 text-white text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">To</Label>
            <Input
              type="date"
              className="h-8 w-[140px] bg-gray-800 border-gray-700 text-white text-xs"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Group</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="h-8 w-[100px] bg-gray-800 border-gray-700 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Page Type</Label>
            <Select value={pageCategory} onValueChange={setPageCategory}>
              <SelectTrigger className="h-8 w-[110px] bg-gray-800 border-gray-700 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Pages</SelectItem>
                <SelectItem value="hero">Hero</SelectItem>
                <SelectItem value="landing">Landing</SelectItem>
                <SelectItem value="app">App</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Device</Label>
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger className="h-8 w-[100px] bg-gray-800 border-gray-700 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs"
            onClick={fetchAnalytics}
          >
            Apply
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && tab !== "live" && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Tab Content */}
      {tab === "live" && liveData && (
        <LiveVisitorsFeed
          liveVisitors={liveData.liveVisitors}
          recentActivity={liveData.recentActivity}
          onBlockIp={handleBlockIp}
        />
      )}

      {tab === "analytics" && analytics && !loading && (
        <VisitorCharts analytics={analytics} />
      )}

      {tab === "history" && analytics && !loading && (
        <VisitorHistory
          visits={analytics.recentVisits}
          onBlockIp={handleBlockIp}
        />
      )}

      {tab === "blocked" && (
        <BlockedVisitorsList
          blocked={blocked}
          onRefresh={fetchBlocked}
          prefillIp={prefillIp}
          onClearPrefill={() => setPrefillIp("")}
        />
      )}
    </div>
  );
}
