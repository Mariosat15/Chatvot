'use client';

import { useState, useEffect } from 'react';
import { 
  Bot, 
  TrendingUp, 
  Zap, 
  Settings,
  Power,
  PowerOff,
  ShoppingBag,
  Clock,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface MarketplaceItem {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  category: string;
  version: string;
  strategyType?: string;
  indicatorType?: string;
  defaultSettings: Record<string, any>;
}

interface Purchase {
  purchaseId: string;
  itemId: string;
  item: MarketplaceItem;
  pricePaid: number;
  purchasedAt: string;
  isEnabled: boolean;
  customSettings: Record<string, any>;
  totalUsageTime: number;
  lastUsedAt?: string;
  totalTradesExecuted: number;
}

const CATEGORIES = [
  { value: 'all', label: 'All Items', icon: ShoppingBag },
  { value: 'trading_bot', label: 'Trading Bots', icon: Bot },
  { value: 'indicator', label: 'Indicators', icon: TrendingUp },
  { value: 'strategy', label: 'Strategies', icon: Zap },
];

const getCategoryIcon = (category: string) => {
  const found = CATEGORIES.find(c => c.value === category);
  return found ? found.icon : ShoppingBag;
};

export default function TradingArsenalSection() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  
  useEffect(() => {
    fetchPurchases();
  }, [category]);
  
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      
      const response = await fetch(`/api/marketplace/purchases?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setPurchases(data.purchases.filter((p: Purchase) => p.item));
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Failed to load your items');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleEnabled = async (purchase: Purchase) => {
    try {
      const response = await fetch('/api/marketplace/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.purchaseId,
          isEnabled: !purchase.isEnabled,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPurchases(prev => prev.map(p => 
          p.purchaseId === purchase.purchaseId 
            ? { ...p, isEnabled: !p.isEnabled } 
            : p
        ));
        toast.success(purchase.isEnabled ? 'Item disabled' : 'Item enabled');
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };
  
  const handleOpenSettings = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setEditedSettings({ ...purchase.customSettings });
    setIsSettingsOpen(true);
  };
  
  const handleSaveSettings = async () => {
    if (!selectedPurchase) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/marketplace/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: selectedPurchase.purchaseId,
          customSettings: editedSettings,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPurchases(prev => prev.map(p => 
          p.purchaseId === selectedPurchase.purchaseId 
            ? { ...p, customSettings: editedSettings } 
            : p
        ));
        toast.success('Settings saved');
        setIsSettingsOpen(false);
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  const bots = purchases.filter(p => p.item?.category === 'trading_bot');
  const indicators = purchases.filter(p => p.item?.category === 'indicator');
  const others = purchases.filter(p => !['trading_bot', 'indicator'].includes(p.item?.category || ''));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-cyan-400" />
            Trading Arsenal
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage your purchased bots, indicators, and tools
          </p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Browse Marketplace
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      {/* Category Filter */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                category === cat.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
            </button>
          );
        })}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        </div>
      ) : purchases.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-700">
          <CardContent className="py-16 text-center">
            <ShoppingBag className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Items Yet</h3>
            <p className="text-gray-400 mb-6">
              Visit the marketplace to discover trading bots and indicators
            </p>
            <Link href="/marketplace">
              <Button className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                Explore Marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Trading Bots */}
          {bots.length > 0 && (category === 'all' || category === 'trading_bot') && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-400" />
                Trading Bots ({bots.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bots.map((purchase) => (
                  <PurchaseCard
                    key={purchase.purchaseId}
                    purchase={purchase}
                    onToggle={() => handleToggleEnabled(purchase)}
                    onSettings={() => handleOpenSettings(purchase)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Indicators */}
          {indicators.length > 0 && (category === 'all' || category === 'indicator') && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Indicators ({indicators.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {indicators.map((purchase) => (
                  <PurchaseCard
                    key={purchase.purchaseId}
                    purchase={purchase}
                    onToggle={() => handleToggleEnabled(purchase)}
                    onSettings={() => handleOpenSettings(purchase)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Other Items */}
          {others.length > 0 && category === 'all' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Other Tools ({others.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {others.map((purchase) => (
                  <PurchaseCard
                    key={purchase.purchaseId}
                    purchase={purchase}
                    onToggle={() => handleToggleEnabled(purchase)}
                    onSettings={() => handleOpenSettings(purchase)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Settings Dialog */}
      {selectedPurchase && (
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {selectedPurchase.item.name} Settings
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto py-4">
              {/* Bot-specific settings */}
              {selectedPurchase.item.category === 'trading_bot' && (
                <BotSettingsForm
                  settings={editedSettings}
                  onChange={setEditedSettings}
                  strategyType={selectedPurchase.item.strategyType}
                />
              )}
              
              {/* Indicator-specific settings */}
              {selectedPurchase.item.category === 'indicator' && (
                <IndicatorSettingsForm
                  settings={editedSettings}
                  onChange={setEditedSettings}
                />
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Purchase Card Component
function PurchaseCard({
  purchase,
  onToggle,
  onSettings,
}: {
  purchase: Purchase;
  onToggle: () => void;
  onSettings: () => void;
}) {
  const CategoryIcon = getCategoryIcon(purchase.item.category);
  
  return (
    <Card className={cn(
      'bg-gray-900/80 border transition-all',
      purchase.isEnabled 
        ? 'border-cyan-500/30 hover:border-cyan-500/50' 
        : 'border-gray-700 hover:border-gray-600'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              purchase.isEnabled ? 'bg-cyan-500/20' : 'bg-gray-800'
            )}>
              <CategoryIcon className={cn(
                'h-5 w-5',
                purchase.isEnabled ? 'text-cyan-400' : 'text-gray-500'
              )} />
            </div>
            <div>
              <h4 className="font-semibold text-white">{purchase.item.name}</h4>
              <p className="text-sm text-gray-400">{purchase.item.shortDescription}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSettings}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <button
              onClick={onToggle}
              className={cn(
                'p-2 rounded-lg transition-colors',
                purchase.isEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              )}
            >
              {purchase.isEnabled ? (
                <Power className="h-4 w-4" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-800 text-sm">
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{Math.floor(purchase.totalUsageTime / 60)}h used</span>
          </div>
          {purchase.item.category === 'trading_bot' && (
            <div className="flex items-center gap-1 text-gray-400">
              <Activity className="h-3.5 w-3.5" />
              <span>{purchase.totalTradesExecuted} trades</span>
            </div>
          )}
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs',
            purchase.isEnabled 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-gray-800 text-gray-500'
          )}>
            {purchase.isEnabled ? 'Active' : 'Inactive'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Bot Settings Form
function BotSettingsForm({
  settings,
  onChange,
  strategyType,
}: {
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
  strategyType?: string;
}) {
  const updateSetting = (key: string, value: any) => {
    onChange({ ...settings, [key]: value });
  };
  
  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          General Settings
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Trading Asset</Label>
            <Select
              value={settings.asset || 'AAPL'}
              onValueChange={(v) => updateSetting('asset', v)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AAPL">AAPL (Apple)</SelectItem>
                <SelectItem value="GOOGL">GOOGL (Google)</SelectItem>
                <SelectItem value="MSFT">MSFT (Microsoft)</SelectItem>
                <SelectItem value="TSLA">TSLA (Tesla)</SelectItem>
                <SelectItem value="AMZN">AMZN (Amazon)</SelectItem>
                <SelectItem value="NVDA">NVDA (NVIDIA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Position Size (%)</Label>
            <Input
              type="number"
              value={settings.positionSizePercent || 10}
              onChange={(e) => updateSetting('positionSizePercent', parseInt(e.target.value))}
              min={1}
              max={100}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max Positions</Label>
            <Input
              type="number"
              value={settings.maxPositions || 1}
              onChange={(e) => updateSetting('maxPositions', parseInt(e.target.value))}
              min={1}
              max={10}
              className="bg-gray-800 border-gray-700"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Leverage</Label>
            <Input
              type="number"
              value={settings.leverage || 1}
              onChange={(e) => updateSetting('leverage', parseInt(e.target.value))}
              min={1}
              max={100}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>
      </div>
      
      {/* Risk Management */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Risk Management
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Take Profit (%)</Label>
            <Input
              type="number"
              value={settings.takeProfit || 5}
              onChange={(e) => updateSetting('takeProfit', parseFloat(e.target.value))}
              min={0.1}
              step={0.1}
              className="bg-gray-800 border-gray-700"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Stop Loss (%)</Label>
            <Input
              type="number"
              value={settings.stopLoss || 2}
              onChange={(e) => updateSetting('stopLoss', parseFloat(e.target.value))}
              min={0.1}
              step={0.1}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <div>
            <Label className="text-white">Trailing Stop</Label>
            <p className="text-xs text-gray-400">Move stop loss as price moves in your favor</p>
          </div>
          <Switch
            checked={settings.trailingStop || false}
            onCheckedChange={(v) => updateSetting('trailingStop', v)}
          />
        </div>
      </div>
      
      {/* Strategy-specific settings */}
      {strategyType === 'moving_average' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Moving Average Settings
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>MA Type</Label>
              <Select
                value={settings.maType || 'SMA'}
                onValueChange={(v) => updateSetting('maType', v)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMA">Simple (SMA)</SelectItem>
                  <SelectItem value="EMA">Exponential (EMA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>MA Period</Label>
              <Input
                type="number"
                value={settings.maPeriod || 20}
                onChange={(e) => updateSetting('maPeriod', parseInt(e.target.value))}
                min={5}
                max={200}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Signal Threshold (%)</Label>
            <Input
              type="number"
              value={settings.signalThreshold || 0.5}
              onChange={(e) => updateSetting('signalThreshold', parseFloat(e.target.value))}
              min={0.1}
              max={5}
              step={0.1}
              className="bg-gray-800 border-gray-700"
            />
            <p className="text-xs text-gray-500">
              Minimum % distance from MA to trigger a signal
            </p>
          </div>
        </div>
      )}
      
      {strategyType === 'rsi' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            RSI Settings
          </h4>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>RSI Period</Label>
              <Input
                type="number"
                value={settings.rsiPeriod || 14}
                onChange={(e) => updateSetting('rsiPeriod', parseInt(e.target.value))}
                min={2}
                max={50}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Overbought</Label>
              <Input
                type="number"
                value={settings.overboughtLevel || 70}
                onChange={(e) => updateSetting('overboughtLevel', parseInt(e.target.value))}
                min={50}
                max={90}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Oversold</Label>
              <Input
                type="number"
                value={settings.oversoldLevel || 30}
                onChange={(e) => updateSetting('oversoldLevel', parseInt(e.target.value))}
                min={10}
                max={50}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Trading Hours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Trading Hours (UTC)
          </h4>
          <Switch
            checked={settings.tradingHoursEnabled || false}
            onCheckedChange={(v) => updateSetting('tradingHoursEnabled', v)}
          />
        </div>
        
        {settings.tradingHoursEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Hour</Label>
              <Input
                type="number"
                value={settings.tradingStartHour || 9}
                onChange={(e) => updateSetting('tradingStartHour', parseInt(e.target.value))}
                min={0}
                max={23}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label>End Hour</Label>
              <Input
                type="number"
                value={settings.tradingEndHour || 16}
                onChange={(e) => updateSetting('tradingEndHour', parseInt(e.target.value))}
                min={0}
                max={23}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Indicator Settings Form
function IndicatorSettingsForm({
  settings,
  onChange,
}: {
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
}) {
  const updateSetting = (key: string, value: any) => {
    onChange({ ...settings, [key]: value });
  };
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Period</Label>
        <Input
          type="number"
          value={settings.period || 14}
          onChange={(e) => updateSetting('period', parseInt(e.target.value))}
          min={1}
          max={200}
          className="bg-gray-800 border-gray-700"
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <Label className="text-white">Show on Chart</Label>
          <p className="text-xs text-gray-400">Display indicator overlay on price chart</p>
        </div>
        <Switch
          checked={settings.showOnChart !== false}
          onCheckedChange={(v) => updateSetting('showOnChart', v)}
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <Label className="text-white">Show Panel</Label>
          <p className="text-xs text-gray-400">Display indicator in separate panel</p>
        </div>
        <Switch
          checked={settings.showPanel !== false}
          onCheckedChange={(v) => updateSetting('showPanel', v)}
        />
      </div>
    </div>
  );
}

