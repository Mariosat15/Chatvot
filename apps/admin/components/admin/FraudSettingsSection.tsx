'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, Save, RefreshCw, Shield, Eye, AlertTriangle, UserX, 
  Fingerprint, Bot, Mail, Lock, Clock, UserPlus, LogIn, 
  Activity, Zap, Globe, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  
  // Rate Limiting (legacy - now merged with registration)
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
  const [activeTab, setActiveTab] = useState('registration');

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

    // Validate thresholds
    if (settings.alertThreshold >= settings.entryBlockThreshold) {
      toast.error('Alert threshold must be lower than Entry Block threshold');
      return;
    }

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

  const handleResetAllSecurityData = async () => {
    if (!confirm('⚠️ DANGER: Reset ALL security data?\n\nThis will DELETE:\n• All fraud alerts\n• All fraud history\n• All suspicion scores\n• All device fingerprints\n• All payment fingerprints\n• All behavioral profiles\n• All security logs\n• All account lockouts\n\nAnd RESET settings to defaults.\n\nThis cannot be undone!')) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/fraud/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearFraudData: true, clearAllSecurityData: true })
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success(`All security data cleared! ${data.message || ''}`);
      } else {
        toast.error('Failed to reset security data');
      }
    } catch (error) {
      console.error('Error resetting security data:', error);
      toast.error('Error resetting security data');
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

  // Check for configuration conflicts
  const conflicts = [];
  if (settings.alertThreshold >= settings.entryBlockThreshold) {
    conflicts.push('Alert threshold should be lower than Entry Block threshold');
  }
  if (settings.blockVPN && settings.vpnRiskScore < 50) {
    conflicts.push('VPN blocking is ON but risk score is low - consider increasing VPN risk score');
  }
  if (settings.autoSuspendEnabled && settings.autoSuspendThreshold <= settings.entryBlockThreshold) {
    conflicts.push('Auto-suspend threshold should be higher than entry block threshold');
  }

  return (
    <div className="space-y-6">
      {/* Header with Save/Reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            Fraud Detection & Security
          </h3>
          <p className="text-gray-400 mt-1">
            Configure security systems to protect against fraud and abuse
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleResetAllSecurityData}
            variant="outline"
            disabled={saving}
            className="bg-red-900/50 border-red-600 hover:bg-red-800 text-red-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset All Security Data
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

      {/* Conflict Warnings */}
      {conflicts.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-400">Configuration Warnings</p>
                <ul className="text-sm text-yellow-300/80 mt-1 space-y-1">
                  {conflicts.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-800 border border-gray-700 p-1 w-full flex">
          <TabsTrigger value="registration" className="flex-1 gap-2 data-[state=active]:bg-green-600">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Registration</span>
          </TabsTrigger>
          <TabsTrigger value="login" className="flex-1 gap-2 data-[state=active]:bg-purple-600">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Login</span>
          </TabsTrigger>
          <TabsTrigger value="detection" className="flex-1 gap-2 data-[state=active]:bg-blue-600">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Detection</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex-1 gap-2 data-[state=active]:bg-orange-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Risk & Actions</span>
          </TabsTrigger>
          <TabsTrigger value="kyc" className="flex-1 gap-2 data-[state=active]:bg-red-600">
            <Fingerprint className="h-4 w-4" />
            <span className="hidden sm:inline">KYC Fraud</span>
          </TabsTrigger>
        </TabsList>

        {/* ========== TAB 1: REGISTRATION SECURITY ========== */}
        <TabsContent value="registration" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <UserPlus className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Registration Security</h4>
              <p className="text-sm text-gray-400">First line of defense - protect against bot signups and fake accounts</p>
            </div>
          </div>

          {/* Rate Limiting */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-green-400" />
                  Rate Limiting
                </CardTitle>
                <Switch
                  checked={settings.registrationRateLimitEnabled}
                  onCheckedChange={(checked) => updateSetting('registrationRateLimitEnabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.registrationRateLimitEnabled && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-300 text-sm">Per Hour (per IP)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxRegistrationsPerIPPerHour || 5}
                      onChange={(e) => updateSetting('maxRegistrationsPerIPPerHour', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Per Day (per IP)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={settings.maxRegistrationsPerIPPerDay || 10}
                      onChange={(e) => updateSetting('maxRegistrationsPerIPPerDay', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Cooldown (mins)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={settings.registrationCooldownMinutes || 1}
                      onChange={(e) => updateSetting('registrationCooldownMinutes', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Bot Protection */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-green-400" />
                Bot Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Honeypot Trap</Label>
                    <p className="text-xs text-gray-500">Hidden field bots fill</p>
                  </div>
                  <Switch
                    checked={settings.honeypotEnabled}
                    onCheckedChange={(checked) => updateSetting('honeypotEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Generic Errors</Label>
                    <p className="text-xs text-gray-500">Hide block reasons</p>
                  </div>
                  <Switch
                    checked={settings.genericErrorMessages}
                    onCheckedChange={(checked) => updateSetting('genericErrorMessages', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Protection */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-blue-400" />
                  Email Protection
                </CardTitle>
                <Switch
                  checked={settings.blockDisposableEmails}
                  onCheckedChange={(checked) => updateSetting('blockDisposableEmails', checked)}
                />
              </div>
              <CardDescription className="text-gray-500 text-xs">
                Block disposable/temporary email services (70+ domains blocked)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Label className="text-gray-300 text-sm">Additional Blocked Domains</Label>
              <Input
                value={(settings.blockedEmailDomains || []).join(', ')}
                onChange={(e) => updateSetting('blockedEmailDomains', e.target.value.split(',').map(d => d.trim()).filter(Boolean))}
                placeholder="competitor.com, spam.net"
                className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
              />
            </CardContent>
          </Card>

          {/* Name Validation */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                <UserX className="h-4 w-4 text-orange-400" />
                Name Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <Label className="text-gray-300 text-xs">Block Patterns</Label>
                  <Switch
                    checked={settings.blockSuspiciousPatterns}
                    onCheckedChange={(checked) => updateSetting('blockSuspiciousPatterns', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <Label className="text-gray-300 text-xs">Block Numbers</Label>
                  <Switch
                    checked={settings.blockNumericOnlyNames}
                    onCheckedChange={(checked) => updateSetting('blockNumericOnlyNames', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <Label className="text-gray-300 text-xs">Block Single Char</Label>
                  <Switch
                    checked={settings.blockSingleCharacterNames}
                    onCheckedChange={(checked) => updateSetting('blockSingleCharacterNames', checked)}
                  />
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <Label className="text-gray-300 text-xs">Min Length</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.minNameLength || 2}
                    onChange={(e) => updateSetting('minNameLength', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-1 h-8"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Suspicious Patterns (regex)</Label>
                <Input
                  value={(settings.suspiciousNamePatterns || []).join(', ')}
                  onChange={(e) => updateSetting('suspiciousNamePatterns', e.target.value.split(',').map(d => d.trim()).filter(Boolean))}
                  placeholder="^test[0-9]*$, ^user[0-9]*$, ^asdf"
                  className="bg-gray-900 border-gray-700 text-gray-100 mt-1 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TAB 2: LOGIN SECURITY ========== */}
        <TabsContent value="login" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Lock className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Login Security</h4>
              <p className="text-sm text-gray-400">Protect accounts from brute force and credential stuffing attacks</p>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-purple-400" />
                  Brute Force Protection
                </CardTitle>
                <Switch
                  checked={settings.loginRateLimitEnabled}
                  onCheckedChange={(checked) => updateSetting('loginRateLimitEnabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.loginRateLimitEnabled && (
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-gray-300 text-sm">Max/Hour (IP)</Label>
                    <Input
                      type="number"
                      min="5"
                      max="100"
                      value={settings.maxLoginAttemptsPerHour || 20}
                      onChange={(e) => updateSetting('maxLoginAttemptsPerHour', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Fails → Lockout</Label>
                    <Input
                      type="number"
                      min="3"
                      max="20"
                      value={settings.maxFailedLoginsBeforeLockout || 5}
                      onChange={(e) => updateSetting('maxFailedLoginsBeforeLockout', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Lockout (mins)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="1440"
                      value={settings.loginLockoutDurationMinutes || 15}
                      onChange={(e) => updateSetting('loginLockoutDurationMinutes', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Cooldown (sec)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={settings.loginCooldownAfterFailedAttempts || 3}
                      onChange={(e) => updateSetting('loginCooldownAfterFailedAttempts', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <div>
                      <Label className="text-gray-300 text-sm">Track Failed Logins</Label>
                      <p className="text-xs text-gray-500">Store for analysis</p>
                    </div>
                    <Switch
                      checked={settings.trackFailedLogins}
                      onCheckedChange={(checked) => updateSetting('trackFailedLogins', checked)}
                    />
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <Label className="text-gray-300 text-sm">Alert After X Fails</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.failedLoginAlertThreshold || 10}
                      onChange={(e) => updateSetting('failedLoginAlertThreshold', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1 h-8"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-purple-400 flex-shrink-0" />
                    <div className="text-sm text-gray-300">
                      <p className="font-medium text-purple-400">Current Configuration:</p>
                      <p className="text-gray-400 mt-1">
                        After <strong className="text-white">{settings.maxFailedLoginsBeforeLockout || 5}</strong> failed attempts → 
                        lock for <strong className="text-white">{settings.loginLockoutDurationMinutes || 15}</strong> minutes. 
                        Alert admin after <strong className="text-white">{settings.failedLoginAlertThreshold || 10}</strong> fails.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ========== TAB 3: DETECTION ========== */}
        <TabsContent value="detection" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Detection Systems</h4>
              <p className="text-sm text-gray-400">Monitor devices, IPs, and connections for suspicious activity</p>
            </div>
          </div>

          {/* Device Fingerprinting */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <Fingerprint className="h-4 w-4 text-blue-400" />
                  Device Fingerprinting
                </CardTitle>
                <Switch
                  checked={settings.deviceFingerprintingEnabled}
                  onCheckedChange={(checked) => updateSetting('deviceFingerprintingEnabled', checked)}
                />
              </div>
              <CardDescription className="text-gray-500 text-xs">Track unique device signatures to detect multi-accounts</CardDescription>
            </CardHeader>
            {settings.deviceFingerprintingEnabled && (
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Multi-Account Detection</Label>
                    <p className="text-xs text-gray-500">Alert when same device has multiple accounts</p>
                  </div>
                  <Switch
                    checked={settings.multiAccountDetectionEnabled}
                    onCheckedChange={(checked) => updateSetting('multiAccountDetectionEnabled', checked)}
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Max Accounts Per Device</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxAccountsPerDevice}
                    onChange={(e) => updateSetting('maxAccountsPerDevice', parseInt(e.target.value))}
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-1 w-32"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* VPN/Proxy Detection */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-yellow-400" />
                  VPN/Proxy Detection
                </CardTitle>
                <Switch
                  checked={settings.vpnDetectionEnabled}
                  onCheckedChange={(checked) => updateSetting('vpnDetectionEnabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.vpnDetectionEnabled && (
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <Label className="text-gray-300 text-sm">Block VPN</Label>
                    <Switch
                      checked={settings.blockVPN}
                      onCheckedChange={(checked) => updateSetting('blockVPN', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <Label className="text-gray-300 text-sm">Block Proxy</Label>
                    <Switch
                      checked={settings.blockProxy}
                      onCheckedChange={(checked) => updateSetting('blockProxy', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <Label className="text-gray-300 text-sm">Block Tor</Label>
                    <Switch
                      checked={settings.blockTor}
                      onCheckedChange={(checked) => updateSetting('blockTor', checked)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-gray-300 text-sm">VPN Risk Score</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.vpnRiskScore}
                      onChange={(e) => updateSetting('vpnRiskScore', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Proxy Risk Score</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.proxyRiskScore}
                      onChange={(e) => updateSetting('proxyRiskScore', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Tor Risk Score</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.torRiskScore}
                      onChange={(e) => updateSetting('torRiskScore', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* IP Intelligence */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-cyan-400" />
                IP Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Block Datacenter IPs</Label>
                    <p className="text-xs text-gray-500">Cloud/hosting providers</p>
                  </div>
                  <Switch
                    checked={settings.blockDatacenterIPs}
                    onCheckedChange={(checked) => updateSetting('blockDatacenterIPs', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div>
                    <Label className="text-gray-300 text-sm">Block Known Bad IPs</Label>
                    <p className="text-xs text-gray-500">Threat intelligence lists</p>
                  </div>
                  <Switch
                    checked={settings.blockKnownBadIPs}
                    onCheckedChange={(checked) => updateSetting('blockKnownBadIPs', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TAB 4: RISK & ACTIONS ========== */}
        <TabsContent value="risk" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Risk Scoring & Actions</h4>
              <p className="text-sm text-gray-400">Configure thresholds and automatic responses to risky behavior</p>
            </div>
          </div>

          {/* Risk Thresholds */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Risk Thresholds
              </CardTitle>
              <CardDescription className="text-gray-500 text-xs">
                Alert threshold must be lower than Block threshold
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-gray-300">Alert Threshold (create alert)</Label>
                  <span className="text-2xl font-bold text-yellow-500">{settings.alertThreshold}</span>
                </div>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.alertThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val < settings.entryBlockThreshold) {
                      updateSetting('alertThreshold', val);
                    }
                  }}
                  className="w-full accent-yellow-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-gray-300">Entry Block Threshold (block action)</Label>
                  <span className="text-2xl font-bold text-red-500">{settings.entryBlockThreshold}</span>
                </div>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.entryBlockThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > settings.alertThreshold) {
                      updateSetting('entryBlockThreshold', val);
                    }
                  }}
                  className="w-full accent-red-500"
                />
              </div>

              {/* Rate Limiting for Activities */}
              <div className="pt-4 border-t border-gray-700">
                <Label className="text-gray-300 text-sm mb-3 block">Activity Rate Limits</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs">Max Competition Entries/Hour</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxEntriesPerHour}
                      onChange={(e) => updateSetting('maxEntriesPerHour', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Max Signups/Hour (per device)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxSignupsPerHour}
                      onChange={(e) => updateSetting('maxSignupsPerHour', parseInt(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-gray-100 mt-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Suspend */}
          <Card className="bg-gray-800 border-gray-700 border-red-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-red-400 flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  ⚠️ Auto-Suspend (Advanced)
                </CardTitle>
                <Switch
                  checked={settings.autoSuspendEnabled}
                  onCheckedChange={(checked) => updateSetting('autoSuspendEnabled', checked)}
                />
              </div>
              <CardDescription className="text-gray-500 text-xs">
                Automatically suspend accounts that exceed the risk threshold
              </CardDescription>
            </CardHeader>
            {settings.autoSuspendEnabled && (
              <CardContent className="pt-0">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-gray-300">Auto-Suspend Threshold</Label>
                    <span className="text-2xl font-bold text-red-400">{settings.autoSuspendThreshold}</span>
                  </div>
                  <Input
                    type="range"
                    min="70"
                    max="100"
                    value={settings.autoSuspendThreshold}
                    onChange={(e) => updateSetting('autoSuspendThreshold', parseInt(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Accounts with risk score ≥ {settings.autoSuspendThreshold} will be automatically suspended
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ========== TAB 5: KYC FRAUD ========== */}
        <TabsContent value="kyc" className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Fingerprint className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">KYC Fraud Detection</h4>
              <p className="text-sm text-gray-400">Detect and handle duplicate identity documents</p>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700 border-orange-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-100 flex items-center gap-2 text-base">
                  <UserX className="h-4 w-4 text-orange-400" />
                  Duplicate KYC Auto-Suspend
                </CardTitle>
                <Switch
                  checked={settings.duplicateKYCAutoSuspend}
                  onCheckedChange={(checked) => updateSetting('duplicateKYCAutoSuspend', checked)}
                />
              </div>
              <CardDescription className="text-gray-500 text-xs">
                Automatically suspend accounts using the same identity document
              </CardDescription>
            </CardHeader>
            {settings.duplicateKYCAutoSuspend && (
              <CardContent className="pt-0 space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Suspension Message</Label>
                  <textarea
                    value={settings.duplicateKYCSuspendMessage || ''}
                    onChange={(e) => updateSetting('duplicateKYCSuspendMessage', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-md p-3 min-h-[80px] mt-1 text-sm"
                    placeholder="Your account has been suspended..."
                  />
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-3 block">Actions to Block</Label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <Label className="text-gray-300 text-xs">Block Deposits</Label>
                      <Switch
                        checked={settings.duplicateKYCBlockDeposits}
                        onCheckedChange={(checked) => updateSetting('duplicateKYCBlockDeposits', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <Label className="text-gray-300 text-xs">Block Trading</Label>
                      <Switch
                        checked={settings.duplicateKYCBlockTrading}
                        onCheckedChange={(checked) => updateSetting('duplicateKYCBlockTrading', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <Label className="text-gray-300 text-xs">Block Competitions</Label>
                      <Switch
                        checked={settings.duplicateKYCBlockCompetitions}
                        onCheckedChange={(checked) => updateSetting('duplicateKYCBlockCompetitions', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <Label className="text-gray-300 text-xs">Block Challenges</Label>
                      <Switch
                        checked={settings.duplicateKYCBlockChallenges}
                        onCheckedChange={(checked) => updateSetting('duplicateKYCBlockChallenges', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg col-span-2 lg:col-span-1">
                      <Label className="text-green-400 text-xs">Allow Withdrawals</Label>
                      <Switch
                        checked={settings.duplicateKYCAllowWithdrawals}
                        onCheckedChange={(checked) => updateSetting('duplicateKYCAllowWithdrawals', checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="font-medium text-blue-400 text-sm mb-2">How it works:</p>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    <li>When KYC completes, system checks for duplicate documents</li>
                    <li>If duplicate found → critical fraud alert + auto-suspend</li>
                    <li>Withdrawals remain enabled so users can retrieve funds</li>
                    <li>Users see suspension message and must contact support</li>
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
