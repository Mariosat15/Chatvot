'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Wallet,
  DollarSign,
  Clock,
  Shield,
  RefreshCw,
  Save,
  Percent,
  AlertTriangle,
  Ban,
  CheckCircle,
  Zap,
  Bell,
  Settings,
  CreditCard,
  Building,
  Users,
  Lock,
  Unlock,
  RotateCcw,
  Info,
} from 'lucide-react';

interface WithdrawalSettings {
  // Processing Mode
  processingMode: 'automatic' | 'manual';
  
  // Withdrawal Methods
  bankWithdrawalsEnabled: boolean;
  cardWithdrawalsEnabled: boolean;
  
  // Withdrawal Limits
  minimumWithdrawal: number;
  maximumWithdrawal: number;
  dailyWithdrawalLimit: number;
  monthlyWithdrawalLimit: number;
  
  // Timing
  processingTimeHours: number;
  cooldownHours: number;
  
  // Fees
  useCustomFees: boolean;
  platformFeePercentage: number;
  platformFeeFixed: number;
  
  // Requirements
  requireKYC: boolean;
  requireEmailVerification: boolean;
  minimumAccountAge: number;
  minimumDepositRequired: boolean;
  
  // Restrictions
  allowPartialWithdrawal: boolean;
  allowWithdrawalDuringActiveCompetitions: boolean;
  blockWithdrawalOnActiveChallenges: boolean;
  
  // Fraud Prevention
  maxWithdrawalsPerDay: number;
  maxWithdrawalsPerMonth: number;
  holdPeriodAfterDeposit: number;
  
  // API Rate Limiting (spam protection)
  apiRateLimitEnabled: boolean;
  apiRateLimitRequestsPerMinute: number;
  
  // Payout Methods
  allowedPayoutMethods: string[];
  preferredPayoutMethod: string;
  
  // Sandbox Mode
  sandboxEnabled: boolean;
  sandboxAutoApprove: boolean;
  
  // Nuvei Automatic Processing
  nuveiWithdrawalEnabled: boolean;
  nuveiPreferCardRefund: boolean;
  
  // Manual Mode with Payment Processor
  usePaymentProcessorForManual: boolean;
  
  // Notifications
  notifyAdminOnRequest: boolean;
  notifyAdminOnHighValue: boolean;
  highValueThreshold: number;
  
  // Auto-approval
  autoApproveEnabled: boolean;
  autoApproveMaxAmount: number;
  autoApproveRequireKYC: boolean;
  autoApproveMinAccountAge: number;
  autoApproveMinSuccessfulWithdrawals: number;
  
  lastUpdated: string;
  updatedBy: string;
}

const PAYOUT_METHODS = [
  { value: 'original_method', label: 'Original Payment Method', description: 'Refund to original card/bank' },
  { value: 'stripe_payout', label: 'Stripe Payout', description: 'Bank transfer via Stripe' },
  { value: 'stripe_refund', label: 'Stripe Refund', description: 'Refund original Stripe charge' },
  { value: 'bank_transfer', label: 'Manual Bank Transfer', description: 'Manual wire transfer' },
];

