'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  DollarSign, 
  RefreshCw, 
  Save, 
  Info, 
  Building2,
  ArrowRightLeft,
  Percent,
  CreditCard,
  Banknote,
} from 'lucide-react';

interface FeeSettings {
  // Platform fees (what we charge users)
  platformDepositFeePercentage: number;
  platformWithdrawalFeePercentage: number;
  
  // Bank fees (what providers charge us)
  bankDepositFeePercentage: number;
  bankDepositFeeFixed: number;
  bankWithdrawalFeePercentage: number;
  bankWithdrawalFeeFixed: number;
}

export default function FeeSettingsSection() {
  const [settings, setSettings] = useState<FeeSettings>({
    platformDepositFeePercentage: 2,
    platformWithdrawalFeePercentage: 2,
    bankDepositFeePercentage: 2.9,
    bankDepositFeeFixed: 0.30,
    bankWithdrawalFeePercentage: 0.25,
    bankWithdrawalFeeFixed: 0.25,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/fee-settings');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fee settings:', data.settings);
        
        // Ensure all values are valid numbers with defaults
        setSettings({
          platformDepositFeePercentage: data.settings?.platformDepositFeePercentage ?? 2,
          platformWithdrawalFeePercentage: data.settings?.platformWithdrawalFeePercentage ?? 2,
          bankDepositFeePercentage: data.settings?.bankDepositFeePercentage ?? 2.9,
          bankDepositFeeFixed: data.settings?.bankDepositFeeFixed ?? 0.30,
          bankWithdrawalFeePercentage: data.settings?.bankWithdrawalFeePercentage ?? 0.25,
          bankWithdrawalFeeFixed: data.settings?.bankWithdrawalFeeFixed ?? 0.25,
        });
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/fee-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      const data = await response.json();
      
      // Update local state with saved values from server
      if (data.settings) {
        setSettings(data.settings);
      }

      toast.success('Fee settings saved successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save fee settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate example earnings
  const exampleDeposit = 100; // €100 deposit
  const platformDepositFee = exampleDeposit * (settings.platformDepositFeePercentage / 100);
  const bankDepositFee = (exampleDeposit * (settings.bankDepositFeePercentage / 100)) + settings.bankDepositFeeFixed;
  const netDepositEarning = platformDepositFee - bankDepositFee;

  const exampleWithdrawal = 100; // €100 withdrawal
  const platformWithdrawalFee = exampleWithdrawal * (settings.platformWithdrawalFeePercentage / 100);
  const bankWithdrawalFee = (exampleWithdrawal * (settings.bankWithdrawalFeePercentage / 100)) + settings.bankWithdrawalFeeFixed;
  const netWithdrawalEarning = platformWithdrawalFee - bankWithdrawalFee;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900 border-emerald-500/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Fee Configuration</CardTitle>
                <CardDescription>
                  Centralized configuration for all platform and bank fees
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Info Banner */}
      <Card className="bg-blue-900/30 border-blue-500/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">How Fees Work:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-300">
                <li><strong>Platform Fees</strong>: What you charge users (your revenue)</li>
                <li><strong>Bank Fees</strong>: What Stripe/banks charge you (your cost)</li>
                <li><strong>Net Earnings</strong> = Platform Fees - Bank Fees</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Deposit Fee */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-400" />
              Platform Deposit Fee
            </CardTitle>
            <CardDescription>Fee charged to users when they deposit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400">Percentage (%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={settings.platformDepositFeePercentage}
                  onChange={(e) => setSettings(s => ({ ...s, platformDepositFeePercentage: parseFloat(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700 text-white pr-8"
                />
                <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                User deposits €100 → Platform charges €{platformDepositFee.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Deposit Fee */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-400" />
              Bank Deposit Fee (Stripe)
            </CardTitle>
            <CardDescription>What Stripe charges you for deposits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Percentage (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={settings.bankDepositFeePercentage}
                  onChange={(e) => setSettings(s => ({ ...s, bankDepositFeePercentage: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Fixed Fee (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={settings.bankDepositFeeFixed}
                  onChange={(e) => setSettings(s => ({ ...s, bankDepositFeeFixed: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              €100 deposit → Stripe takes €{bankDepositFee.toFixed(2)} ({settings.bankDepositFeePercentage}% + €{settings.bankDepositFeeFixed})
            </p>
          </CardContent>
        </Card>

        {/* Platform Withdrawal Fee */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-400" />
              Platform Withdrawal Fee
            </CardTitle>
            <CardDescription>Fee charged to users when they withdraw</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400">Percentage (%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={settings.platformWithdrawalFeePercentage}
                  onChange={(e) => setSettings(s => ({ ...s, platformWithdrawalFeePercentage: parseFloat(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700 text-white pr-8"
                />
                <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                User withdraws €100 → Platform charges €{platformWithdrawalFee.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Withdrawal Fee */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-400" />
              Bank Withdrawal Fee (Payouts)
            </CardTitle>
            <CardDescription>What bank charges for payouts to users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Percentage (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={settings.bankWithdrawalFeePercentage}
                  onChange={(e) => setSettings(s => ({ ...s, bankWithdrawalFeePercentage: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Fixed Fee (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={settings.bankWithdrawalFeeFixed}
                  onChange={(e) => setSettings(s => ({ ...s, bankWithdrawalFeeFixed: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              €100 payout → Bank takes €{bankWithdrawalFee.toFixed(2)} ({settings.bankWithdrawalFeePercentage}% + €{settings.bankWithdrawalFeeFixed})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Earnings Summary */}
      <Card className="bg-gray-900 border-emerald-500/50">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-400" />
            Net Earnings Calculator (per €100)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Per €100 Deposit</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-green-400">+€{platformDepositFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bank Fee</span>
                  <span className="text-red-400">-€{bankDepositFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                  <span className="text-white">Net Earning</span>
                  <span className={netDepositEarning >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    €{netDepositEarning.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Withdrawal */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Per €100 Withdrawal</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-green-400">+€{platformWithdrawalFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bank Fee</span>
                  <span className="text-red-400">-€{bankWithdrawalFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                  <span className="text-white">Net Earning</span>
                  <span className={netWithdrawalEarning >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    €{netWithdrawalEarning.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(netDepositEarning < 0 || netWithdrawalEarning < 0) && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Warning: Your platform fees don't cover bank costs. You're losing money on transactions!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info about other settings */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium mb-1">Other Settings Location:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li><strong>Transaction Limits</strong> (min deposit/withdrawal) → Settings → Currency</li>
                <li><strong>Credit Conversion Rate</strong> (credits per €1) → Settings → Currency → "Value in EUR"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

