"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Save,
  RotateCcw,
  Loader2,
  Server,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClusterSettings {
  clusterTier: string;
  clusterName: string;
  mainMaxPoolSize: number;
  mainMinPoolSize: number;
  workerMaxPoolSize: number;
  workerMinPoolSize: number;
  adminMaxPoolSize: number;
  adminMinPoolSize: number;
  apiMaxPoolSize: number;
  apiMinPoolSize: number;
  wsMaxPoolSize: number;
  wsMinPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;
  maxIdleTimeMS: number;
}

interface TierPreset {
  label: string;
  mainMax: number;
  mainMin: number;
  workerMax: number;
  workerMin: number;
  adminMax: number;
  adminMin: number;
  apiMax: number;
  apiMin: number;
  wsMax: number;
  wsMin: number;
  desc: string;
}

const TIER_PRESETS: Record<string, TierPreset> = {
  M0: {
    label: "M0 (Free)",
    mainMax: 5, mainMin: 1,
    workerMax: 3, workerMin: 1,
    adminMax: 5, adminMin: 1,
    apiMax: 5, apiMin: 1,
    wsMax: 3, wsMin: 1,
    desc: "500 connections max, shared resources",
  },
  M2: {
    label: "M2 ($9/mo)",
    mainMax: 10, mainMin: 2,
    workerMax: 5, workerMin: 1,
    adminMax: 10, adminMin: 2,
    apiMax: 10, apiMin: 2,
    wsMax: 5, wsMin: 1,
    desc: "500 connections max, shared resources",
  },
  M5: {
    label: "M5 ($25/mo)",
    mainMax: 10, mainMin: 2,
    workerMax: 5, workerMin: 1,
    adminMax: 10, adminMin: 2,
    apiMax: 10, apiMin: 2,
    wsMax: 5, wsMin: 1,
    desc: "500 connections max, shared resources",
  },
  M10: {
    label: "M10 ($57/mo)",
    mainMax: 10, mainMin: 2,
    workerMax: 5, workerMin: 1,
    adminMax: 10, adminMin: 2,
    apiMax: 10, apiMin: 2,
    wsMax: 5, wsMin: 1,
    desc: "1,500 connections, 2 GB RAM dedicated",
  },
  M20: {
    label: "M20 ($140/mo)",
    mainMax: 20, mainMin: 3,
    workerMax: 10, workerMin: 2,
    adminMax: 15, adminMin: 2,
    apiMax: 15, apiMin: 2,
    wsMax: 5, wsMin: 1,
    desc: "1,500 connections, 4 GB RAM",
  },
  M30: {
    label: "M30 ($340/mo)",
    mainMax: 30, mainMin: 5,
    workerMax: 15, workerMin: 3,
    adminMax: 20, adminMin: 3,
    apiMax: 20, apiMin: 3,
    wsMax: 10, wsMin: 2,
    desc: "3,000 connections, 8 GB RAM",
  },
  M40: {
    label: "M40 ($560/mo)",
    mainMax: 50, mainMin: 5,
    workerMax: 20, workerMin: 3,
    adminMax: 25, adminMin: 3,
    apiMax: 25, apiMin: 3,
    wsMax: 10, wsMin: 2,
    desc: "6,000 connections, 16 GB RAM",
  },
  M50: {
    label: "M50 ($1,000/mo)",
    mainMax: 75, mainMin: 10,
    workerMax: 30, workerMin: 5,
    adminMax: 30, adminMin: 5,
    apiMax: 30, apiMin: 5,
    wsMax: 15, wsMin: 3,
    desc: "16,000 connections, 32 GB RAM",
  },
  Custom: {
    label: "Custom",
    mainMax: 10, mainMin: 2,
    workerMax: 5, workerMin: 1,
    adminMax: 10, adminMin: 2,
    apiMax: 10, apiMin: 2,
    wsMax: 5, wsMin: 1,
    desc: "Manually configured pool sizes",
  },
};

