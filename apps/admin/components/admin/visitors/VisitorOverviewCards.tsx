"use client";

import {
  Users,
  Eye,
  Bot,
  AlertTriangle,
  ShieldBan,
  Clock,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { VisitorOverview, LiveData } from "./visitor-types";

interface Props {
  overview: VisitorOverview | null;
  liveData: LiveData | null;
}

export default function VisitorOverviewCards({ overview, liveData }: Props) {
  const cards = [
    {
      label: "Live Now",
      value: liveData?.activeCount ?? 0,
      icon: Activity,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      pulse: true,
    },
    {
      label: "Total Visits",
      value: overview?.totalVisits ?? 0,
      icon: Eye,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Unique Visitors",
      value: overview?.uniqueVisitors ?? 0,
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
    },
    {
      label: "Bots Detected",
      value: overview?.totalBots ?? 0,
      icon: Bot,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
    },
    {
      label: "Suspicious",
      value: overview?.totalSuspicious ?? 0,
      icon: AlertTriangle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
    },
    {
      label: "Blocked",
      value: overview?.totalBlocked ?? 0,
      icon: ShieldBan,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    },
    {
      label: "Avg Duration",
      value: overview?.avgDuration
        ? `${Math.round(overview.avgDuration)}s`
        : "—",
      icon: Clock,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={`${card.bgColor} border ${card.borderColor}`}
        >
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
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-gray-400">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
