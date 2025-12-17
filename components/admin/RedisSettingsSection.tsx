'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Zap, 
  Shield, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Server,
  Gauge,
  ListOrdered,
  Trash2,
  Wifi,
  WifiOff,
  Radio,
  TrendingUp,
  Settings2,
  Timer,
  RotateCcw,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface RedisSettings {
  upstashRedisUrl: string;
  upstashRedisToken: string;
  redisEnabled: boolean;
  redisPriceSyncEnabled: boolean; // Enable for multi-server deployments
  inngestSigningKey: string;
  inngestEventKey: string;
  inngestMode: 'dev' | 'cloud';
  // Price Feed Settings
  priceFeedMode: 'websocket' | 'api' | 'both';
  priceFeedWebsocketEnabled: boolean;
  priceFeedApiEnabled: boolean;
  priceFeedPrimarySource: 'websocket' | 'api';
  priceFeedUpdateInterval: number;
  priceFeedCacheTTL: number;
  priceFeedClientPollInterval: number;
  priceFeedWebsocketReconnectAttempts: number;
  priceFeedWebsocketReconnectDelay: number;
  priceFeedApiConcurrency: number;
  priceFeedFallbackEnabled: boolean;
}

interface CacheStats {
  connected: boolean;
  pricesCached: number;
  queuePending: number;
  queueProcessing: number;
  latency?: number;
}

interface WebSocketStatus {
  connected: boolean;
  authenticated: boolean;
  subscribed: boolean;
  cachedPairs: number;
  lastUpdate: number;
  reconnectAttempts: number;
}

