'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Swords,
  DollarSign,
  Clock,
  Trophy,
  RefreshCw,
  Save,
  Percent,
  Shield,
  Zap,
  Info,
} from 'lucide-react';

interface ChallengeSettings {
  platformFeePercentage: number;
  minEntryFee: number;
  maxEntryFee: number;
  defaultStartingCapital: number;
  minStartingCapital: number;
  maxStartingCapital: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  defaultDurationMinutes: number;
  acceptDeadlineMinutes: number;
  defaultAssetClasses: string[];
  challengesEnabled: boolean;
  requireBothOnline: boolean;
  allowChallengeWhileInCompetition: boolean;
  challengeCooldownMinutes: number;
  maxPendingChallenges: number;
  maxActiveChallenges: number;
}

export default function ChallengeSettingsSection() {
  const [settings, setSettings] = useState<ChallengeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/challenge-settings');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      toast.error('Failed to load challenge settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/challenge-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to save settings', {
          duration: 5000,
          description: response.status === 400 ? 'Please check your input values' : undefined,
        });
        return;
      }

      toast.success('Challenge settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Network or server error',
      });
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSetting = (key: keyof ChallengeSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Swords className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  ⚔️ 1v1 Challenge Settings
                </h2>
                <p className="text-orange-100 mt-1">
                  Configure trader vs trader challenge rules and limits
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
                <span className="text-white text-sm">Challenges</span>
                <Switch
                  checked={settings.challengesEnabled}
                  onCheckedChange={(val) => updateSetting('challengesEnabled', val)}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-blue-300 font-medium">Universal Trading Settings</h4>
            <p className="text-blue-300/70 text-sm mt-1">
              Trading settings (leverage, position size, margin thresholds) are configured in 
              <strong> Settings → Trading Risk</strong> and apply universally to both competitions and challenges.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Platform Fee Card */}
        <Card className="bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Percent className="h-5 w-5 text-yellow-400" />
              Platform Fee
            </CardTitle>
            <CardDescription>Fee taken from prize pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400">Fee Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={settings.platformFeePercentage}
                  onChange={(e) => updateSetting('platformFeePercentage', parseFloat(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <span className="text-yellow-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">0-50%</p>
            </div>
          </CardContent>
        </Card>

        {/* Entry Fee Card */}
        <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              Entry Fee Limits
            </CardTitle>
            <CardDescription>Min/Max entry fees for challenges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Min Entry</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.minEntryFee}
                  onChange={(e) => updateSetting('minEntryFee', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Max Entry</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxEntryFee}
                  onChange={(e) => updateSetting('maxEntryFee', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duration Card */}
        <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Duration Settings
            </CardTitle>
            <CardDescription>Challenge time limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-gray-400 text-xs">Min (mins)</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.minDurationMinutes}
                  onChange={(e) => updateSetting('minDurationMinutes', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Default</Label>
                <Input
                  type="number"
                  value={settings.defaultDurationMinutes}
                  onChange={(e) => updateSetting('defaultDurationMinutes', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Max (mins)</Label>
                <Input
                  type="number"
                  value={settings.maxDurationMinutes}
                  onChange={(e) => updateSetting('maxDurationMinutes', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Accept Deadline (mins)</Label>
              <Input
                type="number"
                min="1"
                value={settings.acceptDeadlineMinutes}
                onChange={(e) => updateSetting('acceptDeadlineMinutes', parseInt(e.target.value))}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Time to accept a challenge</p>
            </div>
          </CardContent>
        </Card>

        {/* Starting Capital Card */}
        <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-400" />
              Starting Capital
            </CardTitle>
            <CardDescription>Virtual trading capital</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-gray-400 text-xs">Min</Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.minStartingCapital}
                  onChange={(e) => updateSetting('minStartingCapital', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Default</Label>
                <Input
                  type="number"
                  value={settings.defaultStartingCapital}
                  onChange={(e) => updateSetting('defaultStartingCapital', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Max</Label>
                <Input
                  type="number"
                  value={settings.maxStartingCapital}
                  onChange={(e) => updateSetting('maxStartingCapital', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limits Card */}
        <Card className="bg-gradient-to-br from-slate-900/30 to-gray-900/30 border-slate-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" />
              Limits & Cooldowns
            </CardTitle>
            <CardDescription>Rate limiting settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs">Max Pending</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxPendingChallenges}
                  onChange={(e) => updateSetting('maxPendingChallenges', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Max Active</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxActiveChallenges}
                  onChange={(e) => updateSetting('maxActiveChallenges', parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Cooldown (mins)</Label>
              <Input
                type="number"
                min="0"
                value={settings.challengeCooldownMinutes}
                onChange={(e) => updateSetting('challengeCooldownMinutes', parseInt(e.target.value))}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Between challenges to same user</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Toggles */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Feature Toggles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <Label className="text-white">Require Both Online</Label>
                <p className="text-xs text-gray-500">Both players must be online to start</p>
              </div>
              <Switch
                checked={settings.requireBothOnline}
                onCheckedChange={(val) => updateSetting('requireBothOnline', val)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <Label className="text-white">Allow During Competitions</Label>
                <p className="text-xs text-gray-500">Users can challenge while in competition</p>
              </div>
              <Switch
                checked={settings.allowChallengeWhileInCompetition}
                onCheckedChange={(val) => updateSetting('allowChallengeWhileInCompetition', val)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