export default function WithdrawalSettingsSection() {
  const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/withdrawal-settings');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      toast.error('Failed to load withdrawal settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/withdrawal-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to save settings');
        return;
      }

      setSettings(data.settings);
      toast.success('Withdrawal settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all withdrawal settings to defaults?')) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/withdrawal-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reset settings');
        return;
      }

      setSettings(data.settings);
      toast.success('Settings reset to defaults');
    } catch (error) {
      toast.error('Failed to reset settings');
      console.error(error);
    } finally {
      setResetting(false);
    }
  };

  const updateSetting = (key: keyof WithdrawalSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const togglePayoutMethod = (method: string) => {
    if (!settings) return;
    
    const methods = settings.allowedPayoutMethods.includes(method)
      ? settings.allowedPayoutMethods.filter(m => m !== method)
      : [...settings.allowedPayoutMethods, method];
    
    updateSetting('allowedPayoutMethods', methods);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
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
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-emerald-500/50 rounded-2xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Wallet className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  💰 Withdrawal Settings
                </h2>
                <p className="text-emerald-100 mt-1">
                  Configure user withdrawals, limits, and payout methods
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                {resetting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reset Defaults
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-emerald-600 hover:bg-white/90"
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

        {/* Processing Status Banner */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                settings.nuveiWithdrawalEnabled 
                  ? 'bg-purple-500/20' 
                  : 'bg-amber-500/20'
              }`}>
                {settings.nuveiWithdrawalEnabled ? (
                  <Zap className="h-6 w-6 text-purple-400" />
                ) : (
                  <Users className="h-6 w-6 text-amber-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Current Status</h3>
                <p className="text-sm text-gray-400">
                  {settings.nuveiWithdrawalEnabled 
                    ? '⚡ Automatic via Nuvei - Users can withdraw instantly to their card/bank' 
                    : '👤 Manual - Admin reviews and processes withdrawals manually'}
                </p>
              </div>
            </div>
            <Badge className={settings.nuveiWithdrawalEnabled ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'}>
              {settings.nuveiWithdrawalEnabled ? '⚡ AUTOMATIC' : '👤 MANUAL'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Withdrawal Methods - NEW SECTION */}
      <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-cyan-400" />
            Withdrawal Methods
          </CardTitle>
          <CardDescription>
            Enable or disable withdrawal methods available to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bank Withdrawals */}
            <div className={`p-4 rounded-lg border transition-all ${
              settings.bankWithdrawalsEnabled 
                ? 'bg-cyan-500/10 border-cyan-500/50' 
                : 'bg-gray-700/30 border-gray-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    settings.bankWithdrawalsEnabled ? 'bg-cyan-500/20' : 'bg-gray-600/30'
                  }`}>
                    <Building className={`h-5 w-5 ${settings.bankWithdrawalsEnabled ? 'text-cyan-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-white">Bank Transfers</p>
                    <p className="text-xs text-gray-400">Allow users to add bank accounts for withdrawals</p>
                  </div>
                </div>
                <Switch
                  checked={settings.bankWithdrawalsEnabled ?? true}
                  onCheckedChange={(checked) => updateSetting('bankWithdrawalsEnabled', checked)}
                />
              </div>
              {settings.bankWithdrawalsEnabled && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-cyan-300/70">
                    ✓ Users can add bank accounts in their wallet
                  </p>
                </div>
              )}
            </div>
            
            {/* Card Withdrawals */}
            <div className={`p-4 rounded-lg border transition-all ${
              settings.cardWithdrawalsEnabled 
                ? 'bg-purple-500/10 border-purple-500/50' 
                : 'bg-gray-700/30 border-gray-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    settings.cardWithdrawalsEnabled ? 'bg-purple-500/20' : 'bg-gray-600/30'
                  }`}>
                    <CreditCard className={`h-5 w-5 ${settings.cardWithdrawalsEnabled ? 'text-purple-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-white">Card Payouts</p>
                    <p className="text-xs text-gray-400">Allow refunds to original deposit card</p>
                  </div>
                </div>
                <Switch
                  checked={settings.cardWithdrawalsEnabled ?? true}
                  onCheckedChange={(checked) => updateSetting('cardWithdrawalsEnabled', checked)}
                />
              </div>
              {settings.cardWithdrawalsEnabled && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-purple-300/70">
                    ✓ Users can withdraw to their deposit card
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {!settings.bankWithdrawalsEnabled && !settings.cardWithdrawalsEnabled && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <p className="text-sm text-red-300">
                  Warning: No withdrawal methods are enabled. Users won&apos;t be able to withdraw.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Withdrawal Limits */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Withdrawal Limits
            </CardTitle>
            <CardDescription>
              Set minimum, maximum, and period limits for withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Minimum (EUR)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.minimumWithdrawal}
                  onChange={(e) => updateSetting('minimumWithdrawal', parseInt(e.target.value) || 1)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-300">Maximum (EUR)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.maximumWithdrawal}
                  onChange={(e) => updateSetting('maximumWithdrawal', parseInt(e.target.value) || 1000)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Daily Limit (EUR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.dailyWithdrawalLimit}
                  onChange={(e) => updateSetting('dailyWithdrawalLimit', parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
              </div>
              <div>
                <Label className="text-gray-300">Monthly Limit (EUR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.monthlyWithdrawalLimit}
                  onChange={(e) => updateSetting('monthlyWithdrawalLimit', parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timing */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Timing & Cooldowns
            </CardTitle>
            <CardDescription>
              Configure processing time and request cooldowns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Processing Time (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.processingTimeHours}
                  onChange={(e) => updateSetting('processingTimeHours', parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Shown to users as expected time</p>
              </div>
              <div>
                <Label className="text-gray-300">Cooldown (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.cooldownHours}
                  onChange={(e) => updateSetting('cooldownHours', parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Time between requests</p>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Hold Period After Deposit (hours)</Label>
              <Input
                type="number"
                min={0}
                value={settings.holdPeriodAfterDeposit}
                onChange={(e) => updateSetting('holdPeriodAfterDeposit', parseInt(e.target.value) || 0)}
                className="bg-gray-700 border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Wait time after deposit before allowing withdrawal</p>
            </div>
          </CardContent>
        </Card>

        {/* Fees */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Percent className="h-5 w-5 text-amber-400" />
              Withdrawal Fees
            </CardTitle>
            <CardDescription>
              Configure platform fees for withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Use Custom Fees</Label>
                <p className="text-xs text-gray-500">Override Credit Conversion settings</p>
              </div>
              <Switch
                checked={settings.useCustomFees}
                onCheckedChange={(checked) => updateSetting('useCustomFees', checked)}
              />
            </div>
            {settings.useCustomFees && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-gray-300">Fee Percentage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={settings.platformFeePercentage}
                    onChange={(e) => updateSetting('platformFeePercentage', parseFloat(e.target.value) || 0)}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Fixed Fee (EUR)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={settings.platformFeeFixed}
                    onChange={(e) => updateSetting('platformFeeFixed', parseFloat(e.target.value) || 0)}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>
              </div>
            )}
            {!settings.useCustomFees && (
              <div className="bg-gray-700/30 rounded-lg p-3 text-sm text-gray-400">
                <Info className="h-4 w-4 inline mr-2" />
                Using fees from Credit Conversion Settings
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-400" />
              Requirements
            </CardTitle>
            <CardDescription>
              Set conditions users must meet to withdraw
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Note: KYC requirement is now managed in KYC Settings section */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Require Email Verification</Label>
                <p className="text-xs text-gray-500">Email must be verified</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Require Previous Deposit</Label>
                <p className="text-xs text-gray-500">Must have deposited at least once</p>
              </div>
              <Switch
                checked={settings.minimumDepositRequired}
                onCheckedChange={(checked) => updateSetting('minimumDepositRequired', checked)}
              />
            </div>
            <div>
              <Label className="text-gray-300">Minimum Account Age (days)</Label>
              <Input
                type="number"
                min={0}
                value={settings.minimumAccountAge}
                onChange={(e) => updateSetting('minimumAccountAge', parseInt(e.target.value) || 0)}
                className="bg-gray-700 border-gray-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Restrictions */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-400" />
              Restrictions
            </CardTitle>
            <CardDescription>
              Control when users can make withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Allow Partial Withdrawal</Label>
                <p className="text-xs text-gray-500">Can withdraw less than full balance</p>
              </div>
              <Switch
                checked={settings.allowPartialWithdrawal}
                onCheckedChange={(checked) => updateSetting('allowPartialWithdrawal', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Allow During Active Competitions</Label>
                <p className="text-xs text-gray-500">Can withdraw while in competitions</p>
              </div>
              <Switch
                checked={settings.allowWithdrawalDuringActiveCompetitions}
                onCheckedChange={(checked) => updateSetting('allowWithdrawalDuringActiveCompetitions', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Block on Active Challenges</Label>
                <p className="text-xs text-gray-500">Prevent withdrawal with pending challenges</p>
              </div>
              <Switch
                checked={settings.blockWithdrawalOnActiveChallenges}
                onCheckedChange={(checked) => updateSetting('blockWithdrawalOnActiveChallenges', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fraud Prevention */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              Fraud Prevention
            </CardTitle>
            <CardDescription>
              Limit withdrawal frequency to prevent abuse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Max Per Day</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.maxWithdrawalsPerDay}
                  onChange={(e) => updateSetting('maxWithdrawalsPerDay', parseInt(e.target.value) || 1)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-300">Max Per Month</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.maxWithdrawalsPerMonth}
                  onChange={(e) => updateSetting('maxWithdrawalsPerMonth', parseInt(e.target.value) || 1)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            
            {/* API Rate Limiting */}
            <div className="pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-gray-300">API Rate Limiting</Label>
                  <p className="text-xs text-gray-500">Prevents rapid API requests (spam/DDoS protection)</p>
                </div>
                <Switch
                  checked={settings.apiRateLimitEnabled ?? true}
                  onCheckedChange={(checked) => updateSetting('apiRateLimitEnabled', checked)}
                />
              </div>
              
              {settings.apiRateLimitEnabled && (
                <div>
                  <Label className="text-gray-300">Requests Per Minute (per user)</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Maximum API requests allowed per minute for withdrawal operations
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.apiRateLimitRequestsPerMinute ?? 5}
                    onChange={(e) => updateSetting('apiRateLimitRequestsPerMinute', parseInt(e.target.value) || 5)}
                    className="bg-gray-700 border-gray-600 w-24"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nuvei Automatic Withdrawal */}
      <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-400" />
            Automatic Withdrawal Processing (Nuvei)
            {settings.nuveiWithdrawalEnabled && (
              <Badge className="bg-purple-500/20 text-purple-300">Active</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Enable automatic withdrawal processing via Nuvei payment gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                settings.nuveiWithdrawalEnabled 
                  ? 'bg-purple-500/20' 
                  : 'bg-gray-600/20'
              }`}>
                <Zap className={`h-6 w-6 ${settings.nuveiWithdrawalEnabled ? 'text-purple-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Enable Automatic Withdrawals</h3>
                <p className="text-sm text-gray-400">
                  When enabled, users can withdraw directly to their card or bank account via Nuvei
                </p>
              </div>
            </div>
            <Switch
              checked={settings.nuveiWithdrawalEnabled}
              onCheckedChange={(checked) => updateSetting('nuveiWithdrawalEnabled', checked)}
            />
          </div>
          
          {settings.nuveiWithdrawalEnabled && (
            <>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-purple-400 mt-0.5" />
                  <div className="text-sm text-purple-200">
                    <p className="font-medium">How it works:</p>
                    <ul className="mt-2 space-y-1 text-purple-300/80">
                      <li>• Users can withdraw to their original deposit card (refund) or enter bank details</li>
                      <li>• Withdrawals are processed automatically through Nuvei</li>
                      <li>• Card refunds typically arrive in 3-5 business days</li>
                      <li>• Bank transfers typically arrive in 3-5 business days</li>
                      <li>• Nuvei must be configured in Payment Providers</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-300">Prefer Card Refund</Label>
                  <p className="text-xs text-gray-500">Suggest card refund over bank transfer to users</p>
                </div>
                <Switch
                  checked={settings.nuveiPreferCardRefund}
                  onCheckedChange={(checked) => updateSetting('nuveiPreferCardRefund', checked)}
                />
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="text-xs text-amber-300">
                    Make sure Nuvei is properly configured in Payment Providers before enabling automatic withdrawals.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout Methods */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan-400" />
            Payout Methods
          </CardTitle>
          <CardDescription>
            Configure available withdrawal methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PAYOUT_METHODS.map((method) => (
              <div
                key={method.value}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  settings.allowedPayoutMethods.includes(method.value)
                    ? 'bg-emerald-500/10 border-emerald-500/50'
                    : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => togglePayoutMethod(method.value)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{method.label}</p>
                    <p className="text-xs text-gray-400 mt-1">{method.description}</p>
                  </div>
                  <Switch
                    checked={settings.allowedPayoutMethods.includes(method.value)}
                    onCheckedChange={() => togglePayoutMethod(method.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Label className="text-gray-300">Preferred Method</Label>
            <Select
              value={settings.preferredPayoutMethod}
              onValueChange={(value) => updateSetting('preferredPayoutMethod', value)}
            >
              <SelectTrigger className="w-full bg-gray-700 border-gray-600 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.filter(m => settings.allowedPayoutMethods.includes(m.value)).map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sandbox Settings */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-400" />
              Sandbox Mode
            </CardTitle>
            <CardDescription>
              Configure withdrawal behavior in test/sandbox mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Enable Sandbox Withdrawals</Label>
                <p className="text-xs text-gray-500">Allow withdrawals in sandbox mode</p>
              </div>
              <Switch
                checked={settings.sandboxEnabled}
                onCheckedChange={(checked) => updateSetting('sandboxEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Auto-Approve Sandbox</Label>
                <p className="text-xs text-gray-500">Automatically approve sandbox withdrawals</p>
              </div>
              <Switch
                checked={settings.sandboxAutoApprove}
                onCheckedChange={(checked) => updateSetting('sandboxAutoApprove', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-400" />
              Admin Notifications
            </CardTitle>
            <CardDescription>
              Configure when admins receive alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Notify on New Request</Label>
                <p className="text-xs text-gray-500">Email admin for each request</p>
              </div>
              <Switch
                checked={settings.notifyAdminOnRequest}
                onCheckedChange={(checked) => updateSetting('notifyAdminOnRequest', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Notify on High Value</Label>
                <p className="text-xs text-gray-500">Alert on large withdrawals</p>
              </div>
              <Switch
                checked={settings.notifyAdminOnHighValue}
                onCheckedChange={(checked) => updateSetting('notifyAdminOnHighValue', checked)}
              />
            </div>
            {settings.notifyAdminOnHighValue && (
              <div>
                <Label className="text-gray-300">High Value Threshold (EUR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.highValueThreshold}
                  onChange={(e) => updateSetting('highValueThreshold', parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual Mode Settings - Only show when Nuvei automatic is NOT enabled */}
      {!settings.nuveiWithdrawalEnabled && (
        <>
          {/* Payment Processor Integration for Manual Mode */}
          <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-400" />
                Payment Processor for Manual Withdrawals
                {settings.usePaymentProcessorForManual && (
                  <Badge className="bg-blue-500/20 text-blue-300">Active</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Route manual withdrawals through Nuvei for automated payment processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    settings.usePaymentProcessorForManual 
                      ? 'bg-blue-500/20' 
                      : 'bg-gray-600/20'
                  }`}>
                    <CreditCard className={`h-6 w-6 ${settings.usePaymentProcessorForManual ? 'text-blue-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Use Nuvei for Manual Withdrawals</h3>
                    <p className="text-sm text-gray-400">
                      When enabled, withdrawal requests are sent to Nuvei. Admin approval triggers the actual payout.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.usePaymentProcessorForManual}
                  onCheckedChange={(checked) => updateSetting('usePaymentProcessorForManual', checked)}
                />
              </div>
              
              {settings.usePaymentProcessorForManual ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium">How it works (Nuvei-managed manual mode):</p>
                      <ul className="mt-2 space-y-1 text-blue-300/80">
                        <li>1. User requests withdrawal → Request created in Nuvei (PENDING)</li>
                        <li>2. Admin reviews request in your dashboard</li>
                        <li>3. Admin approves → Nuvei receives approval and processes the payout</li>
                        <li>4. Admin declines → Nuvei cancels the request, credits refunded</li>
                        <li>• Nuvei handles the actual money transfer to user</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-400 mt-0.5" />
                    <div className="text-sm text-amber-200">
                      <p className="font-medium">How it works (Pure manual mode):</p>
                      <ul className="mt-2 space-y-1 text-amber-300/80">
                        <li>1. User requests withdrawal → Request stored in your system</li>
                        <li>2. Admin reviews request and sees user&apos;s bank details</li>
                        <li>3. Admin manually transfers money via bank or card refund</li>
                        <li>4. Admin marks withdrawal as completed after payment</li>
                        <li>• You handle the actual money transfer manually</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        <Card className="bg-gray-800/50 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Auto-Approval Rules
              <Badge className="bg-amber-500/20 text-amber-300">Manual Mode</Badge>
            </CardTitle>
            <CardDescription>
              Auto-approve certain withdrawals without admin review (still processed {settings.usePaymentProcessorForManual ? 'via Nuvei' : 'manually via bank transfer'})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Enable Auto-Approval</Label>
                <p className="text-xs text-gray-500">Automatically approve qualifying withdrawals</p>
              </div>
              <Switch
                checked={settings.autoApproveEnabled}
                onCheckedChange={(checked) => updateSetting('autoApproveEnabled', checked)}
              />
            </div>
            {settings.autoApproveEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Max Auto-Approve Amount (EUR)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.autoApproveMaxAmount}
                      onChange={(e) => updateSetting('autoApproveMaxAmount', parseInt(e.target.value) || 0)}
                      className="bg-gray-700 border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Larger amounts require manual review</p>
                  </div>
                  <div>
                    <Label className="text-gray-300">Min Account Age (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={settings.autoApproveMinAccountAge}
                      onChange={(e) => updateSetting('autoApproveMinAccountAge', parseInt(e.target.value) || 0)}
                      className="bg-gray-700 border-gray-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Require KYC for Auto-Approve</Label>
                    <p className="text-xs text-gray-500">Only auto-approve KYC-verified users</p>
                  </div>
                  <Switch
                    checked={settings.autoApproveRequireKYC}
                    onCheckedChange={(checked) => updateSetting('autoApproveRequireKYC', checked)}
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Min Previous Successful Withdrawals</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.autoApproveMinSuccessfulWithdrawals}
                    onChange={(e) => updateSetting('autoApproveMinSuccessfulWithdrawals', parseInt(e.target.value) || 0)}
                    className="bg-gray-700 border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Trust established users more</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Last Updated Info */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(settings.lastUpdated).toLocaleString()} by {settings.updatedBy}
      </div>
    </div>
  );
}

