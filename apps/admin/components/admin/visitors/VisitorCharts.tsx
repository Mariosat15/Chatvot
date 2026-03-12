"use client";

import {
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Link2,
  Search,
  Bot,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  VisitTimeEntry,
  DeviceEntry,
  BrowserEntry,
  OSEntry,
  CountryEntry,
  ReferrerEntry,
  PageEntry,
  SearchQueryEntry,
  BotEntry,
} from "./visitor-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function BarChart({
  data,
  maxVal,
  label,
  color = "bg-blue-500",
}: {
  data: { key: string; value: number }[];
  maxVal: number;
  label: string;
  color?: string;
}) {
  if (!data.length) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">No {label} data</p>
    );
  }
  return (
    <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
      {data.map((d) => (
        <div key={d.key} className="flex items-center gap-2 text-xs">
          <span className="text-gray-300 truncate w-[100px] text-right">
            {d.key || "Unknown"}
          </span>
          <div className="flex-1 bg-gray-900 rounded-full h-4 overflow-hidden">
            <div
              className={`${color} h-full rounded-full transition-all`}
              style={{ width: maxVal > 0 ? `${(d.value / maxVal) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-gray-400 w-[40px] text-right font-mono">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Time Series Chart (simplified bar-based) ───────────────────────────────

function TimeSeriesChart({ data }: { data: VisitTimeEntry[] }) {
  if (!data.length) {
    return (
      <p className="text-xs text-gray-500 text-center py-8">
        No time data available
      </p>
    );
  }
  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  return (
    <div className="flex items-end gap-0.5 h-[160px]">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div className="w-full flex flex-col-reverse items-center gap-0.5">
            <div
              className="w-full bg-blue-500/80 rounded-t transition-all"
              style={{ height: `${(d.visits / maxVisits) * 120}px` }}
              title={`${d.date}: ${d.visits} visits, ${d.unique} unique, ${d.bots} bots`}
            />
          </div>
          {/* Show every nth label to avoid overlap */}
          {(i === 0 || i === data.length - 1 || i % Math.max(Math.floor(data.length / 6), 1) === 0) && (
            <span className="text-[9px] text-gray-500 whitespace-nowrap">
              {d.date.length > 10 ? d.date.slice(5) : d.date.slice(5)}
            </span>
          )}
          {/* Tooltip on hover */}
          <div className="absolute bottom-full mb-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
            {d.date} — {d.visits} visits, {d.unique} unique, {d.bots} bots
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visitsByTime: VisitTimeEntry[];
  deviceBreakdown: DeviceEntry[];
  browserBreakdown: BrowserEntry[];
  osBreakdown: OSEntry[];
  topCountries: CountryEntry[];
  topReferrers: ReferrerEntry[];
  topPages: PageEntry[];
  topSearchQueries: SearchQueryEntry[];
  botStats: BotEntry[];
}

// ─── Category colors ────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  hero: "text-yellow-400",
  landing: "text-cyan-400",
  app: "text-blue-400",
  auth: "text-purple-400",
  admin: "text-red-400",
  other: "text-gray-400",
};

function DeviceIcon({ device }: { device: string }) {
  switch (device) {
    case "mobile":
      return <Smartphone className="h-3 w-3" />;
    case "tablet":
      return <Tablet className="h-3 w-3" />;
    default:
      return <Monitor className="h-3 w-3" />;
  }
}

export default function VisitorCharts({
  visitsByTime,
  deviceBreakdown,
  browserBreakdown,
  osBreakdown,
  topCountries,
  topReferrers,
  topPages,
  topSearchQueries,
  botStats,
}: Props) {
  const maxDevice = Math.max(...deviceBreakdown.map((d) => d.count), 1);
  const maxBrowser = Math.max(...browserBreakdown.map((d) => d.count), 1);
  const maxOS = Math.max(...osBreakdown.map((d) => d.count), 1);
  const maxCountry = Math.max(...topCountries.map((d) => d.count), 1);
  const maxReferrer = Math.max(...topReferrers.map((d) => d.count), 1);
  const maxSearch = Math.max(...topSearchQueries.map((d) => d.count), 1);
  const maxBot = Math.max(...botStats.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Visits Over Time */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">
            Visits Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <TimeSeriesChart data={visitsByTime} />
        </CardContent>
      </Card>

      {/* Row: Device, Browser, OS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Monitor className="h-4 w-4" /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={deviceBreakdown.map((d) => ({ key: d.device, value: d.count }))}
              maxVal={maxDevice}
              label="device"
              color="bg-purple-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> Browsers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={browserBreakdown.map((d) => ({ key: d.browser, value: d.count }))}
              maxVal={maxBrowser}
              label="browser"
              color="bg-cyan-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Monitor className="h-4 w-4" /> Operating Systems
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={osBreakdown.map((d) => ({ key: d.os, value: d.count }))}
              maxVal={maxOS}
              label="OS"
              color="bg-emerald-500"
            />
          </CardContent>
        </Card>
      </div>

      {/* Row: Countries, Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> Top Countries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={topCountries.map((d) => ({ key: d.country, value: d.count }))}
              maxVal={maxCountry}
              label="country"
              color="bg-blue-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Link2 className="h-4 w-4" /> Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={topReferrers.map((d) => ({
                key: d.referrer.length > 40 ? d.referrer.slice(0, 40) + "…" : d.referrer,
                value: d.count,
              }))}
              maxVal={maxReferrer}
              label="referrer"
              color="bg-orange-500"
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Top Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {topPages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No data</p>
            ) : (
              topPages.slice(0, 30).map((p) => (
                <div
                  key={p.path}
                  className="flex items-center gap-2 text-xs p-1.5 rounded bg-gray-900/30"
                >
                  <span className="font-mono text-white truncate flex-1">
                    {p.path}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${CAT_COLORS[p.category] || CAT_COLORS.other}`}
                  >
                    {p.category}
                  </Badge>
                  <span className="text-gray-400 w-[50px] text-right">
                    {p.visits} vis
                  </span>
                  <span className="text-gray-500 w-[50px] text-right">
                    {p.unique} unq
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Row: Search Queries, Bot Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Search Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={topSearchQueries.map((d) => ({ key: d.query, value: d.count }))}
              maxVal={maxSearch}
              label="search query"
              color="bg-green-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Bot className="h-4 w-4" /> Bot Traffic
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <BarChart
              data={botStats.map((d) => ({ key: d.botName, value: d.count }))}
              maxVal={maxBot}
              label="bot"
              color="bg-yellow-500"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