export default function MdbClusterSection() {
  const [settings, setSettings] = useState<ClusterSettings>({
    clusterTier: "M10",
    clusterName: "",
    mainMaxPoolSize: 10,
    mainMinPoolSize: 2,
    workerMaxPoolSize: 5,
    workerMinPoolSize: 1,
    adminMaxPoolSize: 10,
    adminMinPoolSize: 2,
    apiMaxPoolSize: 10,
    apiMinPoolSize: 2,
    wsMaxPoolSize: 5,
    wsMinPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
    maxIdleTimeMS: 60000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<ClusterSettings | null>(
    null,
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mdb-cluster-settings");
      const data = await res.json();
      if (data.success) {
        const s = data.settings;
        const loaded: ClusterSettings = {
          clusterTier: s.clusterTier || "M10",
          clusterName: s.clusterName || "",
          mainMaxPoolSize: s.mainMaxPoolSize ?? 10,
          mainMinPoolSize: s.mainMinPoolSize ?? 2,
          workerMaxPoolSize: s.workerMaxPoolSize ?? 5,
          workerMinPoolSize: s.workerMinPoolSize ?? 1,
          adminMaxPoolSize: s.adminMaxPoolSize ?? 10,
          adminMinPoolSize: s.adminMinPoolSize ?? 2,
          apiMaxPoolSize: s.apiMaxPoolSize ?? 10,
          apiMinPoolSize: s.apiMinPoolSize ?? 2,
          wsMaxPoolSize: s.wsMaxPoolSize ?? 5,
          wsMinPoolSize: s.wsMinPoolSize ?? 1,
          serverSelectionTimeoutMS: s.serverSelectionTimeoutMS ?? 5000,
          socketTimeoutMS: s.socketTimeoutMS ?? 30000,
          connectTimeoutMS: s.connectTimeoutMS ?? 10000,
          maxIdleTimeMS: s.maxIdleTimeMS ?? 60000,
        };
        setSettings(loaded);
        setSavedSettings(loaded);
        setHasChanges(false);
      }
    } catch {
      toast.error("Failed to load cluster settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof ClusterSettings>(
    key: K,
    value: ClusterSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(savedSettings));
      return next;
    });
  };

  const applyTierPreset = (tier: string) => {
    const preset = TIER_PRESETS[tier];
    if (!preset || tier === "Custom") {
      updateSetting("clusterTier", tier);
      return;
    }
    setSettings((prev) => {
      const next = {
        ...prev,
        clusterTier: tier,
        mainMaxPoolSize: preset.mainMax,
        mainMinPoolSize: preset.mainMin,
        workerMaxPoolSize: preset.workerMax,
        workerMinPoolSize: preset.workerMin,
        adminMaxPoolSize: preset.adminMax,
        adminMinPoolSize: preset.adminMin,
        apiMaxPoolSize: preset.apiMax,
        apiMinPoolSize: preset.apiMin,
        wsMaxPoolSize: preset.wsMax,
        wsMinPoolSize: preset.wsMin,
      };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(savedSettings));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/mdb-cluster-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Cluster settings saved. Restart PM2 processes for changes to take effect.");
        setSavedSettings({ ...settings });
        setHasChanges(false);
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save cluster settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all cluster settings to defaults?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mdb-cluster-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Cluster settings reset to defaults");
        await fetchSettings();
      } else {
        toast.error(data.error || "Failed to reset");
      }
    } catch {
      toast.error("Failed to reset cluster settings");
    } finally {
      setSaving(false);
    }
  };

  const totalEstimatedConnections =
    settings.mainMaxPoolSize +
    settings.workerMaxPoolSize +
    settings.adminMaxPoolSize +
    settings.apiMaxPoolSize +
    settings.wsMaxPoolSize;

  const tierPreset = TIER_PRESETS[settings.clusterTier];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-green-500" />
            MDB Cluster
          </h2>
          <p className="text-muted-foreground">
            MongoDB Atlas connection pool and timeout configuration. Changes
            require a PM2 restart.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Restart warning */}
      {hasChanges && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">
              Restart Required
            </p>
            <p className="text-sm text-muted-foreground">
              Connection pool changes only take effect after restarting all PM2
              processes (pm2 restart all).
            </p>
          </div>
        </div>
      )}

      {/* Tier Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Cluster Tier
          </CardTitle>
          <CardDescription>
            Select your Atlas tier to auto-fill recommended pool sizes, or choose
            Custom for manual control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Atlas Tier</Label>
              <Select
                value={settings.clusterTier}
                onValueChange={(val) => applyTierPreset(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tierPreset && (
                <p className="text-xs text-muted-foreground">
                  {tierPreset.desc}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cluster Name (optional)</Label>
              <Input
                value={settings.clusterName}
                onChange={(e) => updateSetting("clusterName", e.target.value)}
                placeholder="e.g. Chartvolt-Production"
              />
            </div>
          </div>

          {/* Connection estimate */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">
                Estimated max connections per PM2 instance:{" "}
              </span>
              <Badge variant="outline" className="ml-1">
                {totalEstimatedConnections}
              </Badge>
              <span className="text-muted-foreground ml-2">
                (Main {settings.mainMaxPoolSize} + Worker{" "}
                {settings.workerMaxPoolSize} + Admin{" "}
                {settings.adminMaxPoolSize} + API{" "}
                {settings.apiMaxPoolSize} + WS{" "}
                {settings.wsMaxPoolSize})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pool Sizes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Main App */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Main App
            </CardTitle>
            <CardDescription className="text-xs">
              User-facing Next.js
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Pool</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={settings.mainMaxPoolSize}
                onChange={(e) =>
                  updateSetting("mainMaxPoolSize", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Pool</Label>
              <Input
                type="number"
                min={0}
                max={50}
                value={settings.mainMinPoolSize}
                onChange={(e) =>
                  updateSetting("mainMinPoolSize", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Worker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Worker
            </CardTitle>
            <CardDescription className="text-xs">
              Background jobs (Agenda)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Pool</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.workerMaxPoolSize}
                onChange={(e) =>
                  updateSetting("workerMaxPoolSize", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Pool</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={settings.workerMinPoolSize}
                onChange={(e) =>
                  updateSetting("workerMinPoolSize", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Admin */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Admin
            </CardTitle>
            <CardDescription className="text-xs">
              Admin panel Next.js
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Pool</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.adminMaxPoolSize}
                onChange={(e) =>
                  updateSetting("adminMaxPoolSize", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Pool</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={settings.adminMinPoolSize}
                onChange={(e) =>
                  updateSetting("adminMinPoolSize", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* API Server */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              API Server
            </CardTitle>
            <CardDescription className="text-xs">
              Auth / bcrypt worker
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Pool</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.apiMaxPoolSize}
                onChange={(e) =>
                  updateSetting("apiMaxPoolSize", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Pool</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={settings.apiMinPoolSize}
                onChange={(e) =>
                  updateSetting("apiMinPoolSize", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* WebSocket Server */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              WebSocket
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time chat server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Pool</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={settings.wsMaxPoolSize}
                onChange={(e) =>
                  updateSetting("wsMaxPoolSize", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Pool</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={settings.wsMinPoolSize}
                onChange={(e) =>
                  updateSetting("wsMinPoolSize", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeouts</CardTitle>
          <CardDescription>
            Connection and query timeout configuration (milliseconds)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Server Selection (ms)</Label>
              <Input
                type="number"
                min={1000}
                max={30000}
                step={1000}
                value={settings.serverSelectionTimeoutMS}
                onChange={(e) =>
                  updateSetting(
                    "serverSelectionTimeoutMS",
                    Number(e.target.value),
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Fail fast if can&apos;t connect
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Socket Timeout (ms)</Label>
              <Input
                type="number"
                min={5000}
                max={120000}
                step={1000}
                value={settings.socketTimeoutMS}
                onChange={(e) =>
                  updateSetting("socketTimeoutMS", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Max time for operations
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Connect Timeout (ms)</Label>
              <Input
                type="number"
                min={2000}
                max={60000}
                step={1000}
                value={settings.connectTimeoutMS}
                onChange={(e) =>
                  updateSetting("connectTimeoutMS", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Initial connection timeout
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Idle Time (ms)</Label>
              <Input
                type="number"
                min={10000}
                max={300000}
                step={5000}
                value={settings.maxIdleTimeMS}
                onChange={(e) =>
                  updateSetting("maxIdleTimeMS", Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Keep-alive for idle connections
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
