'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Package,
  Users,
  Save,
  Code,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StrategyBuilder from './StrategyBuilder';
import { Lightbulb, Target } from 'lucide-react';

interface StrategyConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: any[];
  defaultIndicators: string[];
  signalDisplay: {
    showOnChart: boolean;
    showArrows: boolean;
    showLabels: boolean;
    arrowSize: 'small' | 'medium' | 'large';
  };
}

interface MarketplaceItem {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  category: 'indicator' | 'strategy';
  price: number;
  originalPrice?: number;
  isFree: boolean;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  version: string;
  indicatorType?: string;
  strategyConfig?: StrategyConfig;
  codeTemplate: string;
  defaultSettings: Record<string, any>;
  supportedAssets: string[];
  totalPurchases: number;
  actualPurchases?: number;
  tags: string[];
  riskLevel: string;
  riskWarning?: string;
  createdAt: string;
}

interface Stats {
  totalItems: number;
  totalIndicators: number;
  totalStrategies: number;
  totalPurchases: number;
}

const CATEGORIES = [
  { value: 'indicator', label: 'Indicator', icon: TrendingUp },
  { value: 'strategy', label: 'Strategy', icon: Target },
];

const RISK_LEVELS = ['low', 'medium', 'high'];

// Indicator types that have chart implementations
const INDICATOR_TYPES = [
  { value: 'sma', label: 'Simple Moving Average (SMA)', displayType: 'overlay' },
  { value: 'ema', label: 'Exponential Moving Average (EMA)', displayType: 'overlay' },
  { value: 'bb', label: 'Bollinger Bands', displayType: 'overlay' },
  { value: 'support_resistance', label: 'Support & Resistance', displayType: 'overlay' },
  { value: 'rsi', label: 'RSI (Relative Strength Index)', displayType: 'oscillator' },
  { value: 'macd', label: 'MACD', displayType: 'oscillator' },
];

const emptyItem: Partial<MarketplaceItem> = {
  name: '',
  shortDescription: '',
  fullDescription: '',
  category: 'indicator',
  price: 0,
  status: 'active',
  isPublished: false,
  isFeatured: false,
  version: '1.0.0',
  codeTemplate: '{}',
  defaultSettings: {},
  strategyConfig: {
    rules: [],
    defaultIndicators: [],
    signalDisplay: {
      showOnChart: true,
      showArrows: true,
      showLabels: true,
      arrowSize: 'medium',
    },
  },
  supportedAssets: [],
  tags: [],
  riskLevel: 'medium',
  riskWarning: '',
};

