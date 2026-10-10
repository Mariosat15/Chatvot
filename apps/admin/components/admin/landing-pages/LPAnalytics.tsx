"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Download,
  Loader2,
  ArrowLeft,
  MousePointer,
  Users,
  TrendingUp,
  Clock,
  Globe,
  MapPin,
  Monitor,
  Cpu,
  Link2,
  Megaphone,
  RefreshCw,
  Trash2,
  ArrowDownUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import type {
  LPFullAnalytics,
  LandingPageData,
} from "./lp-types";

// ─── Constants ──────────────────────────────────────────────────────────────
const COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#ef4444",
  "#10b981", "#8b5cf6", "#ec4899", "#14b8a6",
];

const tooltipStyle = {
  contentStyle: {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#9ca3af" },
};

// ─── Props ──────────────────────────────────────────────────────────────────
interface Props {
  selectedPage?: LandingPageData | null;
  onBack: () => void;
}

export default function LPAnalytics({ selectedPage, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LPFullAnalytics | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("day");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ groupBy });
      if (selectedPage) params.set("trackingId", selectedPage.trackingId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/landing-pages/analytics?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json: LPFullAnalytics = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [selectedPage, dateFrom, dateTo, groupBy]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  async function handleExport() {
    const params = new URLSearchParams();
    if (selectedPage) params.set("trackingId", selectedPage.trackingId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/landing-pages/analytics/export?${params}`);
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lp-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Analytics exported!");
    } catch {
      toast.error("Failed to export analytics");
    }
  }

  const ov = data?.overview;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-500" />
              {selectedPage
                ? `Analytics: ${selectedPage.name}`
                : "All Pages Analytics"}
            </h2>
            {selectedPage && (
              <p className="text-xs text-gray-500 mt-0.5">
                Tracking ID: {selectedPage.trackingId}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={async () => {
              if (
                !window.confirm(
                  "Clear all LP visit analytics? This cannot be undone.",
                )
              )
                return;
              try {
                const res = await fetch("/api/landing-pages/analytics/clear", {
                  method: "DELETE",
                });
                if (!res.ok) throw new Error("Failed");
                const d = await res.json();
                toast.success(`Cleared ${d.deletedVisits} visit records`);
                fetchAnalytics();
              } catch {
                toast.error("Failed to clear analytics");
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
        <div>
          <Label className="text-[10px] text-gray-500">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[140px] bg-gray-800 border-gray-700 text-white text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-gray-500">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[140px] bg-gray-800 border-gray-700 text-white text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-gray-500">Group By</Label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 bg-gray-800 border border-gray-700 rounded-md px-2 text-xs text-white"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={fetchAnalytics}>
          Apply
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <KPI
              icon={<MousePointer className="h-4 w-4" />}
              label="Total Visits"
              value={String(ov?.totalVisits ?? 0)}
              color="text-blue-400"
              bg="bg-blue-500/10"
              border="border-blue-500/30"
            />
            <KPI
              icon={<Users className="h-4 w-4" />}
              label="Unique Visitors"
              value={String(ov?.uniqueVisitors ?? 0)}
              color="text-purple-400"
              bg="bg-purple-500/10"
              border="border-purple-500/30"
            />
            <KPI
              icon={<TrendingUp className="h-4 w-4" />}
              label="Conversions"
              value={String(ov?.totalConversions ?? 0)}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
              border="border-emerald-500/30"
            />
            <KPI
              icon={<TrendingUp className="h-4 w-4" />}
              label="Conv. Rate"
              value={`${ov?.conversionRate ?? 0}%`}
              color="text-green-400"
              bg="bg-green-500/10"
              border="border-green-500/30"
            />
            <KPI
              icon={<ArrowDownUp className="h-4 w-4" />}
              label="Bounce Rate"
              value={`${ov?.bounceRate ?? 0}%`}
              color={
                ov && ov.bounceRate > 60
                  ? "text-red-400"
                  : "text-teal-400"
              }
              bg={
                ov && ov.bounceRate > 60
                  ? "bg-red-500/10"
                  : "bg-teal-500/10"
              }
              border={
                ov && ov.bounceRate > 60
                  ? "border-red-500/30"
                  : "border-teal-500/30"
              }
            />
            <KPI
              icon={<Clock className="h-4 w-4" />}
              label="Avg Duration"
              value={ov?.avgDuration ? `${Math.round(ov.avgDuration)}s` : "—"}
              color="text-amber-400"
              bg="bg-amber-500/10"
              border="border-amber-500/30"
            />
          </div>

          {/* ── Visits + Conversion Over Time ───────────────────────── */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Visits &amp; Conversions Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!data?.visitsByTime?.length ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  No data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.visitsByTime}>
                    <defs>
                      <linearGradient id="lpVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lpConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={(v: string) =>
                        v.length > 10 ? v.slice(5) : v
                      }
                    />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Area
                      type="monotone"
                      dataKey="visits"
                      stroke="#6366f1"
                      fill="url(#lpVisits)"
                      name="Visits"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="conversions"
                      stroke="#10b981"
                      fill="url(#lpConv)"
                      name="Conversions"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Conversion Rate Trend ────────────────────────────────── */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Conversion Rate Trend (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!data?.visitsByTime?.length ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  No data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.visitsByTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={(v: string) =>
                        v.length > 10 ? v.slice(5) : v
                      }
                    />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="conversionRate"
                      name="Conv Rate %"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Device + Browser (Pie Charts) ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-purple-400" /> Devices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <PieWithLegend
                  data={data?.deviceBreakdown || []}
                  nameKey="device"
                  label="device"
                />
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-cyan-400" /> Browsers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <PieWithLegend
                  data={data?.browserBreakdown || []}
                  nameKey="browser"
                  label="browser"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── OS + Countries ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-emerald-400" /> Operating Systems
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!data?.osBreakdown?.length ? (
                  <p className="text-xs text-gray-500 text-center py-8">
                    No OS data
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.osBreakdown.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        type="number"
                        stroke="#6b7280"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="os"
                        stroke="#6b7280"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        width={70}
                      />
                      <Tooltip {...tooltipStyle} />
                      <Bar
                        dataKey="count"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-400" /> Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!data?.topCountries?.length ? (
                  <p className="text-xs text-gray-500 text-center py-8">
                    No country data
                  </p>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(data.topCountries.length * 26, 260)}
                  >
                    <BarChart
                      data={data.topCountries.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        type="number"
                        stroke="#6b7280"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="country"
                        stroke="#6b7280"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        width={50}
                      />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.topCountries.slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Cities + Referrers ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-pink-400" /> Top Cities
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!data?.topCities?.length ? (
                  <p className="text-xs text-gray-500 text-center py-8">
                    No city data
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {data.topCities.map((c) => {
                      const maxC = Math.max(
                        ...data.topCities.map((x) => x.count),
                        1,
                      );
                      return (
                        <div
                          key={`${c.city}-${c.country}`}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-gray-300 truncate w-[100px]">
                            {c.city}
                          </span>
                          <span className="text-gray-500 text-[10px] w-[28px]">
                            {c.country}
                          </span>
                          <div className="flex-1 bg-gray-900 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-pink-500 h-full rounded-full"
                              style={{
                                width: `${(c.count / maxC) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-gray-400 font-mono w-[30px] text-right">
                            {c.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-orange-400" /> Top Referrers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!data?.topReferrers?.length ? (
                  <p className="text-xs text-gray-500 text-center py-8">
                    No referrer data
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {data.topReferrers.map((r) => {
                      const maxR = Math.max(
                        ...data.topReferrers.map((x) => x.count),
                        1,
                      );
                      return (
                        <div
                          key={r.referrer}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-gray-300 truncate flex-1">
                            {r.referrer.length > 40
                              ? r.referrer.slice(0, 40) + "…"
                              : r.referrer}
                          </span>
                          <div className="w-[80px] bg-gray-900 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-orange-500 h-full rounded-full"
                              style={{
                                width: `${(r.count / maxR) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-gray-400 font-mono w-[30px] text-right">
                            {r.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── UTM Campaigns ──────────────────────────────────────────── */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                <Megaphone className="h-4 w-4 text-pink-400" />
                UTM Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!data?.utmCampaignBreakdown?.length ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  No UTM campaigns tracked
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[260px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-2 px-2">Campaign</th>
                        <th className="text-left py-2 px-2">Source</th>
                        <th className="text-left py-2 px-2">Medium</th>
                        <th className="text-right py-2 px-2">Visits</th>
                        <th className="text-right py-2 px-2">Conv.</th>
                        <th className="text-right py-2 px-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.utmCampaignBreakdown.map((c) => (
                        <tr
                          key={`${c.campaign}-${c.source}-${c.medium}`}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-1.5 px-2 text-white truncate max-w-[150px]">
                            {c.campaign}
                          </td>
                          <td className="py-1.5 px-2 text-gray-400">
                            {c.source || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-gray-400">
                            {c.medium || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right text-white">
                            {c.visits}
                          </td>
                          <td className="py-1.5 px-2 text-right text-emerald-400">
                            {c.conversions}
                          </td>
                          <td className="py-1.5 px-2 text-right text-yellow-400">
                            {c.conversionRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Conversion by Page ────────────────────────────────────── */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Conversion by Page
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!data?.conversionData?.length ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  No conversion data
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-2 px-2">Page</th>
                        <th className="text-left py-2 px-2">Campaign</th>
                        <th className="text-right py-2 px-2">Visits</th>
                        <th className="text-right py-2 px-2">Conv.</th>
                        <th className="text-right py-2 px-2">Rate</th>
                        <th className="text-right py-2 px-2">Avg Dur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.conversionData.map((d) => (
                        <tr
                          key={d.trackingId}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-1.5 px-2 text-white truncate max-w-[180px]">
                            {d.pageName}
                          </td>
                          <td className="py-1.5 px-2 text-gray-400 truncate max-w-[120px]">
                            {d.campaign || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right text-white">
                            {d.visits}
                          </td>
                          <td className="py-1.5 px-2 text-right text-emerald-400">
                            {d.conversions}
                          </td>
                          <td className="py-1.5 px-2 text-right text-yellow-400">
                            {d.conversionRate}%
                          </td>
                          <td className="py-1.5 px-2 text-right text-cyan-400">
                            {d.avgDuration}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── KPI Sub-component ────────────────────────────────────────────────────────
function KPI({
  icon,
  label,
  value,
  color,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <Card className={`${bg} border ${border}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={color}>{icon}</span>
        </div>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Pie + Legend Sub-component ──────────────────────────────────────────────
function PieWithLegend<T extends { count: number; percentage: number }>({
  data,
  nameKey,
  label,
}: {
  data: T[];
  nameKey: keyof T;
  label: string;
}) {
  if (!data.length) {
    return (
      <p className="text-xs text-gray-500 text-center py-8">
        No {label} data
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width="45%" height={170}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey={nameKey as string}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={65}
            strokeWidth={1}
            stroke="#1f2937"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1 max-h-[170px] overflow-y-auto">
        {data.map((item, i) => (
          <div
            key={String(Object.getOwnPropertyDescriptor(item, nameKey)?.value ?? i)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-300 truncate flex-1">
              {String(Object.getOwnPropertyDescriptor(item, nameKey)?.value ?? "Unknown")}
            </span>
            <span className="text-gray-400 font-mono text-[10px]">
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
