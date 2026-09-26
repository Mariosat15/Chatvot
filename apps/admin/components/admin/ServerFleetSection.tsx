"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Server,
  RefreshCw,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Clock,
  Trash2,
  Shield,
  ShieldCheck,
  Activity,
  Users,
  Database,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServerStats {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  pm2Processes: number;
  pm2Online: number;
  redisConnected: boolean;
  wsConnections: number;
  nodeVersion: string;
}

interface PM2Process {
  name: string;
  status: string;
  cpu: number;
  memoryMB: number;
  uptime: number;
  restarts: number;
}

interface ServerData {
  _id: string;
  serverId: string;
  hostname: string;
  ip: string;
  role: "primary" | "secondary";
  status: "online" | "offline" | "degraded";
  lastHeartbeat: string;
  stats: ServerStats;
  version: string;
  startedAt: string;
  domain: string;
  pm2Processes: PM2Process[];
  timeSinceHeartbeat: number;
}

interface FleetSummary {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  primary: number;
  secondary: number;
  totalWSConnections: number;
  avgCPU: number;
  avgMemory: number;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function ServerFleetSection() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFleet = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch("/api/server-fleet");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setServers(data.servers || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error("Failed to fetch server fleet:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(() => fetchFleet(), 30000);
    return () => clearInterval(interval);
  }, [fetchFleet]);

  const handleRemoveServer = async (serverId: string, hostname: string) => {
    if (
      !confirm(
        `Remove server "${hostname}" (${serverId}) from the fleet? This only removes the tracking entry, not the actual server.`,
      )
    ) {
      return;
    }
    try {
      const response = await fetch(
        `/api/server-fleet?serverId=${encodeURIComponent(serverId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete");
      toast.success(`Server "${hostname}" removed from fleet`);
      fetchFleet();
    } catch {
      toast.error("Failed to remove server");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "degraded":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "offline":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getRoleColor = (role: string) => {
    return role === "primary"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : "bg-purple-500/20 text-purple-400 border-purple-500/30";
  };

  const getProgressColor = (percent: number) => {
    if (percent > 90) return "bg-red-500";
    if (percent > 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-400" />
            Server Fleet
          </h2>
          <p className="text-gray-400 mt-1">
            Monitor all VPS servers in your deployment
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchFleet(true)}
          disabled={refreshing}
          className="border-gray-700"
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {summary.total}
              </div>
              <div className="text-xs text-gray-400 mt-1">Total Servers</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {summary.online}
              </div>
              <div className="text-xs text-gray-400 mt-1">Online</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50">
            <CardContent className="p-4 text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  summary.offline > 0 ? "text-red-400" : "text-gray-500",
                )}
              >
                {summary.offline}
              </div>
              <div className="text-xs text-gray-400 mt-1">Offline</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {summary.totalWSConnections}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                WebSocket Connections
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">
                {summary.avgCPU}%
              </div>
              <div className="text-xs text-gray-400 mt-1">Avg CPU</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Servers */}
      {servers.length === 0 && (
        <Card className="bg-gray-800/50">
          <CardContent className="p-12 text-center">
            <Server className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300">
              No servers registered
            </h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Servers register automatically when they start. The heartbeat
              service sends stats every 30 seconds. Make sure your app is
              running with the latest code that includes the heartbeat service.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Server Cards */}
      {servers.map((server) => (
        <Card key={server.serverId} className="bg-gray-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {server.role === "primary" ? (
                  <ShieldCheck className="h-5 w-5 text-blue-400" />
                ) : (
                  <Shield className="h-5 w-5 text-purple-400" />
                )}
                <div>
                  <CardTitle className="text-lg text-white">
                    {server.hostname}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    {server.ip || "IP unknown"} &middot; {server.domain || "No domain"}{" "}
                    &middot; v{server.version || "?"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getRoleColor(server.role)}>
                  {server.role}
                </Badge>
                <Badge
                  variant="outline"
                  className={getStatusColor(server.status)}
                >
                  {server.status === "online" && (
                    <Wifi className="h-3 w-3 mr-1" />
                  )}
                  {server.status === "offline" && (
                    <WifiOff className="h-3 w-3 mr-1" />
                  )}
                  {server.status === "degraded" && (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {server.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-red-400"
                  onClick={() =>
                    handleRemoveServer(server.serverId, server.hostname)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resource Bars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5" /> CPU
                  </span>
                  <span className="text-white font-medium">
                    {server.stats?.cpuPercent || 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getProgressColor(server.stats?.cpuPercent || 0),
                    )}
                    style={{
                      width: `${Math.min(server.stats?.cpuPercent || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Memory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <MemoryStick className="h-3.5 w-3.5" /> Memory
                  </span>
                  <span className="text-white font-medium">
                    {server.stats?.memoryUsedMB || 0}MB /{" "}
                    {server.stats?.memoryTotalMB || 0}MB
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getProgressColor(server.stats?.memoryPercent || 0),
                    )}
                    style={{
                      width: `${Math.min(server.stats?.memoryPercent || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Disk */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" /> Disk
                  </span>
                  <span className="text-white font-medium">
                    {server.stats?.diskUsedGB || 0}GB /{" "}
                    {server.stats?.diskTotalGB || 0}GB
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getProgressColor(server.stats?.diskPercent || 0),
                    )}
                    style={{
                      width: `${Math.min(server.stats?.diskPercent || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-gray-700/50" />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Activity className="h-3.5 w-3.5 text-green-400" />
                <span>
                  PM2: {server.stats?.pm2Online || 0}/
                  {server.stats?.pm2Processes || 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Users className="h-3.5 w-3.5 text-cyan-400" />
                <span>WS: {server.stats?.wsConnections || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Database
                  className={cn(
                    "h-3.5 w-3.5",
                    server.stats?.redisConnected
                      ? "text-green-400"
                      : "text-red-400",
                  )}
                />
                <span>
                  Redis: {server.stats?.redisConnected ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="h-3.5 w-3.5 text-yellow-400" />
                <span>
                  Heartbeat: {formatTimeAgo(server.timeSinceHeartbeat)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Server className="h-3.5 w-3.5 text-gray-500" />
                <span>Node {server.stats?.nodeVersion || "?"}</span>
              </div>
            </div>

            {/* PM2 Processes Detail */}
            {server.pm2Processes && server.pm2Processes.length > 0 && (
              <>
                <Separator className="bg-gray-700/50" />
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    PM2 Processes
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {server.pm2Processes.map((proc, idx) => (
                      <div
                        key={`${proc.name}-${idx}`}
                        className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              proc.status === "online"
                                ? "bg-green-400"
                                : proc.status === "stopping"
                                  ? "bg-yellow-400"
                                  : "bg-red-400",
                            )}
                          />
                          <span className="text-gray-300 font-mono">
                            {proc.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>{proc.cpu}% CPU</span>
                          <span>{proc.memoryMB}MB</span>
                          {proc.restarts > 0 && (
                            <span className="text-yellow-500">
                              {proc.restarts} restarts
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
