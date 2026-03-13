"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Globe, Cpu, ScreenShare } from "lucide-react";
import type {
  DeviceEntry,
  BrowserEntry,
  OSEntry,
  ResolutionEntry,
} from "./visitor-types";

const DEVICE_COLORS = ["#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];
const BROWSER_COLORS = [
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

interface Props {
  deviceBreakdown: DeviceEntry[];
  browserBreakdown: BrowserEntry[];
  osBreakdown: OSEntry[];
  resolutions: ResolutionEntry[];
}

function PieWithLegend<T extends { count: number; percentage: number }>({
  data,
  nameKey,
  colors,
  label,
}: {
  data: T[];
  nameKey: keyof T;
  colors: string[];
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
      <ResponsiveContainer width="45%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey={nameKey as string}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={70}
            strokeWidth={1}
            stroke="#1f2937"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1 max-h-[180px] overflow-y-auto">
        {data.map((item, i) => (
          <div
            key={String(Object.getOwnPropertyDescriptor(item, nameKey)?.value ?? i)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: colors[i % colors.length] }}
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

export default function VisitorTechCharts({
  deviceBreakdown,
  browserBreakdown,
  osBreakdown,
  resolutions,
}: Props) {
  return (
    <div className="space-y-4">
      {/* ── Row: Device + Browser ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-purple-400" />
              Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <PieWithLegend
              data={deviceBreakdown}
              nameKey="device"
              colors={DEVICE_COLORS}
              label="device"
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-cyan-400" />
              Browsers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <PieWithLegend
              data={browserBreakdown}
              nameKey="browser"
              colors={BROWSER_COLORS}
              label="browser"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Row: OS + Screen Resolutions ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-emerald-400" />
              Operating Systems
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {osBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No OS data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={osBreakdown.slice(0, 10)}
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
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <ScreenShare className="h-4 w-4 text-amber-400" />
              Screen Resolutions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {resolutions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No resolution data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={resolutions.slice(0, 10)}
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
                    dataKey="resolution"
                    stroke="#6b7280"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    width={80}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
