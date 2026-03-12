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
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type {
  AnalyticsOverview,
  VisitTimeData,
  DeviceData,
  CountryData,
  ConversionData,
  LandingPageData,
} from "./lp-types";

interface Props {
  selectedPage?: LandingPageData | null;
  onBack: () => void;
}

export default function LPAnalytics({ selectedPage, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [visitsByTime, setVisitsByTime] = useState<VisitTimeData[]>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<DeviceData[]>([]);
  const [topCountries, setTopCountries] = useState<CountryData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
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
      const data = await res.json();

      setOverview(data.overview);
      setVisitsByTime(data.visitsByTime || []);
      setDeviceBreakdown(data.deviceBreakdown || []);
      setTopCountries(data.topCountries || []);
      setConversionData(data.conversionData || []);
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
      a.download = `landing-page-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Analytics exported!");
    } catch {
      toast.error("Failed to export analytics");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-500" />
              {selectedPage ? `Analytics: ${selectedPage.name}` : "All Pages Analytics"}
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
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={async () => {
              if (!window.confirm("Are you sure you want to clear all LP visit analytics? This cannot be undone.")) return;
              try {
                const res = await fetch("/api/landing-pages/analytics/clear", { method: "DELETE" });
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                toast.success(`Cleared ${data.deletedVisits} visit records`);
                fetchAnalytics();
              } catch {
                toast.error("Failed to clear analytics");
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Stats
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-gray-400 text-xs">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-gray-800 border-gray-700 w-40"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-gray-800 border-gray-700 w-40"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Group By</Label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : (
        <>
          {/* Overview KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI
              icon={<MousePointer className="h-5 w-5" />}
              label="Total Visits"
              value={overview?.totalVisits || 0}
              color="text-blue-400"
              bg="bg-blue-500/10"
            />
            <KPI
              icon={<Users className="h-5 w-5" />}
              label="Unique Visitors"
              value={overview?.uniqueVisitors || 0}
              color="text-purple-400"
              bg="bg-purple-500/10"
            />
            <KPI
              icon={<TrendingUp className="h-5 w-5" />}
              label="Conversions"
              value={overview?.totalConversions || 0}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
            />
            <KPI
              icon={<Clock className="h-5 w-5" />}
              label="Avg Duration (s)"
              value={overview?.avgDuration || 0}
              color="text-amber-400"
              bg="bg-amber-500/10"
            />
          </div>

          {/* Chart placeholder + Device breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Visits over time (text-based table) */}
            <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">
                  Visits Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visitsByTime.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">
                    No visit data yet
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-gray-800">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-right py-2 px-2">Visits</th>
                          <th className="text-right py-2 px-2">Unique</th>
                          <th className="text-right py-2 px-2">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitsByTime.map((row) => (
                          <tr
                            key={row.date}
                            className="border-b border-gray-800/50 hover:bg-gray-800/30"
                          >
                            <td className="py-1.5 px-2 text-gray-300">{row.date}</td>
                            <td className="py-1.5 px-2 text-right text-white font-medium">
                              {row.visits}
                            </td>
                            <td className="py-1.5 px-2 text-right text-gray-400">
                              {row.uniqueVisitors}
                            </td>
                            <td className="py-1.5 px-2 text-right text-emerald-400">
                              {row.conversions}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300">Devices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deviceBreakdown.map((d) => {
                  const DeviceIcon =
                    d.device === "desktop"
                      ? Monitor
                      : d.device === "mobile"
                        ? Smartphone
                        : d.device === "tablet"
                          ? Tablet
                          : Monitor;
                  const total = deviceBreakdown.reduce(
                    (s, x) => s + x.count,
                    0,
                  );
                  const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;

                  return (
                    <div key={d.device} className="flex items-center gap-3">
                      <DeviceIcon className="h-4 w-4 text-gray-500 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white capitalize">
                            {d.device}
                          </span>
                          <span className="text-xs text-gray-500">
                            {d.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {deviceBreakdown.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No device data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Countries + Conversion table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Countries */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCountries.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No country data
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {topCountries.map((c, i) => (
                      <div
                        key={c.country}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm text-gray-300">
                          <span className="text-gray-600 mr-2">#{i + 1}</span>
                          {c.country || "Unknown"}
                        </span>
                        <Badge className="bg-gray-800 text-gray-400">
                          {c.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversion by Page */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Conversion by Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conversionData.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No conversion data
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-gray-800">
                          <th className="text-left py-2">Page</th>
                          <th className="text-right py-2">Visits</th>
                          <th className="text-right py-2">Conv.</th>
                          <th className="text-right py-2">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionData.map((d) => (
                          <tr
                            key={d.trackingId}
                            className="border-b border-gray-800/50"
                          >
                            <td className="py-1.5 text-gray-300 truncate max-w-[200px]">
                              {d.pageName}
                            </td>
                            <td className="py-1.5 text-right text-white">
                              {d.visits}
                            </td>
                            <td className="py-1.5 text-right text-emerald-400">
                              {d.conversions}
                            </td>
                            <td className="py-1.5 text-right text-yellow-400">
                              {d.conversionRate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg}`}>
          <span className={color}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
