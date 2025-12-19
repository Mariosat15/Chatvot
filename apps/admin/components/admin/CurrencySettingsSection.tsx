'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, Zap, Save, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';

export default function CurrencySettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    currency: {
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      exchangeRateToEUR: 1.0,
    },
    credits: {
      name: 'Volt Credits',
      symbol: '⚡',
      icon: 'zap',
      valueInEUR: 1.0,
      showEUREquivalent: true,
      decimals: 2,
    },
    transactions: {
      minimumDeposit: 10,
      minimumWithdrawal: 20,
      withdrawalFeePercentage: 2,
    },
    branding: {
      primaryColor: '#EAB308',
      accentColor: '#F59E0B',
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Settings saved successfully! Refresh the page to see changes.');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  ];

  const iconOptions = ['zap', 'coins', 'gem', 'star', 'crown', 'shield', 'flame', 'sparkles'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Currency Settings */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Currency Settings</h2>
              <p className="text-green-100 text-sm">Configure the base currency for the platform</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Base Currency</Label>
              <select
                value={settings.currency.code}
                onChange={(e) => {
                  const selected = currencyOptions.find(c => c.code === e.target.value);
                  if (selected) {
                    setSettings(prev => ({
                      ...prev,
                      currency: { ...prev.currency, ...selected },
                    }));
                  }
                }}
                className="mt-2 w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2"
              >
                {currencyOptions.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.symbol} {option.name} ({option.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-gray-300">Exchange Rate to EUR</Label>
              <Input
                type="number"
                step="0.0001"
                value={settings.currency.exchangeRateToEUR}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  currency: { ...prev.currency, exchangeRateToEUR: parseFloat(e.target.value) },
                }))}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">1 EUR = {settings.currency.exchangeRateToEUR} {settings.currency.code}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Credits Settings */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/50 rounded-2xl shadow-2xl shadow-yellow-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Zap className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Virtual Credits Settings</h2>
              <p className="text-yellow-100 text-sm">Configure the platform's virtual currency</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Credit Name</Label>
              <Input
                type="text"
                value={settings.credits.name}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, name: e.target.value },
                }))}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                placeholder="e.g., Volt Credits, Trading Points"
              />
            </div>

            <div>
              <Label className="text-gray-300">Credit Symbol (Emoji)</Label>
              <Input
                type="text"
                value={settings.credits.symbol}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, symbol: e.target.value },
                }))}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100 text-2xl"
                placeholder="⚡"
              />
            </div>

            <div>
              <Label className="text-gray-300">Icon (Lucide Icon Name)</Label>
              <select
                value={settings.credits.icon}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, icon: e.target.value },
                }))}
                className="mt-2 w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2"
              >
                {iconOptions.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-gray-300">Value in EUR</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.credits.valueInEUR}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, valueInEUR: parseFloat(e.target.value) },
                }))}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">1 {settings.credits.name} = €{settings.credits.valueInEUR}</p>
            </div>

            <div>
              <Label className="text-gray-300">Decimal Places</Label>
              <Input
                type="number"
                min="0"
                max="8"
                value={settings.credits.decimals}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, decimals: parseInt(e.target.value) },
                }))}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              />
            </div>

            <div className="flex items-center gap-2 pt-8">
              <Checkbox
                checked={settings.credits.showEUREquivalent}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  credits: { ...prev.credits, showEUREquivalent: !!checked },
                }))}
              />
              <Label className="text-gray-300">Show EUR Equivalent</Label>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Preview:</p>
            <p className="text-xl font-bold text-yellow-400">
              {settings.credits.symbol} 100.00 {settings.credits.name}
              {settings.credits.showEUREquivalent && (
                <span className="text-sm text-gray-400 ml-2">
                  (€{(100 * settings.credits.valueInEUR).toFixed(2)})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Limits */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Transaction Limits</h2>
              <p className="text-blue-100 text-sm">Configure deposit and withdrawal limits</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Minimum Deposit ({settings.currency.symbol})</Label>
              <Input
                type="number"
                min="1"
                value={settings.transactions.minimumDeposit}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setSettings(prev => ({
                    ...prev,
                    transactions: { ...prev.transactions, minimumDeposit: isNaN(value) ? 1 : value },
                  }));
                }}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              />
            </div>

            <div>
              <Label className="text-gray-300">Minimum Withdrawal ({settings.currency.symbol})</Label>
              <Input
                type="number"
                min="1"
                value={settings.transactions.minimumWithdrawal}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setSettings(prev => ({
                    ...prev,
                    transactions: { ...prev.transactions, minimumWithdrawal: isNaN(value) ? 1 : value },
                  }));
                }}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              />
            </div>
          </div>

          {/* Fee Settings Info */}
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-sm text-emerald-400 font-semibold">💡 Fee Configuration</p>
            <p className="text-xs text-gray-400 mt-1">
              All deposit and withdrawal fees are now managed in <strong>Settings → Fees</strong>. 
              This includes platform fees (what you charge users) and bank fees (what providers charge you).
            </p>
          </div>

          {/* Example Calculations */}
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <p className="text-sm text-gray-400 mb-3 font-semibold">Example Conversions:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400">10 {settings.currency.symbol}</p>
                <p className="text-base font-bold text-green-400">{(10 / settings.credits.valueInEUR).toFixed(0)} {settings.credits.symbol}</p>
              </div>
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400">50 {settings.currency.symbol}</p>
                <p className="text-base font-bold text-green-400">{(50 / settings.credits.valueInEUR).toFixed(0)} {settings.credits.symbol}</p>
              </div>
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400">100 {settings.credits.symbol}</p>
                <p className="text-base font-bold text-blue-400">{settings.currency.symbol}{(100 * settings.credits.valueInEUR).toFixed(2)}</p>
              </div>
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400">1000 {settings.credits.symbol}</p>
                <p className="text-base font-bold text-blue-400">{settings.currency.symbol}{(1000 * settings.credits.valueInEUR).toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Min deposit: {settings.currency.symbol}{settings.transactions.minimumDeposit} • 
              Min withdrawal: {settings.currency.symbol}{settings.transactions.minimumWithdrawal}
            </p>
          </div>
        </div>
      </div>

      {/* Branding Colors */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Palette className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Brand Colors</h2>
              <p className="text-purple-100 text-sm">Configure accent colors for the platform</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Primary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={settings.branding.primaryColor}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    branding: { ...prev.branding, primaryColor: e.target.value },
                  }))}
                  className="w-20 h-10 bg-gray-700 border-gray-600"
                />
                <Input
                  type="text"
                  value={settings.branding.primaryColor}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    branding: { ...prev.branding, primaryColor: e.target.value },
                  }))}
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Accent Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={settings.branding.accentColor}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    branding: { ...prev.branding, accentColor: e.target.value },
                  }))}
                  className="w-20 h-10 bg-gray-700 border-gray-600"
                />
                <Input
                  type="text"
                  value={settings.branding.accentColor}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    branding: { ...prev.branding, accentColor: e.target.value },
                  }))}
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold px-8"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

