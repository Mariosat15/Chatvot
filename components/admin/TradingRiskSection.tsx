'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, TrendingDown, Layers, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RiskSettings {
  // Margin Levels (%)
  marginLiquidation: number; // Stopout level
  marginCall: number; // Margin call warning
  marginWarning: number; // Low margin warning
  marginSafe: number; // Recommended minimum
  
  // Position Limits
  maxOpenPositions: number; // Max trades per user
  maxPositionSize: number; // Max lot size per trade
  
  // Leverage Limits
  minLeverage: number; // Minimum leverage allowed
  maxLeverage: number; // Maximum leverage allowed
  defaultLeverage: number; // Default leverage in forms
  
  // Risk Limits
  maxDrawdownPercent: number; // Max drawdown before restrictions
  dailyLossLimit: number; // Max daily loss percentage
  
  // Monitoring Settings
  marginCheckIntervalSeconds: number; // How often to check margin levels (in seconds)
}

const DEFAULT_SETTINGS: RiskSettings = {
  // Margin Levels
  marginLiquidation: 50,
  marginCall: 100,
  marginWarning: 150,
  marginSafe: 200,
  
  // Position Limits
  maxOpenPositions: 10,
  maxPositionSize: 100,
  
  // Leverage Limits
  minLeverage: 1,
  maxLeverage: 500,
  defaultLeverage: 10,
  
  // Risk Limits
  maxDrawdownPercent: 50,
  dailyLossLimit: 20,
  
  // Monitoring Settings
  marginCheckIntervalSeconds: 60,
};

