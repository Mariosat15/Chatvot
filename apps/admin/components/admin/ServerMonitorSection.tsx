'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Play,
  Square,
  Clock,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

interface ProcessStats {
  name: string;
  pid: number;
  status: string;
  cpu: number;
  memory: number;
  memoryMB: number;
  uptime: number;
  restarts: number;
}

interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  loadAverage: number[];
  uptime: number;
}

interface CollectionStats {
  name: string;
  documents: number;
  sizeMB: number;
  storageSizeMB: number;
  indexSizeMB: number;
}

interface DatabaseStats {
  database: {
    name: string;
    sizeMB: number;
    storageSizeMB: number;
    collections: number;
    documents: number;
    indexes: number;
    indexSizeMB: number;
  };
  collections: CollectionStats[];
}

interface ServerStats {
  processes: ProcessStats[];
  system: SystemStats;
  websocket: {
    connections: number;
    subscribedSymbols: number;
  };
  database: DatabaseStats | null;
  timestamp: number;
}

interface HistoryPoint {
  time: string;
  timestamp: number;
  webCpu: number;
  webMemory: number;
  wsCpu: number;
  wsMemory: number;
  systemMemory: number;
  connections: number;
}

const MAX_HISTORY_POINTS = 60; // 1 minute of data at 1 second intervals

