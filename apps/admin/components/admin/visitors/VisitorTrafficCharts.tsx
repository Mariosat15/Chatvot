"use client";

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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Link2, Search, Megaphone } from "lucide-react";
import type {
  VisitTimeEntry,
  TrafficSourceEntry,
  ReferrerEntry,
  SearchQueryEntry,
  UTMCampaignEntry,
} from "./visitor-types";

// ─── Colors ──────────────────────────────────────────────────────────────────
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

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  visitsByTime: VisitTimeEntry[];
  trafficSources: TrafficSourceEntry[];
  topReferrers: ReferrerEntry[];
  topSearchQueries: SearchQueryEntry[];
  utmCampaigns: UTMCampaignEntry[];
}

export default function VisitorTrafficCharts({
  visitsByTime,
  trafficSources,
  topReferrers,
  topSearchQueries,
  utmCampaigns,
}: Props) {
  return (
    <div className="space-y-4">
      {/* ── Visits Over Time (Area Chart) ──────────────────────────────── */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Visits Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {visitsByTime.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              No time data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={visitsByTime}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBots" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v: string) => (v.length > 10 ? v.slice(5) : v)}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <Tooltip {...tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="#6366f1"
                  fill="url(#colorVisits)"
                  name="Total"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="unique"
                  stroke="#22d3ee"
                  fill="url(#colorUnique)"
                  name="Unique"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="bots"
                  stroke="#f59e0b"
                  fill="url(#colorBots)"
                  name="Bots"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Row: Traffic Sources (Pie) + Top Referrers (Bar) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Traffic Sources */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-purple-400" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {trafficSources.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No data</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={trafficSources}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      strokeWidth={1}
                      stroke="#1f2937"
                    >
                      {trafficSources.map((_, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {trafficSources.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-gray-300 truncate flex-1">
                        {s.source}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {s.percentage}%
                      </span>
                      <span className="text-gray-500 font-mono w-[40px] text-right">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Referrers */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-orange-400" />
              Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {topReferrers.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={topReferrers.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="referrer"
                    stroke="#6b7280"
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    width={80}
                    tickFormatter={(v: string) =>
                      v.length > 25 ? v.slice(0, 25) + "…" : v
                    }
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row: Search Queries + UTM Campaigns ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Queries */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Search className="h-4 w-4 text-green-400" />
              Search Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {topSearchQueries.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No data</p>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {topSearchQueries.map((q) => {
                  const maxQ = Math.max(
                    ...topSearchQueries.map((x) => x.count),
                    1,
                  );
                  return (
                    <div
                      key={q.query}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-gray-300 truncate w-[140px]">
                        {q.query}
                      </span>
                      <div className="flex-1 bg-gray-900 rounded-full h-3.5 overflow-hidden">
                        <div
                          className="bg-green-500 h-full rounded-full transition-all"
                          style={{
                            width: `${(q.count / maxQ) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-gray-400 font-mono w-[36px] text-right">
                        {q.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* UTM Campaigns */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-pink-400" />
              UTM Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {utmCampaigns.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No UTM campaigns tracked
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {utmCampaigns.map((c) => (
                  <div
                    key={`${c.campaign}-${c.source}-${c.medium}`}
                    className="p-2 bg-gray-900/40 rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium truncate">
                        {c.campaign}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {c.visits} visits
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                      <span>
                        Source: <span className="text-gray-300">{c.source || "—"}</span>
                      </span>
                      <span>
                        Medium: <span className="text-gray-300">{c.medium || "—"}</span>
                      </span>
                      <span>
                        Unique: <span className="text-cyan-400">{c.unique}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
