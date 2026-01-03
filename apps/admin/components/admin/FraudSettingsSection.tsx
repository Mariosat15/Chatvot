'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, RefreshCw, Shield, Eye, AlertTriangle, UserX, Fingerprint, Bot, Mail, Lock, Clock } from 'lucide-react';
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
  
  // Duplicate KYC Detection
  duplicateKYCAutoSuspend: boolean;
  duplicateKYCSuspendMessage: string;
  duplicateKYCAllowWithdrawals: boolean;
  duplicateKYCBlockDeposits: boolean;
  duplicateKYCBlockTrading: boolean;
  duplicateKYCBlockCompetitions: boolean;
  duplicateKYCBlockChallenges: boolean;
  
  // Rate Limiting
  maxSignupsPerHour: number;
  maxEntriesPerHour: number;
  
  // Registration Security
  registrationRateLimitEnabled: boolean;
  maxRegistrationsPerIPPerHour: number;
  maxRegistrationsPerIPPerDay: number;
  registrationCooldownMinutes: number;
  blockDisposableEmails: boolean;
  disposableEmailDomains: string[];
  blockedEmailDomains: string[];
  honeypotEnabled: boolean;
  registrationChallengeEnabled: boolean;
  registrationChallengeProvider: string;
  registrationChallengeKey: string;
  blockSuspiciousPatterns: boolean;
  suspiciousNamePatterns: string[];
  blockNumericOnlyNames: boolean;
  blockSingleCharacterNames: boolean;
  minNameLength: number;
  blockDatacenterIPs: boolean;
  blockKnownBadIPs: boolean;
  genericErrorMessages: boolean;
  
  // Login Security
  loginRateLimitEnabled: boolean;
  maxLoginAttemptsPerHour: number;
  maxFailedLoginsBeforeLockout: number;
  loginLockoutDurationMinutes: number;
  loginCooldownAfterFailedAttempts: number;
  failedLoginAlertThreshold: number;
  trackFailedLogins: boolean;
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

      {/* Duplicate KYC Detection */}
      <Card className="bg-gray-800 border-gray-700 border-orange-500/30">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-orange-500" />
            Duplicate KYC Detection
          </CardTitle>
          <CardDescription className="text-gray-400">
            Automatically handle users who attempt to verify with the same identity document
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div>
              <Label className="text-gray-300 font-medium">Auto-Suspend on Duplicate KYC</Label>
              <p className="text-sm text-gray-500">
                Automatically suspend all accounts using the same identity document
              </p>
            </div>
            <Switch
              checked={settings.duplicateKYCAutoSuspend}
              onCheckedChange={(checked) => updateSetting('duplicateKYCAutoSuspend', checked)}
            />
          </div>

          {settings.duplicateKYCAutoSuspend && (
            <>
              {/* Suspension Message */}
              <div>
                <Label className="text-gray-300">Suspension Message</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Message shown to suspended users (advise them to contact support)
                </p>
                <textarea
                  value={settings.duplicateKYCSuspendMessage || ''}
                  onChange={(e) => updateSetting('duplicateKYCSuspendMessage', e.target.value)}
                  className="w-full bg-gray-900 border-gray-700 text-gray-100 rounded-md p-3 min-h-[80px]"
                  placeholder="Your account has been suspended due to a security concern..."
                />
              </div>

              {/* What actions to block */}
              <div>
                <Label className="text-gray-300 mb-3 block">Actions to Block</Label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div>
                      <Label className="text-gray-300 text-sm">Block Deposits</Label>
                      <p className="text-xs text-gray-500">Prevent new deposits</p>
                    </div>
                    <Switch
                      checked={settings.duplicateKYCBlockDeposits}
                      onCheckedChange={(checked) => updateSetting('duplicateKYCBlockDeposits', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div>
                      <Label className="text-gray-300 text-sm">Block Trading</Label>
                      <p className="text-xs text-gray-500">Prevent trading</p>
                    </div>
                    <Switch
                      checked={settings.duplicateKYCBlockTrading}
                      onCheckedChange={(checked) => updateSetting('duplicateKYCBlockTrading', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div>
                      <Label className="text-gray-300 text-sm">Block Competitions</Label>
                      <p className="text-xs text-gray-500">Prevent competition entry</p>
                    </div>
                    <Switch
                      checked={settings.duplicateKYCBlockCompetitions}
                      onCheckedChange={(checked) => updateSetting('duplicateKYCBlockCompetitions', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div>
                      <Label className="text-gray-300 text-sm">Block Challenges</Label>
                      <p className="text-xs text-gray-500">Prevent challenge entry</p>
                    </div>
                    <Switch
                      checked={settings.duplicateKYCBlockChallenges}
                      onCheckedChange={(checked) => updateSetting('duplicateKYCBlockChallenges', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg col-span-2 lg:col-span-1">
                    <div>
                      <Label className="text-green-400 text-sm">Allow Withdrawals</Label>
                      <p className="text-xs text-gray-500">Let users withdraw funds</p>
                    </div>
                    <Switch
                      checked={settings.duplicateKYCAllowWithdrawals}
                      onCheckedChange={(checked) => updateSetting('duplicateKYCAllowWithdrawals', checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <UserX className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-blue-400 mb-1">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      <li>When a user completes KYC, we check if the same document was used before</li>
                      <li>If duplicate found, a <strong className="text-orange-400">critical fraud alert</strong> is created</li>
                      <li>All accounts using that document are automatically suspended</li>
                      <li>Withdrawals remain enabled so users can retrieve their funds</li>
                      <li>Users see the suspension message and are directed to contact support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Registration Security */}
      <Card className="bg-gray-800 border-gray-700 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Bot className="h-5 w-5 text-green-500" />
            Registration Security (Anti-Bot/Anti-Fraud)
          </CardTitle>
          <CardDescription className="text-gray-400">
            Protect against automated bot registrations and fraudulent sign-ups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rate Limiting */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div>
                <Label className="text-gray-300 font-medium">Registration Rate Limiting</Label>
                <p className="text-sm text-gray-500">
                  Limit registration attempts per IP address
                </p>
              </div>
              <Switch
                checked={settings.registrationRateLimitEnabled}
                onCheckedChange={(checked) => updateSetting('registrationRateLimitEnabled', checked)}
              />
            </div>

            {settings.registrationRateLimitEnabled && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-300">Max Registrations/Hour (per IP)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxRegistrationsPerIPPerHour || 5}
                    onChange={(e) => updateSetting('maxRegistrationsPerIPPerHour', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Max Registrations/Day (per IP)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={settings.maxRegistrationsPerIPPerDay || 10}
                    onChange={(e) => updateSetting('maxRegistrationsPerIPPerDay', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Cooldown (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="60"
                    value={settings.registrationCooldownMinutes || 1}
                    onChange={(e) => updateSetting('registrationCooldownMinutes', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bot Protection */}
          <div className="space-y-4">
            <Label className="text-gray-300 text-lg">Bot Protection</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Honeypot Trap</Label>
                  <p className="text-xs text-gray-500">Hidden field that bots fill out</p>
                </div>
                <Switch
                  checked={settings.honeypotEnabled}
                  onCheckedChange={(checked) => updateSetting('honeypotEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Generic Error Messages</Label>
                  <p className="text-xs text-gray-500">Hide specific block reasons</p>
                </div>
                <Switch
                  checked={settings.genericErrorMessages}
                  onCheckedChange={(checked) => updateSetting('genericErrorMessages', checked)}
                />
              </div>
            </div>
          </div>

          {/* Email Protection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-400" />
              <Label className="text-gray-300 text-lg">Email Protection</Label>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div>
                <Label className="text-gray-300 text-sm">Block Disposable Emails</Label>
                <p className="text-xs text-gray-500">Block temporary/throwaway email services</p>
              </div>
              <Switch
                checked={settings.blockDisposableEmails}
                onCheckedChange={(checked) => updateSetting('blockDisposableEmails', checked)}
              />
            </div>

            <div>
              <Label className="text-gray-300">Blocked Email Domains (custom)</Label>
              <p className="text-sm text-gray-500 mb-2">Add specific domains to block (comma-separated)</p>
              <Input
                value={(settings.blockedEmailDomains || []).join(', ')}
                onChange={(e) => updateSetting('blockedEmailDomains', e.target.value.split(',').map(d => d.trim()).filter(Boolean))}
                placeholder="competitor.com, spam.net"
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          </div>

          {/* Name Validation */}
          <div className="space-y-4">
            <Label className="text-gray-300 text-lg">Name Validation</Label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Block Suspicious Patterns</Label>
                  <p className="text-xs text-gray-500">e.g., &quot;test123&quot;, &quot;asdf&quot;</p>
                </div>
                <Switch
                  checked={settings.blockSuspiciousPatterns}
                  onCheckedChange={(checked) => updateSetting('blockSuspiciousPatterns', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Block Numeric Names</Label>
                  <p className="text-xs text-gray-500">Names like &quot;12345&quot;</p>
                </div>
                <Switch
                  checked={settings.blockNumericOnlyNames}
                  onCheckedChange={(checked) => updateSetting('blockNumericOnlyNames', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Block Single Char Names</Label>
                  <p className="text-xs text-gray-500">Names like &quot;A&quot;</p>
                </div>
                <Switch
                  checked={settings.blockSingleCharacterNames}
                  onCheckedChange={(checked) => updateSetting('blockSingleCharacterNames', checked)}
                />
              </div>

              <div>
                <Label className="text-gray-300 text-sm">Min Name Length</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.minNameLength || 2}
                  onChange={(e) => updateSetting('minNameLength', parseInt(e.target.value))}
                  className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Suspicious Name Patterns (regex)</Label>
              <p className="text-sm text-gray-500 mb-2">Regex patterns to detect suspicious names (comma-separated)</p>
              <Input
                value={(settings.suspiciousNamePatterns || []).join(', ')}
                onChange={(e) => updateSetting('suspiciousNamePatterns', e.target.value.split(',').map(d => d.trim()).filter(Boolean))}
                placeholder="^test[0-9]*$, ^user[0-9]*$"
                className="bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          </div>

          {/* IP Intelligence */}
          <div className="space-y-4">
            <Label className="text-gray-300 text-lg">IP Intelligence</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Block Datacenter IPs</Label>
                  <p className="text-xs text-gray-500">Block hosting/cloud provider IPs</p>
                </div>
                <Switch
                  checked={settings.blockDatacenterIPs}
                  onCheckedChange={(checked) => updateSetting('blockDatacenterIPs', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-gray-300 text-sm">Block Known Bad IPs</Label>
                  <p className="text-xs text-gray-500">Block IPs from threat lists</p>
                </div>
                <Switch
                  checked={settings.blockKnownBadIPs}
                  onCheckedChange={(checked) => updateSetting('blockKnownBadIPs', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Security / Brute Force Protection */}
      <Card className="bg-gray-800 border-gray-700 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Lock className="h-5 w-5 text-purple-500" />
            Login Security (Brute Force Protection)
          </CardTitle>
          <CardDescription className="text-gray-400">
            Protect accounts from credential stuffing and brute force attacks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div>
              <Label className="text-gray-300 font-medium">Enable Login Rate Limiting</Label>
              <p className="text-sm text-gray-500">
                Limit login attempts and lock accounts after repeated failures
              </p>
            </div>
            <Switch
              checked={settings.loginRateLimitEnabled}
              onCheckedChange={(checked) => updateSetting('loginRateLimitEnabled', checked)}
            />
          </div>

          {settings.loginRateLimitEnabled && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-300">Max Logins/Hour (per IP)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    value={settings.maxLoginAttemptsPerHour || 20}
                    onChange={(e) => updateSetting('maxLoginAttemptsPerHour', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Failed Attempts Before Lockout</Label>
                  <Input
                    type="number"
                    min="3"
                    max="20"
                    value={settings.maxFailedLoginsBeforeLockout || 5}
                    onChange={(e) => updateSetting('maxFailedLoginsBeforeLockout', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Lockout Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1440"
                    value={settings.loginLockoutDurationMinutes || 15}
                    onChange={(e) => updateSetting('loginLockoutDurationMinutes', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Cooldown (seconds)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="60"
                    value={settings.loginCooldownAfterFailedAttempts || 3}
                    onChange={(e) => updateSetting('loginCooldownAfterFailedAttempts', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Track Failed Logins</Label>
                    <p className="text-xs text-gray-500">Store failed attempts for analysis</p>
                  </div>
                  <Switch
                    checked={settings.trackFailedLogins}
                    onCheckedChange={(checked) => updateSetting('trackFailedLogins', checked)}
                  />
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Alert After X Failed Attempts</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.failedLoginAlertThreshold || 10}
                    onChange={(e) => updateSetting('failedLoginAlertThreshold', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                  />
                </div>
              </div>

              {/* Info box */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-purple-400 mb-1">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      <li>After <strong>{settings.maxFailedLoginsBeforeLockout || 5}</strong> failed attempts, account is locked for <strong>{settings.loginLockoutDurationMinutes || 15}</strong> minutes</li>
                      <li>Rate limit: Max <strong>{settings.maxLoginAttemptsPerHour || 20}</strong> login attempts per hour per IP</li>
                      <li>A fraud alert is created after <strong>{settings.failedLoginAlertThreshold || 10}</strong> failed attempts</li>
                      <li>Users see remaining attempts to encourage legitimate recovery via password reset</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

