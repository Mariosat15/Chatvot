"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FileText,
  Bot,
  CalendarClock,
} from "lucide-react";
import type {
  VisitTimeEntry,
  PageEntry,
  BotEntry,
  HourlyHeatmapEntry,
} from "./visitor-types";

const tooltipStyle = {
  contentStyle: {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#9ca3af" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  visitsByTime: VisitTimeEntry[];
  topPages: PageEntry[];
  botStats: BotEntry[];
  hourlyHeatmap: HourlyHeatmapEntry[];
}

// ─── Category badge colors ────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  hero: "text-yellow-400",
  landing: "text-cyan-400",
  app: "text-blue-400",
  auth: "text-purple-400",
  admin: "text-red-400",
  other: "text-gray-400",
};

export default function VisitorEngagementCharts({
  visitsByTime,
  topPages,
  botStats,
  hourlyHeatmap,
}: Props) {
  // ── Heatmap grid (7 days × 24 hours) ──────────────────────────────────
  const heatmapGrid = useMemo(() => {
    const maxCount = Math.max(...hourlyHeatmap.map((h) => h.count), 1);
    const grid: { day: number; hour: number; count: number; opacity: number }[][] = [];
    for (let d = 0; d < 7; d++) {
      const row: { day: number; hour: number; count: number; opacity: number }[] = [];
      for (let h = 0; h < 24; h++) {
        const entry = hourlyHeatmap.find(
          (e) => e.day === d && e.hour === h,
        );
        const count = entry?.count || 0;
        row.push({
          day: d,
          hour: h,
          count,
          opacity: count > 0 ? Math.max(0.15, count / maxCount) : 0.04,
        });
      }
      grid.push(row);
    }
    return grid;
  }, [hourlyHeatmap]);

  return (
    <div className="space-y-4">
      {/* ── Avg Duration Over Time (Line Chart) ────────────────────────── */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-cyan-400" />
            Engagement Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {visitsByTime.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={visitsByTime}>
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
                  yAxisId="duration"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis
                  yAxisId="bounce"
                  orientation="right"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  domain={[0, 100]}
                />
                <Tooltip {...tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
                />
                <Line
                  yAxisId="duration"
                  type="monotone"
                  dataKey="avgDuration"
                  name="Avg Duration (s)"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="bounce"
                  type="monotone"
                  dataKey="bounceRate"
                  name="Bounce Rate (%)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Hourly Heatmap ─────────────────────────────────────────────── */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-amber-400" />
            Activity Heatmap (Day × Hour)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {hourlyHeatmap.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour labels */}
                <div className="flex gap-0.5 mb-1 ml-[44px]">
                  {Array.from({ length: 24 }, (_, h) => (
                    <span
                      key={h}
                      className="text-[8px] text-gray-500 text-center"
                      style={{ width: "calc((100% - 0px) / 24)" }}
                    >
                      {h % 3 === 0 ? `${h}h` : ""}
                    </span>
                  ))}
                </div>
                {/* Heatmap rows */}
                {heatmapGrid.map((row, d) => (
                  <div key={d} className="flex items-center gap-0.5 mb-0.5">
                    <span className="text-[10px] text-gray-400 w-[40px] text-right pr-1">
                      {DAY_LABELS.at(d) ?? ""}
                    </span>
                    {row.map((cell) => (
                      <div
                        key={`${cell.day}-${cell.hour}`}
                        className="rounded-sm transition-colors"
                        style={{
                          width: "calc((100% - 44px) / 24)",
                          height: "18px",
                          background: `rgba(99, 102, 241, ${cell.opacity})`,
                        }}
                        title={`${DAY_LABELS[cell.day]} ${cell.hour}:00 — ${cell.count} visits`}
                      />
                    ))}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center justify-end gap-1 mt-2">
                  <span className="text-[9px] text-gray-500">Less</span>
                  {[0.05, 0.2, 0.4, 0.65, 0.9].map((op) => (
                    <div
                      key={op}
                      className="w-3 h-3 rounded-sm"
                      style={{ background: `rgba(99, 102, 241, ${op})` }}
                    />
                  ))}
                  <span className="text-[9px] text-gray-500">More</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row: Top Pages + Bot Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Pages with Engagement */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-400" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {topPages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No data</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {topPages.slice(0, 25).map((p) => (
                  <div
                    key={p.path}
                    className="flex items-center gap-2 text-xs p-1.5 rounded bg-gray-900/30"
                  >
                    <span className="font-mono text-white truncate flex-1 min-w-0">
                      {p.path}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1 ${CAT_COLORS[p.category] || CAT_COLORS.other}`}
                    >
                      {p.category}
                    </Badge>
                    <span className="text-gray-400 w-[44px] text-right flex-shrink-0">
                      {p.visits}
                    </span>
                    <span className="text-gray-500 w-[44px] text-right flex-shrink-0">
                      {p.unique}u
                    </span>
                    <span className="text-cyan-400/70 w-[38px] text-right text-[10px] flex-shrink-0">
                      {p.avgDuration}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot Statistics */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-yellow-400" />
              Bot Traffic
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {botStats.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No bots detected
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={botStats.slice(0, 10)}
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
                    dataKey="botName"
                    stroke="#6b7280"
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    width={80}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="#eab308"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
