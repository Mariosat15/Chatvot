"use client";

import {
  Users,
  Eye,
  Bot,
  AlertTriangle,
  ShieldBan,
  Clock,
  Activity,
  ArrowDownUp,
  MousePointerClick,
  UserPlus,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { VisitorOverview, LiveData } from "./visitor-types";

interface Props {
  overview: VisitorOverview | null;
  liveData: LiveData | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function VisitorOverviewCards({ overview, liveData }: Props) {
  const cards = [
    {
      label: "Live Now",
      value: liveData?.activeCount ?? 0,
      icon: Activity,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      pulse: true,
    },
    {
      label: "Total Visits",
      value: fmt(overview?.totalVisits ?? 0),
      icon: Eye,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
    },
    {
      label: "Unique Visitors",
      value: fmt(overview?.uniqueVisitors ?? 0),
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
    },
    {
      label: "Bounce Rate",
      value: overview ? `${overview.bounceRate}%` : "—",
      icon: ArrowDownUp,
      color: overview && overview.bounceRate > 60 ? "text-red-400" : "text-teal-400",
      bg: overview && overview.bounceRate > 60 ? "bg-red-500/10" : "bg-teal-500/10",
      border: overview && overview.bounceRate > 60 ? "border-red-500/30" : "border-teal-500/30",
    },
    {
      label: "Avg Duration",
      value: overview?.avgDuration ? `${Math.round(overview.avgDuration)}s` : "—",
      icon: Clock,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
    },
    {
      label: "Pages / Session",
      value: overview?.avgPagesPerSession
        ? overview.avgPagesPerSession.toFixed(1)
        : "—",
      icon: BarChart3,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
    },
    {
      label: "Avg Scroll",
      value: overview ? `${overview.avgScrollDepth}%` : "—",
      icon: MousePointerClick,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    },
    {
      label: "New Visitors",
      value: fmt(overview?.newVisitors ?? 0),
      icon: UserPlus,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
    },
    {
      label: "Returning",
      value: fmt(overview?.returningVisitors ?? 0),
      icon: UserCheck,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
    },
    {
      label: "Bots",
      value: fmt(overview?.totalBots ?? 0),
      icon: Bot,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
    },
    {
      label: "Suspicious",
      value: fmt(overview?.totalSuspicious ?? 0),
      icon: AlertTriangle,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
    },
    {
      label: "Blocked",
      value: fmt(overview?.totalBlocked ?? 0),
      icon: ShieldBan,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bg} border ${card.border}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              {card.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-white leading-tight">
              {card.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