export default function TradingRiskSection() {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/trading-risk-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (error) {
        console.error('Failed to load risk settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    // Validation
    if (settings.marginLiquidation >= settings.marginCall) {
      toast.error('Stopout level must be less than Margin Call level');
      return;
    }
    if (settings.marginCall >= settings.marginWarning) {
      toast.error('Margin Call level must be less than Warning level');
      return;
    }
    if (settings.marginWarning >= settings.marginSafe) {
      toast.error('Warning level must be less than Safe level');
      return;
    }
    if (settings.minLeverage >= settings.maxLeverage) {
      toast.error('Min leverage must be less than Max leverage');
      return;
    }
    if (settings.defaultLeverage < settings.minLeverage || settings.defaultLeverage > settings.maxLeverage) {
      toast.error('Default leverage must be between Min and Max');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/trading-risk-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Trading risk settings saved successfully!', {
          description: '✅ Changes are now live and will apply to all users immediately (within 10 seconds)',
          duration: 5000,
        });
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      setSettings(DEFAULT_SETTINGS);
      toast.info('Settings reset to defaults. Click Save to apply.');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-12">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-red-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Shield className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  Trading Risk Settings
                </h2>
                <p className="text-red-100 mt-1">
                  Configure global risk management parameters for all competitions
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleReset}
                variant="outline"
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white hover:bg-gray-100 text-red-600 font-bold shadow-xl"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Margin Levels */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2 text-xl">
            <div className="h-10 w-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            Margin & Stopout Levels
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            Define margin thresholds that trigger warnings and automatic position closures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Stopout Level (Liquidation) %</Label>
              <Input
                type="number"
                value={settings.marginLiquidation}
                onChange={(e) => setSettings({ ...settings, marginLiquidation: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={1}
                max={100}
              />
              <p className="text-xs text-red-400 mt-1">
                💀 All positions close automatically at this level
              </p>
            </div>

            <div>
              <Label className="text-gray-300">Margin Call Level %</Label>
              <Input
                type="number"
                value={settings.marginCall}
                onChange={(e) => setSettings({ ...settings, marginCall: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={settings.marginLiquidation + 1}
                max={200}
              />
              <p className="text-xs text-orange-400 mt-1">
                🚨 High risk warning shown at this level
              </p>
            </div>

            <div>
              <Label className="text-gray-300">Warning Level %</Label>
              <Input
                type="number"
                value={settings.marginWarning}
                onChange={(e) => setSettings({ ...settings, marginWarning: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={settings.marginCall + 1}
                max={300}
              />
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ Caution warning shown at this level
              </p>
            </div>

            <div>
              <Label className="text-gray-300">Safe Level %</Label>
              <Input
                type="number"
                value={settings.marginSafe}
                onChange={(e) => setSettings({ ...settings, marginSafe: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={settings.marginWarning + 1}
                max={500}
              />
              <p className="text-xs text-green-400 mt-1">
                ✅ Recommended minimum for safe trading
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Position Limits */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-blue-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2 text-xl">
            <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Layers className="h-5 w-5 text-blue-400" />
            </div>
            Position Limits
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            Control how many trades users can open and their maximum size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Max Open Positions (Trades)</Label>
              <Input
                type="number"
                value={settings.maxOpenPositions}
                onChange={(e) => setSettings({ ...settings, maxOpenPositions: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={1}
                max={100}
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum number of simultaneous open trades per user
              </p>
            </div>

            <div>
              <Label className="text-gray-300">Max Position Size (Lots)</Label>
              <Input
                type="number"
                value={settings.maxPositionSize}
                onChange={(e) => setSettings({ ...settings, maxPositionSize: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={0.01}
                max={1000}
                step={0.01}
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum lot size allowed per trade (1 lot = 100,000 units)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leverage Limits */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2 text-xl">
            <div className="h-10 w-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-purple-400" />
            </div>
            Leverage Limits
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            Define minimum, maximum, and default leverage values
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300">Min Leverage</Label>
              <Input
                type="number"
                value={settings.minLeverage}
                onChange={(e) => setSettings({ ...settings, minLeverage: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={1}
                max={settings.maxLeverage - 1}
              />
              <p className="text-xs text-gray-400 mt-1">1:1 minimum</p>
            </div>

            <div>
              <Label className="text-gray-300">Max Leverage</Label>
              <Input
                type="number"
                value={settings.maxLeverage}
                onChange={(e) => setSettings({ ...settings, maxLeverage: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={settings.minLeverage + 1}
                max={500}
              />
              <p className="text-xs text-gray-400 mt-1">1:500 maximum</p>
            </div>

            <div>
              <Label className="text-gray-300">Default Leverage</Label>
              <Input
                type="number"
                value={settings.defaultLeverage}
                onChange={(e) => setSettings({ ...settings, defaultLeverage: Number(e.target.value) })}
                className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
                min={settings.minLeverage}
                max={settings.maxLeverage}
              />
              <p className="text-xs text-gray-400 mt-1">Pre-selected value in forms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Limits Info */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-green-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2 text-xl">
            <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            Per-Competition Risk Limits
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            Drawdown and daily loss limits are configured per-competition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-1">Risk Limits Moved to Competitions</h4>
                <p className="text-xs text-gray-400">
                  Max Drawdown and Daily Loss Limit settings are now configured per-competition when creating or editing a competition. 
                  This allows different competitions to have different risk profiles.
                </p>
                <p className="text-xs text-blue-400 mt-2">
                  📍 Go to Create Competition → Step 4 (Trading Settings) → Risk Limits section
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Settings */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-cyan-500/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <div className="h-10 w-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-cyan-400" />
            </div>
            Monitoring Settings
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            Configure automatic margin monitoring frequency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="marginCheckInterval" className="text-gray-300 text-sm font-medium">
              Margin Check Interval (seconds)
            </Label>
            <Input
              id="marginCheckInterval"
              type="number"
              value={settings.marginCheckIntervalSeconds}
              onChange={(e) => setSettings({ ...settings, marginCheckIntervalSeconds: Number(e.target.value) })}
              className="bg-gray-700 border-gray-600 text-gray-100 mt-2"
              min={1}
              max={3600}
            />
            <p className="text-xs text-gray-400 mt-1">
              How often the system checks for margin calls (1-3600 seconds). Lower = more responsive, higher = less server load.
            </p>
            <div className="mt-2 text-xs text-gray-500">
              <strong>Recommended:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li><strong>1 second:</strong> Real-time monitoring (high load)</li>
                <li><strong>5 seconds:</strong> Very responsive (moderate load)</li>
                <li><strong>60 seconds:</strong> Balanced (low load)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/30 rounded-xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-blue-300 mb-3">Important Information</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li>Changes apply to all new trades immediately</li>
              <li>Existing open positions are not affected</li>
              <li>Lower margin levels = more aggressive risk management</li>
              <li>Higher leverage = higher risk for traders</li>
              <li>These settings override per-competition settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

