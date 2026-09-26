"use client";

import {
  Bot,
  AlertTriangle,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  ShieldBan,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecentVisit } from "./visitor-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_BADGES: Record<string, string> = {
  hero: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  landing: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  app: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  auth: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visits: RecentVisit[];
  onBlockIp: (ip: string) => void;
}

export default function VisitorHistory({ visits, onBlockIp }: Props) {
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">
          Visit History (Latest 100)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">Page</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Country</th>
                <th className="text-left py-2 px-2">Device</th>
                <th className="text-left py-2 px-2">Browser</th>
                <th className="text-left py-2 px-2">OS</th>
                <th className="text-left py-2 px-2">IP</th>
                <th className="text-left py-2 px-2">Flags</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-6 text-gray-500"
                  >
                    No visit history
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr
                    key={v._id}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">
                      {formatDate(v.visitedAt)}
                    </td>
                    <td className="py-1.5 px-2 text-white font-mono max-w-[200px] truncate">
                      {v.path}
                    </td>
                    <td className="py-1.5 px-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${CATEGORY_BADGES[v.pageCategory] || CATEGORY_BADGES.other}`}
                      >
                        {v.pageCategory}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 text-gray-400">
                      {v.country ? (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {v.country}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="flex items-center gap-1 text-gray-400">
                        <DeviceIcon device={v.device} />
                        {v.device}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-gray-400">
                      {v.browser || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-gray-400">
                      {v.os || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-gray-500 font-mono">
                      {v.ip ? v.ip.slice(0, 15) : "—"}
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex gap-1">
                        {v.isBot && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          >
                            <Bot className="h-3 w-3 mr-0.5" />
                            {v.botName || "Bot"}
                          </Badge>
                        )}
                        {v.isSuspicious && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30"
                            title={v.suspiciousReason}
                          >
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            Suspicious
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {v.ip && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => onBlockIp(v.ip)}
                        >
                          <ShieldBan className="h-3 w-3 mr-0.5" />
                          Block
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
