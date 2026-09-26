"use client";

import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Bot,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LiveVisitor, RecentVisit } from "./visitor-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  hero: "bg-yellow-500/20 text-yellow-400",
  landing: "bg-cyan-500/20 text-cyan-400",
  app: "bg-blue-500/20 text-blue-400",
  auth: "bg-purple-500/20 text-purple-400",
  admin: "bg-red-500/20 text-red-400",
  other: "bg-gray-500/20 text-gray-400",
};

function DeviceIcon({ device }: { device: string }) {
  switch (device) {
    case "mobile":
      return <Smartphone className="h-3 w-3 text-gray-400" />;
    case "tablet":
      return <Tablet className="h-3 w-3 text-gray-400" />;
    default:
      return <Monitor className="h-3 w-3 text-gray-400" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  liveVisitors: LiveVisitor[];
  recentActivity: RecentVisit[];
  onBlockIp: (ip: string) => void;
}

export default function LiveVisitorsFeed({
  liveVisitors,
  recentActivity,
  onBlockIp,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Active Visitors */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Active Visitors ({liveVisitors.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {liveVisitors.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No active visitors right now
              </p>
            ) : (
              liveVisitors.map((v) => (
                <div
                  key={v._id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 text-xs"
                >
                  <DeviceIcon device={v.device} />
                  <span className="text-white font-mono truncate max-w-[160px]">
                    {v.lastPath}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[v.lastCategory] || CATEGORY_COLORS.other}`}
                  >
                    {v.lastCategory}
                  </Badge>
                  {v.country && (
                    <span className="text-gray-400 flex items-center gap-0.5">
                      <Globe className="h-3 w-3" />
                      {v.country}
                    </span>
                  )}
                  <span className="text-gray-500 ml-auto">
                    {v.pageViews} pg · {timeAgo(v.lastSeen)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">
            Recent Activity (Last 5 min)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No recent activity
              </p>
            ) : (
              recentActivity.map((v) => (
                <div
                  key={v._id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 text-xs"
                >
                  {v.isBot ? (
                    <Bot className="h-3 w-3 text-yellow-400 shrink-0" />
                  ) : v.isSuspicious ? (
                    <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />
                  ) : (
                    <DeviceIcon device={v.device} />
                  )}
                  <span className="text-white font-mono truncate max-w-[140px]">
                    {v.path}
                  </span>
                  {v.country && (
                    <span className="text-gray-400">{v.country}</span>
                  )}
                  <span className="text-gray-500">{v.browser}</span>
                  <span className="text-gray-600 ml-auto text-[10px]">
                    {timeAgo(v.visitedAt)}
                  </span>
                  {v.ip && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1 text-[10px] text-red-400 hover:text-red-300"
                      onClick={() => onBlockIp(v.ip)}
                      title={`Block IP: ${v.ip}`}
                    >
                      Block
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
