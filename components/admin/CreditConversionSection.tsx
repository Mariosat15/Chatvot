'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, TrendingDown, Info } from 'lucide-react';

export default function CreditConversionSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    eurToCreditsRate: 100,
    minimumDeposit: 10,
    minimumWithdrawal: 20,
    withdrawalFeePercentage: 2,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/credit-conversion');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings({
        eurToCreditsRate: data.eurToCreditsRate || 100,
        minimumDeposit: data.minimumDeposit || 10,
        minimumWithdrawal: data.minimumWithdrawal || 20,
        withdrawalFeePercentage: data.withdrawalFeePercentage || 2,
      });
    } catch (error) {
      toast.error('Failed to load credit conversion settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/credit-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      toast.success('💰 Credit conversion settings updated successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const calculateExamples = () => {
    const eur10 = 10 * settings.eurToCreditsRate;
    const eur50 = 50 * settings.eurToCreditsRate;
    const eur100 = 100 * settings.eurToCreditsRate;
    
    const credits1000 = 1000 / settings.eurToCreditsRate;
    const credits5000 = 5000 / settings.eurToCreditsRate;
    const credits10000 = 10000 / settings.eurToCreditsRate;
    
    return { eur10, eur50, eur100, credits1000, credits5000, credits10000 };
  };

  const examples = calculateExamples();

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-12">
        <div className="flex items-center justify-center">
          <div className="text-green-400 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                💰 Credit Conversion Settings
              </h2>
              <p className="text-green-100 mt-1">
                Configure how EUR converts to Credits in your platform
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Card */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-xl">
              <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-400" />
              </div>
              Conversion & Limits
            </CardTitle>
            <CardDescription className="text-sm">Set conversion rates and minimum amounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* EUR to Credits Rate */}
            <div className="space-y-2">
              <Label className="text-white font-semibold">EUR to Credits Conversion Rate</Label>
              <p className="text-sm text-gray-400 mb-2">How many credits equal 1 EUR?</p>
              <Input
                type="number"
                min="1"
                max="10000"
                value={settings.eurToCreditsRate}
                onChange={(e) => setSettings({ ...settings, eurToCreditsRate: parseFloat(e.target.value) || 100 })}
                className="bg-gray-900 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Example: If set to 100, then 1 EUR = {settings.eurToCreditsRate} Credits
              </p>
            </div>

            <Separator className="bg-gray-700" />

            {/* Minimum Deposit */}
            <div className="space-y-2">
              <Label className="text-white font-semibold">Minimum Deposit (EUR)</Label>
              <Input
                type="number"
                min="1"
                value={settings.minimumDeposit}
                onChange={(e) => setSettings({ ...settings, minimumDeposit: parseFloat(e.target.value) || 10 })}
                className="bg-gray-900 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Minimum amount users can deposit
              </p>
            </div>

            {/* Minimum Withdrawal */}
            <div className="space-y-2">
              <Label className="text-white font-semibold">Minimum Withdrawal (EUR)</Label>
              <Input
                type="number"
                min="1"
                value={settings.minimumWithdrawal}
                onChange={(e) => setSettings({ ...settings, minimumWithdrawal: parseFloat(e.target.value) || 20 })}
                className="bg-gray-900 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Minimum amount users can withdraw
              </p>
            </div>

            {/* Withdrawal Fee */}
            <div className="space-y-2">
              <Label className="text-white font-semibold">Withdrawal Fee (%)</Label>
              <Input
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={settings.withdrawalFeePercentage}
                onChange={(e) => setSettings({ ...settings, withdrawalFeePercentage: parseFloat(e.target.value) || 2 })}
                className="bg-gray-900 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Fee charged when users withdraw (platform revenue)
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold h-14 text-lg shadow-lg shadow-green-500/50"
            >
              {saving ? 'Saving...' : '💾 Save Credit Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Examples & Preview Card */}
        <div className="space-y-6">
          {/* Deposit Examples */}
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/50 shadow-xl shadow-green-500/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                Deposit Examples
              </CardTitle>
              <CardDescription className="text-sm">What users get when they deposit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-white font-semibold">€10</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-400 font-bold">{examples.eur10.toFixed(0)} Credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-white font-semibold">€50</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-400 font-bold">{examples.eur50.toFixed(0)} Credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-white font-semibold">€100</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-400 font-bold">{examples.eur100.toFixed(0)} Credits</span>
              </div>
            </CardContent>
          </Card>

          {/* Withdrawal Examples */}
          <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/50 shadow-xl shadow-blue-500/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-blue-400" />
                </div>
                Withdrawal Examples
              </CardTitle>
              <CardDescription className="text-sm">What users receive when they withdraw</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-white font-semibold">1,000 Credits</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-400 font-bold">€{examples.credits1000.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 px-3">
                  Fee: €{(examples.credits1000 * settings.withdrawalFeePercentage / 100).toFixed(2)} ({settings.withdrawalFeePercentage}%)
                  • Net: €{(examples.credits1000 * (1 - settings.withdrawalFeePercentage / 100)).toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-white font-semibold">5,000 Credits</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-400 font-bold">€{examples.credits5000.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 px-3">
                  Fee: €{(examples.credits5000 * settings.withdrawalFeePercentage / 100).toFixed(2)} ({settings.withdrawalFeePercentage}%)
                  • Net: €{(examples.credits5000 * (1 - settings.withdrawalFeePercentage / 100)).toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-white font-semibold">10,000 Credits</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-400 font-bold">€{examples.credits10000.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 px-3">
                  Fee: €{(examples.credits10000 * settings.withdrawalFeePercentage / 100).toFixed(2)} ({settings.withdrawalFeePercentage}%)
                  • Net: €{(examples.credits10000 * (1 - settings.withdrawalFeePercentage / 100)).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/50 shadow-xl shadow-purple-500/10">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Info className="h-5 w-5 text-purple-400" />
                </div>
                <div className="text-sm text-gray-300 space-y-2">
                  <p className="font-semibold text-white text-base">Important Notes:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-sm">
                    <li>Users deposit EUR and receive Credits</li>
                    <li>Credits are used for competition entry fees</li>
                    <li>Winners receive Credits from prize pools</li>
                    <li>Users can withdraw Credits back to EUR</li>
                    <li>Withdrawal fee is your platform revenue</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

