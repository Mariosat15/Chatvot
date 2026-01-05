'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  RefreshCw, 
  Save, 
  Plus, 
  Settings2, 
  Trash2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  Globe,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TradingSymbol {
  _id: string;
  symbol: string;
  name: string;
  category: 'major' | 'cross' | 'exotic' | 'custom';
  enabled: boolean;
  pip: number;
  contractSize: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
  defaultSpread: number;
  commission: number;
  popular: boolean;
  sortOrder: number;
  icon: string;
  marginRequirement?: number;
}

interface Stats {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: {
    major: number;
    cross: number;
    exotic: number;
    custom: number;
  };
}

const CATEGORY_CONFIG = {
  major: { 
    label: 'Major Pairs', 
    icon: TrendingUp, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Most traded currency pairs with tightest spreads'
  },
  cross: { 
    label: 'Cross Pairs', 
    icon: ArrowLeftRight, 
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Currency pairs without USD'
  },
  exotic: { 
    label: 'Exotic Pairs', 
    icon: Globe, 
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Emerging market currencies'
  },
  custom: { 
    label: 'Custom', 
    icon: Sparkles, 
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Custom added symbols'
  },
};

export default function SymbolsSection() {
  const [symbols, setSymbols] = useState<TradingSymbol[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    major: true,
    cross: true,
    exotic: true,
    custom: true,
  });
  
  // Edit dialog
  const [editSymbol, setEditSymbol] = useState<TradingSymbol | null>(null);
  const [editForm, setEditForm] = useState<Partial<TradingSymbol>>({});
  
  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSymbol, setNewSymbol] = useState({
    symbol: '',
    name: '',
    pip: 0.0001,
    category: 'custom' as const,
  });
  
  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // Load symbols
  useEffect(() => {
    loadSymbols();
  }, []);

  const loadSymbols = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/symbols');
      if (res.ok) {
        const data = await res.json();
        setSymbols(data.symbols);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
      toast.error('Failed to load symbols');
    }
    setIsLoading(false);
  };

  // Filter symbols
  const filteredSymbols = useMemo(() => {
    return symbols.filter(sym => {
      const matchesSearch = searchQuery === '' || 
        sym.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sym.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || sym.category === filterCategory;
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'enabled' && sym.enabled) ||
        (filterStatus === 'disabled' && !sym.enabled);
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [symbols, searchQuery, filterCategory, filterStatus]);

  // Group by category
  const groupedSymbols = useMemo(() => {
    const groups: Record<string, TradingSymbol[]> = {
      major: [],
      cross: [],
      exotic: [],
      custom: [],
    };
    
    filteredSymbols.forEach(sym => {
      if (groups[sym.category]) {
        groups[sym.category].push(sym);
      }
    });
    
    // Sort each group by sortOrder
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    
    return groups;
  }, [filteredSymbols]);

  // Toggle symbol enabled status
  const toggleSymbol = (symbol: string, enabled: boolean) => {
    setSymbols(prev => prev.map(s => 
      s.symbol === symbol ? { ...s, enabled } : s
    ));
    setPendingChanges(prev => ({ ...prev, [symbol]: enabled }));
  };

  // Save all pending changes
  const saveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('No changes to save');
      return;
    }
    
    setIsSaving(true);
    try {
      const symbolUpdates = Object.entries(pendingChanges).map(([symbol, enabled]) => ({
        symbol,
        enabled
      }));
      
      const res = await fetch('/api/symbols', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulkUpdate', symbols: symbolUpdates }),
      });
      
      if (res.ok) {
        toast.success(`Saved ${symbolUpdates.length} changes`);
        setPendingChanges({});
        loadSymbols(); // Refresh stats
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save changes');
    }
    setIsSaving(false);
  };

  // Bulk enable/disable
  const bulkToggle = async (action: 'enableAll' | 'disableAll', category?: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/symbols', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, category }),
      });
      
      if (res.ok) {
        toast.success(action === 'enableAll' ? 'All symbols enabled' : 'All symbols disabled');
        setPendingChanges({});
        loadSymbols();
      }
    } catch (error) {
      toast.error('Failed to update symbols');
    }
    setIsSaving(false);
  };

  // Sync with defaults
  const syncSymbols = async (reset: boolean = false) => {
    if (reset && !confirm('This will reset ALL symbols to default settings. Continue?')) {
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/symbols/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset }),
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setPendingChanges({});
        loadSymbols();
      }
    } catch (error) {
      toast.error('Failed to sync symbols');
    }
    setIsSaving(false);
  };

  // Update symbol settings
  const updateSymbol = async () => {
    if (!editSymbol) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/symbols/${encodeURIComponent(editSymbol.symbol)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      
      if (res.ok) {
        toast.success(`${editSymbol.symbol} updated`);
        setEditSymbol(null);
        loadSymbols();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update symbol');
    }
    setIsSaving(false);
  };

  // Add custom symbol
  const addSymbol = async () => {
    if (!newSymbol.symbol || !newSymbol.name) {
      toast.error('Symbol and name are required');
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSymbol),
      });
      
      if (res.ok) {
        toast.success(`${newSymbol.symbol} added`);
        setShowAddDialog(false);
        setNewSymbol({ symbol: '', name: '', pip: 0.0001, category: 'custom' });
        loadSymbols();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add symbol');
      }
    } catch (error) {
      toast.error('Failed to add symbol');
    }
    setIsSaving(false);
  };

  // Delete custom symbol
  const deleteSymbol = async (symbol: string) => {
    if (!confirm(`Delete ${symbol}? This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`/api/symbols/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        toast.success(`${symbol} deleted`);
        loadSymbols();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete symbol');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            Trading Symbols
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage which symbols traders can see and trade
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncSymbols(false)}
            disabled={isSaving}
            className="border-gray-700"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSaving && "animate-spin")} />
            Sync
          </Button>
          
          {hasPendingChanges && (
            <Button
              onClick={saveChanges}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save ({Object.keys(pendingChanges).length})
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Symbols</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-400">{stats.enabled}</div>
              <div className="text-xs text-gray-400">Enabled</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-400">{stats.disabled}</div>
              <div className="text-xs text-gray-400">Disabled</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-400">{stats.byCategory.major}</div>
              <div className="text-xs text-gray-400">Major Pairs</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-400">{stats.byCategory.cross}</div>
              <div className="text-xs text-gray-400">Cross Pairs</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters & Actions */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-700"
              />
            </div>
            
            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="major">Major Pairs</SelectItem>
                <SelectItem value="cross">Cross Pairs</SelectItem>
                <SelectItem value="exotic">Exotic Pairs</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] bg-gray-900 border-gray-700">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Bulk Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggle('enableAll', filterCategory !== 'all' ? filterCategory : undefined)}
                disabled={isSaving}
                className="border-green-700 text-green-400 hover:bg-green-900/20"
              >
                <ToggleRight className="h-4 w-4 mr-1" />
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggle('disableAll', filterCategory !== 'all' ? filterCategory : undefined)}
                disabled={isSaving}
                className="border-red-700 text-red-400 hover:bg-red-900/20"
              >
                <ToggleLeft className="h-4 w-4 mr-1" />
                Disable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="border-violet-700 text-violet-400 hover:bg-violet-900/20"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Symbol
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Changes Warning */}
      {hasPendingChanges && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-amber-200">
            You have {Object.keys(pendingChanges).length} unsaved changes
          </span>
          <Button
            size="sm"
            onClick={saveChanges}
            disabled={isSaving}
            className="ml-auto bg-amber-600 hover:bg-amber-700"
          >
            Save Changes
          </Button>
        </div>
      )}

      {/* Symbol Categories */}
      <div className="space-y-4">
        {(['major', 'cross', 'exotic', 'custom'] as const).map(category => {
          const config = CATEGORY_CONFIG[category];
          const categorySymbols = groupedSymbols[category];
          const enabledCount = categorySymbols.filter(s => s.enabled).length;
          
          if (categorySymbols.length === 0) return null;
          
          return (
            <Card key={category} className={cn("bg-gray-800/50 border-gray-700", config.borderColor)}>
              <CardHeader 
                className="cursor-pointer hover:bg-gray-700/30 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedCategories[category] ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <config.icon className={cn("h-5 w-5", config.color)} />
                    <div>
                      <CardTitle className="text-white">{config.label}</CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn(config.bgColor, config.color, "border-0")}>
                      {enabledCount}/{categorySymbols.length} enabled
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              {expandedCategories[category] && (
                <CardContent>
                  <div className="grid gap-2">
                    {categorySymbols.map(sym => (
                      <div
                        key={sym.symbol}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all",
                          sym.enabled 
                            ? "bg-gray-900/50 border-gray-700" 
                            : "bg-gray-900/20 border-gray-800 opacity-60",
                          pendingChanges[sym.symbol] !== undefined && "ring-2 ring-amber-500/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{sym.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-white">{sym.symbol}</span>
                              {sym.popular && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-[10px]">
                                  Popular
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{sym.name}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-gray-500 hidden sm:block">
                            <span>Pip: {sym.pip}</span>
                            <span className="mx-2">•</span>
                            <span>Spread: {sym.defaultSpread}</span>
                            <span className="mx-2">•</span>
                            <span>Lot: {sym.minLotSize}-{sym.maxLotSize}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditSymbol(sym);
                                setEditForm(sym);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Settings2 className="h-4 w-4 text-gray-400" />
                            </Button>
                            
                            {sym.category === 'custom' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSymbol(sym.symbol)}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Switch
                              checked={sym.enabled}
                              onCheckedChange={(checked) => toggleSymbol(sym.symbol, checked)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Reset to Defaults */}
      <Card className="bg-red-900/10 border-red-900/30">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm mb-4">
            Reset all symbols to default settings. This will remove any custom symbols and restore all default pairs.
          </p>
          <Button
            variant="destructive"
            onClick={() => syncSymbols(true)}
            disabled={isSaving}
          >
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>

      {/* Edit Symbol Dialog */}
      <Dialog open={!!editSymbol} onOpenChange={() => setEditSymbol(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Edit {editSymbol?.symbol}
            </DialogTitle>
            <DialogDescription>
              Configure trading specifications for this symbol
            </DialogDescription>
          </DialogHeader>
          
          {editSymbol && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pip Value</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={editForm.pip || 0.0001}
                    onChange={(e) => setEditForm(prev => ({ ...prev, pip: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div>
                  <Label>Contract Size</Label>
                  <Input
                    type="number"
                    value={editForm.contractSize || 100000}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contractSize: parseInt(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Min Lot</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.minLotSize || 0.01}
                    onChange={(e) => setEditForm(prev => ({ ...prev, minLotSize: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div>
                  <Label>Max Lot</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.maxLotSize || 100}
                    onChange={(e) => setEditForm(prev => ({ ...prev, maxLotSize: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div>
                  <Label>Lot Step</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.lotStep || 0.01}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lotStep: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Spread (pips)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editForm.defaultSpread || 1.5}
                    onChange={(e) => setEditForm(prev => ({ ...prev, defaultSpread: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div>
                  <Label>Commission/Lot ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.commission || 0}
                    onChange={(e) => setEditForm(prev => ({ ...prev, commission: parseFloat(e.target.value) }))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editForm.popular || false}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, popular: checked }))}
                  />
                  <Label>Mark as Popular</Label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSymbol(null)}>
              Cancel
            </Button>
            <Button onClick={updateSymbol} disabled={isSaving}>
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Symbol Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Custom Symbol
            </DialogTitle>
            <DialogDescription>
              Add a new trading symbol (e.g., cryptocurrency, commodities)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Symbol *</Label>
              <Input
                placeholder="e.g., BTC/USD"
                value={newSymbol.symbol}
                onChange={(e) => setNewSymbol(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div>
              <Label>Name *</Label>
              <Input
                placeholder="e.g., Bitcoin vs US Dollar"
                value={newSymbol.name}
                onChange={(e) => setNewSymbol(prev => ({ ...prev, name: e.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div>
              <Label>Pip Value</Label>
              <Input
                type="number"
                step="0.0001"
                value={newSymbol.pip}
                onChange={(e) => setNewSymbol(prev => ({ ...prev, pip: parseFloat(e.target.value) }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSymbol} disabled={isSaving}>
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Symbol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