export default function ServerMonitorSection() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(1000); // 1 second
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/server-monitor');
      if (!response.ok) throw new Error('Failed to fetch server stats');
      
      const data: ServerStats = await response.json();
      setStats(data);
      setError(null);
      
      // Add to history
      const webProcess = data.processes.find(p => p.name.includes('web'));
      const wsProcess = data.processes.find(p => p.name.includes('websocket'));
      
      const point: HistoryPoint = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        timestamp: data.timestamp,
        webCpu: webProcess?.cpu || 0,
        webMemory: webProcess?.memoryMB || 0,
        wsCpu: wsProcess?.cpu || 0,
        wsMemory: wsProcess?.memoryMB || 0,
        systemMemory: data.system.memoryUsagePercent,
        connections: data.websocket.connections,
      };
      
      setHistory(prev => {
        const newHistory = [...prev, point];
        if (newHistory.length > MAX_HISTORY_POINTS) {
          return newHistory.slice(-MAX_HISTORY_POINTS);
        }
        return newHistory;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    fetchStats(); // Fetch immediately
    intervalRef.current = setInterval(fetchStats, refreshInterval);
    toast.success('Live monitoring started');
  }, [fetchStats, refreshInterval]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    toast.info('Live monitoring stopped');
  }, []);

  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'stopping': return 'bg-yellow-500';
      case 'stopped': return 'bg-red-500';
      case 'errored': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getCpuColor = (cpu: number): string => {
    if (cpu < 30) return 'text-green-400';
    if (cpu < 60) return 'text-yellow-400';
    if (cpu < 80) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMemoryColor = (percent: number): string => {
    if (percent < 50) return 'text-green-400';
    if (percent < 70) return 'text-yellow-400';
    if (percent < 85) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-lime-400" />
            Server Monitor
          </h2>
          <p className="text-zinc-400 mt-1">
            Real-time monitoring of server processes and resources
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Live Indicator */}
          <div className="flex items-center gap-2">
            {isMonitoring ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50 animate-pulse">
                <Wifi className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            ) : (
              <Badge className="bg-zinc-700 text-zinc-400">
                <WifiOff className="h-3 w-3 mr-1" />
                PAUSED
              </Badge>
            )}
          </div>
          
          {/* Toggle */}
          <div className="flex items-center gap-2">
            <Label htmlFor="monitoring-toggle" className="text-zinc-400">
              Live Monitoring
            </Label>
            <Switch
              id="monitoring-toggle"
              checked={isMonitoring}
              onCheckedChange={toggleMonitoring}
            />
          </div>
          
          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            className="border-zinc-700"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* System Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-400" />
                  <span className="text-zinc-400 text-sm">CPU Cores</span>
                </div>
                <span className="text-2xl font-bold text-white">{stats.system.cpuCount}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-purple-400" />
                  <span className="text-zinc-400 text-sm">Memory</span>
                </div>
                <span className={cn("text-2xl font-bold", getMemoryColor(stats.system.memoryUsagePercent))}>
                  {stats.system.memoryUsagePercent.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={stats.system.memoryUsagePercent} 
                className="mt-2 h-1.5" 
              />
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">WS Connections</span>
                </div>
                <span className="text-2xl font-bold text-white">{stats.websocket.connections}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-400" />
                  <span className="text-zinc-400 text-sm">System Uptime</span>
                </div>
                <span className="text-2xl font-bold text-white">{formatUptime(stats.system.uptime)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Database Stats */}
      {stats?.database && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-cyan-400" />
              Database Storage
              <Badge variant="outline" className="ml-2 text-xs">
                {stats.database.database.name}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Database Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-400 text-xs mb-1">Data Size</div>
                <div className="text-xl font-bold text-cyan-400">
                  {stats.database.database.sizeMB.toFixed(2)} MB
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-400 text-xs mb-1">Storage Size</div>
                <div className="text-xl font-bold text-blue-400">
                  {stats.database.database.storageSizeMB.toFixed(2)} MB
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-400 text-xs mb-1">Index Size</div>
                <div className="text-xl font-bold text-purple-400">
                  {stats.database.database.indexSizeMB.toFixed(2)} MB
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-400 text-xs mb-1">Total Documents</div>
                <div className="text-xl font-bold text-green-400">
                  {stats.database.database.documents.toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Collection Stats Table */}
            <div className="text-zinc-400 text-xs mb-2">Candle Collections:</div>
            <div className="bg-zinc-800/30 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs border-b border-zinc-700/50">
                    <th className="text-left px-3 py-2">Collection</th>
                    <th className="text-right px-3 py-2">Documents</th>
                    <th className="text-right px-3 py-2">Size</th>
                    <th className="text-right px-3 py-2">Index</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.database.collections.map((col) => (
                    <tr key={col.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 font-mono text-zinc-300">{col.name}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">{col.documents.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn(
                          col.sizeMB > 100 ? 'text-yellow-400' : 
                          col.sizeMB > 50 ? 'text-blue-400' : 'text-green-400'
                        )}>
                          {col.sizeMB.toFixed(2)} MB
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">{col.indexSizeMB.toFixed(2)} MB</td>
                    </tr>
                  ))}
                  {stats.database.collections.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                        No candle collections found
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700/50 bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium text-zinc-300">Total</td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-300">
                      {stats.database.collections.reduce((sum, c) => sum + c.documents, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-cyan-400">
                      {stats.database.collections.reduce((sum, c) => sum + c.sizeMB, 0).toFixed(2)} MB
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-400">
                      {stats.database.collections.reduce((sum, c) => sum + c.indexSizeMB, 0).toFixed(2)} MB
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.processes.map((process) => (
            <Card key={process.name} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-zinc-400" />
                    <CardTitle className="text-lg">{process.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", getStatusColor(process.status))} />
                    <Badge variant="outline" className="text-xs">
                      PID: {process.pid}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400 text-sm">CPU</span>
                      <span className={cn("font-mono font-bold", getCpuColor(process.cpu))}>
                        {process.cpu.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={process.cpu} className="h-2" />
                  </div>
                  
                  {/* Memory */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400 text-sm">Memory</span>
                      <span className="font-mono font-bold text-purple-400">
                        {process.memoryMB.toFixed(0)} MB
                      </span>
                    </div>
                    <Progress value={(process.memoryMB / 500) * 100} className="h-2" />
                  </div>
                </div>
                
                <Separator className="my-3 bg-zinc-800" />
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Uptime: {formatUptime(process.uptime)}</span>
                  <span className="text-zinc-500">Restarts: {process.restarts}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {history.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CPU Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5 text-blue-400" />
                CPU Usage Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="webCpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="wsCpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="webCpu" 
                      name="Web App" 
                      stroke="#3b82f6" 
                      fill="url(#webCpuGradient)"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="wsCpu" 
                      name="WebSocket" 
                      stroke="#22c55e" 
                      fill="url(#wsCpuGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Memory Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MemoryStick className="h-5 w-5 text-purple-400" />
                Memory Usage Over Time (MB)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="webMemGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="wsMemGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="webMemory" 
                      name="Web App" 
                      stroke="#8b5cf6" 
                      fill="url(#webMemGradient)"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="wsMemory" 
                      name="WebSocket" 
                      stroke="#f59e0b" 
                      fill="url(#wsMemGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Connections Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-green-400" />
                WebSocket Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="connections" 
                      name="Connections" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* System Memory Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-orange-400" />
                System Memory Usage (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="sysMemGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="systemMemory" 
                      name="System Memory" 
                      stroke="#f97316" 
                      fill="url(#sysMemGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Data State */}
      {!stats && !error && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Loading server statistics...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
