'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, RefreshCw, Shield, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface FraudSettings {
  // Device Fingerprinting
  deviceFingerprintingEnabled: boolean;
  deviceFingerprintBlockThreshold: number;
  
  // VPN/Proxy Detection
  vpnDetectionEnabled: boolean;
  blockVPN: boolean;
  blockProxy: boolean;
  blockTor: boolean;
  vpnRiskScore: number;
  proxyRiskScore: number;
  torRiskScore: number;
  
  // Multi-Account Detection
  multiAccountDetectionEnabled: boolean;
  maxAccountsPerDevice: number;
  
  // Risk Scoring
  entryBlockThreshold: number;
  alertThreshold: number;
  
  // Auto-Actions
  autoSuspendEnabled: boolean;
  autoSuspendThreshold: number;
  
  // Rate Limiting
  maxSignupsPerHour: number;
  maxEntriesPerHour: number;
}

export default function FraudSettingsSection() {
  const [settings, setSettings] = useState<FraudSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fraud/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        toast.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/fraud/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/fraud/settings/reset', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Settings reset to defaults');
      } else {
        toast.error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Error resetting settings');
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSetting = (key: keyof FraudSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading || !settings) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-3" />
          <p className="text-gray-400">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save/Reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-500" />
            Fraud Detection Settings
          </h3>
          <p className="text-gray-400 mt-1">
            Configure fraud detection systems and risk thresholds
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={saving}
            className="bg-gray-700 border-gray-600 hover:bg-gray-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Device Fingerprinting */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Device Fingerprinting
          </CardTitle>
          <CardDescription className="text-gray-400">
            Detect multiple accounts from the same device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Enable Device Fingerprinting</Label>
              <p className="text-sm text-gray-500">Track unique device signatures</p>
            </div>
            <Switch
              checked={settings.deviceFingerprintingEnabled}
              onCheckedChange={(checked) => updateSetting('deviceFingerprintingEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Enable Multi-Account Detection</Label>
              <p className="text-sm text-gray-500">Alert when same device has multiple accounts</p>
            </div>
            <Switch
              checked={settings.multiAccountDetectionEnabled}
              onCheckedChange={(checked) => updateSetting('multiAccountDetectionEnabled', checked)}
            />
          </div>

          <div>
            <Label className="text-gray-300">Max Accounts Per Device</Label>
            <p className="text-sm text-gray-500 mb-2">Create alert if more accounts detected</p>
            <Input
              type="number"
              min="1"
              max="10"
              value={settings.maxAccountsPerDevice}
              onChange={(e) => updateSetting('maxAccountsPerDevice', parseInt(e.target.value))}
              className="bg-gray-900 border-gray-700 text-gray-100"
            />
          </div>
        </CardContent>
      </Card>

      {/* VPN/Proxy Detection */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Eye className="h-5 w-5 text-yellow-500" />
            VPN/Proxy Detection
          </CardTitle>
          <CardDescription className="text-gray-400">
            Detect users connecting through VPNs, proxies, or Tor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Enable VPN/Proxy Detection</Label>
              <p className="text-sm text-gray-500">Analyze IP addresses for anonymizers</p>
            </div>
            <Switch
              checked={settings.vpnDetectionEnabled}
              onCheckedChange={(checked) => updateSetting('vpnDetectionEnabled', checked)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div>
                <Label className="text-gray-300 text-sm">Block VPN</Label>
                <p className="text-xs text-gray-500">Auto-block VPN users</p>
              </div>
              <Switch
                checked={settings.blockVPN}
                onCheckedChange={(checked) => updateSetting('blockVPN', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div>
                <Label className="text-gray-300 text-sm">Block Proxy</Label>
                <p className="text-xs text-gray-500">Auto-block proxy users</p>
              </div>
              <Switch
                checked={settings.blockProxy}
                onCheckedChange={(checked) => updateSetting('blockProxy', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div>
                <Label className="text-gray-300 text-sm">Block Tor</Label>
                <p className="text-xs text-gray-500">Auto-block Tor users</p>
              </div>
              <Switch
                checked={settings.blockTor}
                onCheckedChange={(checked) => updateSetting('blockTor', checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300">VPN Risk Score</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.vpnRiskScore}
                onChange={(e) => updateSetting('vpnRiskScore', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300">Proxy Risk Score</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.proxyRiskScore}
                onChange={(e) => updateSetting('proxyRiskScore', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>

            <div>
              <Label className="text-gray-300">Tor Risk Score</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.torRiskScore}
                onChange={(e) => updateSetting('torRiskScore', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Thresholds */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Risk Thresholds
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure when to block entries and create alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-300">Entry Block Threshold (0-100)</Label>
            <p className="text-sm text-gray-500 mb-2">
              Block competition entry if risk score exceeds this value
            </p>
            <div className="flex items-center gap-4">
              <Input
                type="range"
                min="0"
                max="100"
                value={settings.entryBlockThreshold}
                onChange={(e) => updateSetting('entryBlockThreshold', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-bold text-red-500 w-16 text-center">
                {settings.entryBlockThreshold}
              </span>
            </div>
          </div>

          <div>
            <Label className="text-gray-300">Alert Threshold (0-100)</Label>
            <p className="text-sm text-gray-500 mb-2">
              Create alert if risk score exceeds this value
            </p>
            <div className="flex items-center gap-4">
              <Input
                type="range"
                min="0"
                max="100"
                value={settings.alertThreshold}
                onChange={(e) => updateSetting('alertThreshold', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-bold text-yellow-500 w-16 text-center">
                {settings.alertThreshold}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Rate Limiting</CardTitle>
          <CardDescription className="text-gray-400">
            Limit actions per hour to prevent abuse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Max Sign-Ups Per Hour</Label>
              <p className="text-sm text-gray-500 mb-2">Per device/IP</p>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.maxSignupsPerHour}
                onChange={(e) => updateSetting('maxSignupsPerHour', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>

            <div>
              <Label className="text-gray-300">Max Entries Per Hour</Label>
              <p className="text-sm text-gray-500 mb-2">Per user</p>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.maxEntriesPerHour}
                onChange={(e) => updateSetting('maxEntriesPerHour', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Actions */}
      <Card className="bg-gray-800 border-gray-700 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-gray-100 text-red-500">⚠️ Automatic Actions (Advanced)</CardTitle>
          <CardDescription className="text-gray-400">
            Enable with caution - can auto-suspend accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Enable Auto-Suspend</Label>
              <p className="text-sm text-gray-500">Automatically suspend high-risk accounts</p>
            </div>
            <Switch
              checked={settings.autoSuspendEnabled}
              onCheckedChange={(checked) => updateSetting('autoSuspendEnabled', checked)}
            />
          </div>

          {settings.autoSuspendEnabled && (
            <div>
              <Label className="text-gray-300">Auto-Suspend Threshold</Label>
              <p className="text-sm text-gray-500 mb-2">Suspend if risk score exceeds this value</p>
              <Input
                type="number"
                min="70"
                max="100"
                value={settings.autoSuspendThreshold}
                onChange={(e) => updateSetting('autoSuspendThreshold', parseInt(e.target.value))}
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