export default function RedisSettingsSection() {
  const [settings, setSettings] = useState<RedisSettings>({
    upstashRedisUrl: '',
    upstashRedisToken: '',
    redisEnabled: false,
    redisPriceSyncEnabled: false,
    inngestSigningKey: '',
    inngestEventKey: '',
    inngestMode: 'dev',
    // Price Feed defaults
    priceFeedMode: 'both',
    priceFeedWebsocketEnabled: true,
    priceFeedApiEnabled: true,
    priceFeedPrimarySource: 'websocket',
    priceFeedUpdateInterval: 2000,
    priceFeedCacheTTL: 10000,
    priceFeedClientPollInterval: 500,
    priceFeedWebsocketReconnectAttempts: 10,
    priceFeedWebsocketReconnectDelay: 3000,
    priceFeedApiConcurrency: 30,
    priceFeedFallbackEnabled: true,
  });
  const [showTokens, setShowTokens] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus | null>(null);
  const [loadingWsStatus, setLoadingWsStatus] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings.redisEnabled) {
      fetchCacheStats();
      const interval = setInterval(fetchCacheStats, PERFORMANCE_INTERVALS.REDIS_STATS);
      return () => clearInterval(interval);
    }
  }, [settings.redisEnabled]);

  // Fetch WebSocket status periodically
  useEffect(() => {
    if (settings.priceFeedWebsocketEnabled) {
      fetchWebSocketStatus();
      const interval = setInterval(fetchWebSocketStatus, PERFORMANCE_INTERVALS.WEBSOCKET_STATUS);
      return () => clearInterval(interval);
    }
  }, [settings.priceFeedWebsocketEnabled]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/redis-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          upstashRedisUrl: data.upstashRedisUrl || '',
          upstashRedisToken: data.upstashRedisToken || '',
          redisEnabled: data.redisEnabled || false,
          redisPriceSyncEnabled: data.redisPriceSyncEnabled ?? false, // Enable for multi-server deployments
          inngestSigningKey: data.inngestSigningKey || '',
          inngestEventKey: data.inngestEventKey || '',
          inngestMode: data.inngestMode || 'dev',
          // Price Feed settings
          priceFeedMode: data.priceFeedMode || 'both',
          priceFeedWebsocketEnabled: data.priceFeedWebsocketEnabled ?? true,
          priceFeedApiEnabled: data.priceFeedApiEnabled ?? true,
          priceFeedPrimarySource: data.priceFeedPrimarySource || 'websocket',
          priceFeedUpdateInterval: data.priceFeedUpdateInterval || 2000,
          priceFeedCacheTTL: data.priceFeedCacheTTL || 10000,
          priceFeedClientPollInterval: data.priceFeedClientPollInterval || 500,
          priceFeedWebsocketReconnectAttempts: data.priceFeedWebsocketReconnectAttempts || 10,
          priceFeedWebsocketReconnectDelay: data.priceFeedWebsocketReconnectDelay || 3000,
          priceFeedApiConcurrency: data.priceFeedApiConcurrency || 30,
          priceFeedFallbackEnabled: data.priceFeedFallbackEnabled ?? true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load Redis settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCacheStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/admin/redis-settings/stats');
      if (response.ok) {
        const data = await response.json();
        setCacheStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchWebSocketStatus = async () => {
    setLoadingWsStatus(true);
    try {
      const response = await fetch('/api/admin/redis-settings/websocket-status');
      if (response.ok) {
        const data = await response.json();
        setWsStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch WebSocket status:', error);
    } finally {
      setLoadingWsStatus(false);
    }
  };

  const handleResetWebSocket = async () => {
    try {
      const response = await fetch('/api/admin/redis-settings/websocket-reset', {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('WebSocket connection reset initiated');
        setTimeout(fetchWebSocketStatus, 3000);
      } else {
        toast.error('Failed to reset WebSocket');
      }
    } catch (error) {
      toast.error('Failed to reset WebSocket');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/redis-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Redis settings saved successfully');
        if (settings.redisEnabled) {
          fetchCacheStats();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.upstashRedisUrl || !settings.upstashRedisToken) {
      toast.error('Please enter Redis URL and Token first');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/redis-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.upstashRedisUrl,
          token: settings.upstashRedisToken,
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast.success('Connection successful!');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({ success: false, message: 'Failed to test connection' });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the price cache?')) return;

    try {
      const response = await fetch('/api/admin/redis-settings/clear-cache', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Cache cleared successfully');
        fetchCacheStats();
      } else {
        toast.error('Failed to clear cache');
      }
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-red-400" />
            Redis Cache Settings
          </h2>
          <p className="text-gray-400 mt-1">
            Configure Upstash Redis for high-performance price caching and trade queues
          </p>
        </div>
        <a
          href="https://console.upstash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Open Upstash Console
        </a>
      </div>

      {/* Why Redis Alert */}
      <Alert className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
        <Zap className="h-4 w-4 text-red-400" />
        <AlertTitle className="text-red-400">Why Redis?</AlertTitle>
        <AlertDescription className="text-gray-300">
          <ul className="mt-2 space-y-1 text-sm">
            <li>• <strong>99% fewer API calls</strong> - One background job updates prices, all users read from cache</li>
            <li>• <strong>Sub-millisecond latency</strong> - Instant price lookups for 100K+ concurrent users</li>
            <li>• <strong>Guaranteed trade execution</strong> - Trade queue ensures no trades are lost</li>
            <li>• <strong>Rate limiting</strong> - Prevent abuse and protect your APIs</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              Upstash Redis Credentials
            </CardTitle>
            <CardDescription>
              Get these from your{' '}
              <a 
                href="https://console.upstash.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Upstash Console
              </a>
              {' '}→ Your Database → REST API section
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redis-url" className="text-gray-300">
                UPSTASH_REDIS_REST_URL
              </Label>
              <Input
                id="redis-url"
                type="text"
                placeholder="https://xyz-12345.upstash.io"
                value={settings.upstashRedisUrl}
                onChange={(e) => setSettings({ ...settings, upstashRedisUrl: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="redis-token" className="text-gray-300 flex items-center justify-between">
                <span>UPSTASH_REDIS_REST_TOKEN</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokens(!showTokens)}
                  className="h-6 text-xs text-gray-400 hover:text-white"
                >
                  {showTokens ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showTokens ? 'Hide' : 'Show'}
                </Button>
              </Label>
              <Input
                id="redis-token"
                type={showTokens ? 'text' : 'password'}
                placeholder="AXxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.upstashRedisToken}
                onChange={(e) => setSettings({ ...settings, upstashRedisToken: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
              />
            </div>

            {/* Test Connection */}
            <div className="pt-4 border-t border-gray-700">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || !settings.upstashRedisUrl || !settings.upstashRedisToken}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{testResult.message}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>{testResult.message}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Enable Switch */}
            <div className="pt-4 border-t border-gray-700 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="redis-enabled" className="text-white">
                    Enable Redis Cache
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">
                    When disabled, falls back to in-memory cache (not recommended for production)
                  </p>
                </div>
                <Switch
                  id="redis-enabled"
                  checked={settings.redisEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, redisEnabled: checked })}
                />
              </div>
              
              {/* Multi-Server Price Sync */}
              {settings.redisEnabled && (
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div>
                    <Label htmlFor="redis-price-sync" className="text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-400" />
                      Multi-Server Price Sync
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Sync WebSocket prices to Redis for multiple server deployments
                    </p>
                    <p className="text-xs text-yellow-500 mt-1">
                      ⚠️ Only enable if running 2+ app servers behind a load balancer
                    </p>
                  </div>
                  <Switch
                    id="redis-price-sync"
                    checked={settings.redisPriceSyncEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, redisPriceSyncEnabled: checked })}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-yellow-400" />
                  Cache Status
                </CardTitle>
                <CardDescription>
                  Real-time cache statistics
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchCacheStats}
                disabled={loadingStats || !settings.redisEnabled}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!settings.redisEnabled ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mb-3 text-yellow-500/50" />
                <p className="text-center">Enable Redis to see cache statistics</p>
              </div>
            ) : cacheStats ? (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-300">Connection</span>
                  </div>
                  <Badge
                    variant={cacheStats.connected ? 'default' : 'destructive'}
                    className={cacheStats.connected ? 'bg-green-500/20 text-green-400' : ''}
                  >
                    {cacheStats.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>

                {/* Prices Cached */}
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-300">Prices Cached</span>
                  </div>
                  <span className="text-white font-semibold">
                    {cacheStats.pricesCached} / 30 pairs
                  </span>
                </div>

                {/* Queue Stats */}
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-300">Trade Queue</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      Pending: <span className="text-yellow-400">{cacheStats.queuePending}</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      Processing: <span className="text-blue-400">{cacheStats.queueProcessing}</span>
                    </span>
                  </div>
                </div>

                {/* Latency */}
                {cacheStats.latency !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Latency</span>
                    </div>
                    <span className="text-white font-semibold">
                      {cacheStats.latency}ms
                    </span>
                  </div>
                )}

                {/* Clear Cache Button */}
                <div className="pt-4 border-t border-gray-700">
                  <Button
                    variant="outline"
                    onClick={handleClearCache}
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Price Cache
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inngest Configuration */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-400" />
            Inngest Configuration (Background Jobs)
          </CardTitle>
          <CardDescription>
            Inngest handles background tasks like price updates, margin monitoring, and competition status updates.
            <br />
            <span className="text-green-400">• Local dev:</span> Run <code className="bg-gray-900 px-1 rounded">npx inngest-cli@latest dev</code> - no keys needed!
            <br />
            <span className="text-blue-400">• Production:</span> Get keys from{' '}
            <a 
              href="https://app.inngest.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              app.inngest.com
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white font-medium">Inngest Mode</Label>
                <p className="text-xs text-gray-500 mt-1">
                  {settings.inngestMode === 'dev' 
                    ? '🔧 Dev Mode: Using local inngest-cli dev server' 
                    : '☁️ Cloud Mode: Using Inngest Cloud (requires keys)'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${settings.inngestMode === 'dev' ? 'text-green-400' : 'text-gray-500'}`}>
                  Dev
                </span>
                <Switch
                  checked={settings.inngestMode === 'cloud'}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, inngestMode: checked ? 'cloud' : 'dev' })
                  }
                />
                <span className={`text-sm ${settings.inngestMode === 'cloud' ? 'text-blue-400' : 'text-gray-500'}`}>
                  Cloud
                </span>
              </div>
            </div>
            
            {settings.inngestMode === 'cloud' && !settings.inngestSigningKey && (
              <Alert className="mt-3 bg-yellow-500/10 border-yellow-500/30">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-yellow-200 text-sm">
                  Cloud mode requires Signing Key and Event Key from app.inngest.com
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inngest-signing" className="text-gray-300">
                INNGEST_SIGNING_KEY
              </Label>
              <Input
                id="inngest-signing"
                type={showTokens ? 'text' : 'password'}
                placeholder="signkey-prod-xxxxxxxx"
                value={settings.inngestSigningKey}
                onChange={(e) => setSettings({ ...settings, inngestSigningKey: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
                disabled={settings.inngestMode === 'dev'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inngest-event" className="text-gray-300">
                INNGEST_EVENT_KEY
              </Label>
              <Input
                id="inngest-event"
                type={showTokens ? 'text' : 'password'}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={settings.inngestEventKey}
                onChange={(e) => setSettings({ ...settings, inngestEventKey: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
                disabled={settings.inngestMode === 'dev'}
              />
            </div>
          </div>

          {settings.inngestMode === 'dev' ? (
            <Alert className="bg-green-500/10 border-green-500/30">
              <Server className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-gray-300 text-sm">
                <strong>Dev Mode Active:</strong> Using local Inngest dev server.
                <br />
                Run <code className="bg-gray-900 px-1 rounded">npx inngest-cli@latest dev</code> and open <code className="bg-gray-900 px-1 rounded">localhost:8288</code>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-blue-500/10 border-blue-500/30">
              <Zap className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-gray-300 text-sm">
                <strong>Cloud Mode Active:</strong> Using Inngest Cloud for production.
                <br />
                Your functions will run on Inngest&apos;s infrastructure with automatic retries and monitoring.
                <br />
                View dashboard at{' '}
                <a href="https://app.inngest.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  app.inngest.com
                </a>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Price Feed Configuration */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            Price Feed Configuration
          </CardTitle>
          <CardDescription>
            Configure how real-time forex prices are fetched from Massive.com.
            WebSocket provides faster updates (~10-50ms), while REST API is more reliable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Feed Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, priceFeedMode: 'websocket', priceFeedWebsocketEnabled: true, priceFeedApiEnabled: false })}
              className={`p-4 rounded-lg border-2 transition-all ${
                settings.priceFeedMode === 'websocket' 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <Wifi className={`h-8 w-8 mx-auto mb-2 ${settings.priceFeedMode === 'websocket' ? 'text-cyan-400' : 'text-gray-500'}`} />
              <h4 className={`font-semibold ${settings.priceFeedMode === 'websocket' ? 'text-cyan-400' : 'text-white'}`}>
                WebSocket Only
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Real-time streaming (~10-50ms)
              </p>
              <Badge className="mt-2 bg-cyan-500/20 text-cyan-400">Fastest</Badge>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, priceFeedMode: 'api', priceFeedWebsocketEnabled: false, priceFeedApiEnabled: true })}
              className={`p-4 rounded-lg border-2 transition-all ${
                settings.priceFeedMode === 'api' 
                  ? 'border-orange-500 bg-orange-500/10' 
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <Radio className={`h-8 w-8 mx-auto mb-2 ${settings.priceFeedMode === 'api' ? 'text-orange-400' : 'text-gray-500'}`} />
              <h4 className={`font-semibold ${settings.priceFeedMode === 'api' ? 'text-orange-400' : 'text-white'}`}>
                REST API Only
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Polling-based (~200-500ms)
              </p>
              <Badge className="mt-2 bg-orange-500/20 text-orange-400">Reliable</Badge>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, priceFeedMode: 'both', priceFeedWebsocketEnabled: true, priceFeedApiEnabled: true, priceFeedFallbackEnabled: true })}
              className={`p-4 rounded-lg border-2 transition-all ${
                settings.priceFeedMode === 'both' 
                  ? 'border-green-500 bg-green-500/10' 
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <Layers className={`h-8 w-8 mx-auto mb-2 ${settings.priceFeedMode === 'both' ? 'text-green-400' : 'text-gray-500'}`} />
              <h4 className={`font-semibold ${settings.priceFeedMode === 'both' ? 'text-green-400' : 'text-white'}`}>
                Both (Recommended)
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                WebSocket primary, API fallback
              </p>
              <Badge className="mt-2 bg-green-500/20 text-green-400">Best</Badge>
            </button>
          </div>

          {/* WebSocket Status */}
          {settings.priceFeedWebsocketEnabled && (
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-cyan-400" />
                  WebSocket Status
                </h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchWebSocketStatus}
                    disabled={loadingWsStatus}
                    className="text-gray-400 hover:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingWsStatus ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetWebSocket}
                    className="text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/10"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
              
              {wsStatus ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400">Connection</div>
                    <div className="flex items-center gap-2 mt-1">
                      {wsStatus.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className={wsStatus.connected ? 'text-green-400' : 'text-red-400'}>
                        {wsStatus.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400">Authenticated</div>
                    <div className="flex items-center gap-2 mt-1">
                      {wsStatus.authenticated ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-yellow-400" />
                      )}
                      <span className={wsStatus.authenticated ? 'text-green-400' : 'text-yellow-400'}>
                        {wsStatus.authenticated ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400">Subscribed</div>
                    <div className="flex items-center gap-2 mt-1">
                      {wsStatus.subscribed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-yellow-400" />
                      )}
                      <span className={wsStatus.subscribed ? 'text-green-400' : 'text-yellow-400'}>
                        {wsStatus.subscribed ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400">Pairs Cached</div>
                    <div className="text-white font-semibold mt-1">
                      {wsStatus.cachedPairs} / 33
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading status...
                </div>
              )}
            </div>
          )}

          {/* Primary Source (when both enabled) */}
          {settings.priceFeedMode === 'both' && (
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <Label className="text-white">Primary Source</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Which source to use first when both are enabled
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${settings.priceFeedPrimarySource === 'websocket' ? 'text-cyan-400' : 'text-gray-500'}`}>
                  WebSocket
                </span>
                <Switch
                  checked={settings.priceFeedPrimarySource === 'api'}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, priceFeedPrimarySource: checked ? 'api' : 'websocket' })
                  }
                />
                <span className={`text-sm ${settings.priceFeedPrimarySource === 'api' ? 'text-orange-400' : 'text-gray-500'}`}>
                  API
                </span>
              </div>
            </div>
          )}

          {/* Auto Fallback */}
          {settings.priceFeedMode === 'both' && (
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <Label className="text-white flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-yellow-400" />
                  Auto Fallback
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically switch to API if WebSocket fails
                </p>
              </div>
              <Switch
                checked={settings.priceFeedFallbackEnabled}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, priceFeedFallbackEnabled: checked })
                }
              />
            </div>
          )}

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-gray-400" />
              Advanced Settings
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Timer className="h-3 w-3" />
                  Client Poll Interval (ms)
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedClientPollInterval}
                  onChange={(e) => setSettings({ ...settings, priceFeedClientPollInterval: parseInt(e.target.value) || 500 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={100}
                  max={5000}
                />
                <p className="text-xs text-gray-500">How often client requests prices</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Cache Update Interval (ms)
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedUpdateInterval}
                  onChange={(e) => setSettings({ ...settings, priceFeedUpdateInterval: parseInt(e.target.value) || 2000 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={500}
                  max={10000}
                />
                <p className="text-xs text-gray-500">How often to sync to Redis</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Cache TTL (ms)
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedCacheTTL}
                  onChange={(e) => setSettings({ ...settings, priceFeedCacheTTL: parseInt(e.target.value) || 10000 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={1000}
                  max={60000}
                />
                <p className="text-xs text-gray-500">How long prices are considered valid</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <RotateCcw className="h-3 w-3" />
                  WebSocket Reconnect Attempts
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedWebsocketReconnectAttempts}
                  onChange={(e) => setSettings({ ...settings, priceFeedWebsocketReconnectAttempts: parseInt(e.target.value) || 10 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={1}
                  max={50}
                />
                <p className="text-xs text-gray-500">Max reconnection attempts</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Timer className="h-3 w-3" />
                  Reconnect Delay (ms)
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedWebsocketReconnectDelay}
                  onChange={(e) => setSettings({ ...settings, priceFeedWebsocketReconnectDelay: parseInt(e.target.value) || 3000 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={1000}
                  max={30000}
                />
                <p className="text-xs text-gray-500">Base delay between retries</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  API Concurrency
                </Label>
                <Input
                  type="number"
                  value={settings.priceFeedApiConcurrency}
                  onChange={(e) => setSettings({ ...settings, priceFeedApiConcurrency: parseInt(e.target.value) || 30 })}
                  className="bg-gray-900 border-gray-700 text-white"
                  min={1}
                  max={50}
                />
                <p className="text-xs text-gray-500">Parallel API requests</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-semibold px-8"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