export default function MarketplaceSection() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MarketplaceItem>>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  useEffect(() => {
    fetchItems();
  }, []);
  
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/marketplace');
      const data = await response.json();
      
      if (data.success) {
        setItems(data.items);
        setStats(data.stats);
      } else {
        toast.error(data.error || 'Failed to load items');
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load marketplace items');
    } finally {
      setLoading(false);
    }
  };
  
  const seedItems = async () => {
    try {
      const response = await fetch('/api/admin/marketplace?action=seed');
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Created ${data.created} items, updated ${data.updated}`);
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to seed items');
      }
    } catch (error) {
      toast.error('Failed to seed marketplace');
    }
  };
  
  const handleCreate = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Item created successfully');
        setIsCreateOpen(false);
        setEditingItem(emptyItem);
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to create item');
      }
    } catch (error) {
      toast.error('Failed to create item');
    } finally {
      setSaving(false);
    }
  };
  
  const handleUpdate = async () => {
    if (!editingItem._id) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/admin/marketplace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: editingItem._id, ...editingItem }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Item updated successfully');
        setIsEditOpen(false);
        setEditingItem(emptyItem);
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to update item');
      }
    } catch (error) {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (item: MarketplaceItem) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    
    try {
      const response = await fetch(`/api/admin/marketplace?itemId=${item._id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Item deleted');
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to delete item');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };
  
  const handleTogglePublish = async (item: MarketplaceItem) => {
    try {
      const response = await fetch('/api/admin/marketplace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId: item._id, 
          isPublished: !item.isPublished 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(item.isPublished ? 'Item unpublished' : 'Item published');
        fetchItems();
      }
    } catch (error) {
      toast.error('Failed to update item');
    }
  };
  
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.shortDescription.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  const getCategoryIcon = (category: string) => {
    const found = CATEGORIES.find(c => c.value === category);
    return found ? found.icon : Package;
  };
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-cyan-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalItems || 0}</div>
                <div className="text-sm text-gray-400">Total Items</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalIndicators || 0}</div>
                <div className="text-sm text-gray-400">Indicators</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-orange-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalStrategies || 0}</div>
                <div className="text-sm text-gray-400">Strategies</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalPurchases || 0}</div>
                <div className="text-sm text-gray-400">Total Purchases</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Actions Bar */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={fetchItems}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <Button variant="outline" onClick={seedItems}>
              <Package className="h-4 w-4 mr-2" />
              Seed Defaults
            </Button>
            
            <Button onClick={() => { setEditingItem(emptyItem); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Item
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Items Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Marketplace Items ({filteredItems.length})</CardTitle>
          <CardDescription>Manage trading bots, indicators, and tools</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              No items found. Create your first item or seed defaults.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-gray-400 font-medium">Item</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Category</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Price</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Purchases</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Status</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const CategoryIcon = getCategoryIcon(item.category);
                    return (
                      <tr key={item._id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-800 rounded-lg">
                              <CategoryIcon className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                              <div className="font-medium text-white flex items-center gap-2">
                                {item.name}
                                {item.isFeatured && (
                                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                )}
                              </div>
                              <div className="text-sm text-gray-400 line-clamp-1">
                                {item.shortDescription}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-300">
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3">
                          {item.isFree ? (
                            <span className="text-green-400 font-medium">FREE</span>
                          ) : (
                            <span className="text-white">⚡ {item.price.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="text-gray-300">{item.actualPurchases || item.totalPurchases}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'px-2 py-1 rounded text-xs font-medium',
                              item.isPublished 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-gray-700 text-gray-400'
                            )}>
                              {item.isPublished ? 'Published' : 'Draft'}
                            </span>
                            <span className={cn(
                              'px-2 py-1 rounded text-xs',
                              item.status === 'active' && 'bg-blue-500/20 text-blue-400',
                              item.status === 'inactive' && 'bg-gray-700 text-gray-400',
                              item.status === 'coming_soon' && 'bg-yellow-500/20 text-yellow-400',
                              item.status === 'deprecated' && 'bg-red-500/20 text-red-400',
                            )}>
                              {item.status}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePublish(item)}
                              title={item.isPublished ? 'Unpublish' : 'Publish'}
                            >
                              {item.isPublished ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setEditingItem(emptyItem);
        }
      }}>
        <DialogContent className="!fixed !inset-0 !w-screen !h-screen !max-w-none !max-h-none !translate-x-0 !translate-y-0 !top-0 !left-0 !m-0 !p-0 !rounded-none bg-gray-900 !border-0 overflow-hidden">
          <div className="h-screen flex flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-8 py-4 border-b border-gray-700 bg-gray-900">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  {isCreateOpen ? 'Create New Marketplace Item' : 'Edit Item'}
                </DialogTitle>
              </DialogHeader>
            </div>
          
            {/* Scrollable Content - min-h-0 is crucial for flex scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              {editingItem.category === 'strategy' && (
                <TabsTrigger value="strategy">Strategy Builder</TabsTrigger>
              )}
              <TabsTrigger value="code">
                {editingItem.category === 'strategy' ? 'Settings' : 'Code & Settings'}
              </TabsTrigger>
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={editingItem.name || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="My Indicator"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={editingItem.category || 'trading_bot'}
                    onValueChange={(v) => setEditingItem({ ...editingItem, category: v as 'indicator' | 'strategy' })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Short Description * (max 200 chars)</Label>
                <Input
                  value={editingItem.shortDescription || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, shortDescription: e.target.value })}
                  maxLength={200}
                  placeholder="Brief description for cards"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Full Description * (Markdown supported)</Label>
                <Textarea
                  value={editingItem.fullDescription || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, fullDescription: e.target.value })}
                  placeholder="# My Indicator\n\n## How it works\n..."
                  rows={10}
                  className="bg-gray-800 border-gray-700 font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tags (comma separated)</Label>
                <Input
                  value={(editingItem.tags || []).join(', ')}
                  onChange={(e) => setEditingItem({ 
                    ...editingItem, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                  })}
                  placeholder="trend, automated, beginner"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </TabsContent>
            
            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4 pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (credits)</Label>
                  <Input
                    type="number"
                    value={editingItem.price || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="bg-gray-800 border-gray-700"
                  />
                  <p className="text-xs text-gray-500">Set to 0 for free items</p>
                </div>
                <div className="space-y-2">
                  <Label>Original Price (for discounts)</Label>
                  <Input
                    type="number"
                    value={editingItem.originalPrice || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, originalPrice: parseInt(e.target.value) || undefined })}
                    min={0}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingItem.isFeatured || false}
                    onCheckedChange={(v) => setEditingItem({ ...editingItem, isFeatured: v })}
                  />
                  <Label>Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingItem.isPublished || false}
                    onCheckedChange={(v) => setEditingItem({ ...editingItem, isPublished: v })}
                  />
                  <Label>Published</Label>
                </div>
              </div>
            </TabsContent>
            
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={editingItem.version || '1.0.0'}
                    onChange={(e) => setEditingItem({ ...editingItem, version: e.target.value })}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingItem.status || 'active'}
                    onValueChange={(v) => setEditingItem({ ...editingItem, status: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="coming_soon">Coming Soon</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select
                    value={editingItem.riskLevel || 'medium'}
                    onValueChange={(v) => setEditingItem({ ...editingItem, riskLevel: v })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>
                          {level.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {editingItem.category === 'indicator' && (
                  <div className="space-y-2">
                    <Label>Indicator Type (Chart Implementation)</Label>
                    <Select
                      value={editingItem.indicatorType || ''}
                      onValueChange={(v) => {
                        const selected = INDICATOR_TYPES.find(t => t.value === v);
                        setEditingItem({ 
                          ...editingItem, 
                          indicatorType: v,
                          // Auto-set code template based on type
                          codeTemplate: JSON.stringify({
                            type: v,
                            displayType: selected?.displayType || 'overlay',
                            description: `${selected?.label || v} indicator`,
                          }, null, 2)
                        });
                      }}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue placeholder="Select indicator type" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDICATOR_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label} ({type.displayType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Only types with chart implementations are available
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Risk Warning</Label>
                <Textarea
                  value={editingItem.riskWarning || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, riskWarning: e.target.value })}
                  placeholder="Important risk information for users..."
                  rows={3}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </TabsContent>
            
            {/* Strategy Builder Tab */}
            {editingItem.category === 'strategy' && (
              <TabsContent value="strategy" className="space-y-4 pb-20">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                  <h4 className="text-purple-400 font-medium flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4" />
                    Strategy Builder
                  </h4>
                  <p className="text-sm text-gray-300">
                    Create trading rules by combining indicators. When all conditions in a rule are met,
                    a buy/sell signal will appear on the chart.
                  </p>
                </div>
                
                <StrategyBuilder
                  initialConfig={editingItem.strategyConfig}
                  onChange={(config) => setEditingItem({ ...editingItem, strategyConfig: config })}
                />
              </TabsContent>
            )}
            
            {/* Code Tab */}
            <TabsContent value="code" className="space-y-4 pb-20">
              {/* Important Info Banner - different for strategies */}
              {editingItem.category === 'strategy' ? (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h4 className="text-purple-400 font-medium flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4" />
                    Strategy Settings
                  </h4>
                  <p className="text-sm text-gray-300">
                    Configure default settings for this strategy. The strategy rules are defined in the Strategy Builder tab.
                  </p>
                </div>
              ) : (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h4 className="text-cyan-400 font-medium flex items-center gap-2 mb-2">
                    <Code className="h-4 w-4" />
                    Indicator Configuration
                  </h4>
                  <p className="text-sm text-gray-300 mb-2">
                    Configure the indicator type and default settings that users will see.
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>Select an <strong>Indicator Type</strong> in the Details tab</li>
                    <li>Configure <strong>Default Settings</strong> below (period, colors, etc.)</li>
                    <li>The <strong>Code Template</strong> documents what the indicator does</li>
                  </ul>
                </div>
              )}
              
              {editingItem.category !== 'strategy' && (
                <div className="space-y-2">
                  <Label>Code Template (JSON)</Label>
                <Textarea
                  value={typeof editingItem.codeTemplate === 'string' 
                    ? editingItem.codeTemplate 
                    : JSON.stringify(editingItem.codeTemplate || {}, null, 2)}
                  onChange={(e) => setEditingItem({ ...editingItem, codeTemplate: e.target.value })}
                  placeholder='{"type": "sma", "displayType": "overlay", ...}'
                  rows={6}
                  className="bg-gray-800 border-gray-700 font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Documentation describing the indicator type and outputs
                </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Default Settings (JSON)</Label>
                <Textarea
                  value={JSON.stringify(editingItem.defaultSettings || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const settings = JSON.parse(e.target.value);
                      setEditingItem({ ...editingItem, defaultSettings: settings });
                    } catch {
                      // Invalid JSON, keep as is
                    }
                  }}
                  placeholder='{"period": 20, "color": "#3b82f6", ...}'
                  rows={10}
                  className="bg-gray-800 border-gray-700 font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Default configuration users will see when they purchase. Users can customize these.
                </p>
              </div>
              
              {/* Settings reference for indicators */}
              {editingItem.category !== 'strategy' && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 space-y-3">
                <h5 className="text-sm font-medium text-gray-300">Settings Reference:</h5>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">All Indicators:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>color</code>: Line color (hex)</div>
                    <div><code>lineWidth</code>: Thickness (1-5)</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">SMA / EMA:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>period</code>: e.g., 20</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">Bollinger Bands:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>period</code>: e.g., 20</div>
                    <div><code>stdDev</code>: e.g., 2</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">RSI:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>period</code>: e.g., 14</div>
                    <div><code>overbought</code>: e.g., 70</div>
                    <div><code>oversold</code>: e.g., 30</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">MACD:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>fastPeriod</code>: e.g., 12</div>
                    <div><code>slowPeriod</code>: e.g., 26</div>
                    <div><code>signalPeriod</code>: e.g., 9</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="font-medium text-gray-300">Support/Resistance:</div>
                  <div className="grid grid-cols-2 gap-1 pl-2">
                    <div><code>period</code>: e.g., 20</div>
                    <div><code>strength</code>: e.g., 2</div>
                  </div>
                </div>
              </div>
              )}
            </TabsContent>
              </Tabs>
            </div>
          
            {/* Fixed Footer */}
            <div className="flex-shrink-0 px-8 py-4 border-t border-gray-700 bg-gray-900">
              <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              setEditingItem(emptyItem);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={isCreateOpen ? handleCreate : handleUpdate}
              disabled={saving || !editingItem.name || !editingItem.shortDescription}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isCreateOpen ? 'Create Item' : 'Save Changes'}
            </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

