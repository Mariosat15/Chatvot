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
  Palette,
  Image as ImageIcon,
  User,
  Crown,
  Calendar,
  Percent,
  Trophy,
  UserPlus,
  Zap,
  Target,
  Gauge,
  BarChart3,
  LineChart,
  Activity,
  TrendingDown,
  Flame,
  Shield,
  Rocket,
  Gem,
  Sparkles,
  Coins,
  Wallet,
  PiggyBank,
  Banknote,
  CircleDollarSign,
  BadgePercent,
  Swords,
  Crosshair,
  Focus,
  Layers,
  Grid3X3,
  Waves,
  Mountain,
  Sun,
  Moon,
  X,
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
import { Lightbulb } from 'lucide-react';

// Available icons for icon picker
const AVAILABLE_ICONS = [
  { name: 'TrendingUp', icon: TrendingUp, category: 'trading' },
  { name: 'TrendingDown', icon: TrendingDown, category: 'trading' },
  { name: 'BarChart3', icon: BarChart3, category: 'trading' },
  { name: 'LineChart', icon: LineChart, category: 'trading' },
  { name: 'Activity', icon: Activity, category: 'trading' },
  { name: 'Target', icon: Target, category: 'trading' },
  { name: 'Crosshair', icon: Crosshair, category: 'trading' },
  { name: 'Focus', icon: Focus, category: 'trading' },
  { name: 'Gauge', icon: Gauge, category: 'trading' },
  { name: 'Waves', icon: Waves, category: 'trading' },
  { name: 'Mountain', icon: Mountain, category: 'trading' },
  { name: 'Layers', icon: Layers, category: 'trading' },
  { name: 'Grid3X3', icon: Grid3X3, category: 'trading' },
  { name: 'Zap', icon: Zap, category: 'action' },
  { name: 'Flame', icon: Flame, category: 'action' },
  { name: 'Rocket', icon: Rocket, category: 'action' },
  { name: 'Sparkles', icon: Sparkles, category: 'action' },
  { name: 'Star', icon: Star, category: 'action' },
  { name: 'Crown', icon: Crown, category: 'premium' },
  { name: 'Gem', icon: Gem, category: 'premium' },
  { name: 'Trophy', icon: Trophy, category: 'premium' },
  { name: 'Shield', icon: Shield, category: 'premium' },
  { name: 'Swords', icon: Swords, category: 'premium' },
  { name: 'Coins', icon: Coins, category: 'money' },
  { name: 'Wallet', icon: Wallet, category: 'money' },
  { name: 'PiggyBank', icon: PiggyBank, category: 'money' },
  { name: 'Banknote', icon: Banknote, category: 'money' },
  { name: 'CircleDollarSign', icon: CircleDollarSign, category: 'money' },
  { name: 'BadgePercent', icon: BadgePercent, category: 'money' },
  { name: 'Sun', icon: Sun, category: 'misc' },
  { name: 'Moon', icon: Moon, category: 'misc' },
  { name: 'Package', icon: Package, category: 'misc' },
  { name: 'Code', icon: Code, category: 'misc' },
  { name: 'Palette', icon: Palette, category: 'misc' },
  { name: 'Users', icon: Users, category: 'misc' },
] as const;

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

interface GameMasterConfig {
  subscriptionDurationDays: number;
  referralFeePercentage: number;
  maxCompetitionsPerDay: number;
  maxUsersPerCompetition: number;
  canCreateCompetitions: boolean;
  canEarnFromChallenges: boolean;
  challengeReferralFeePercentage?: number;
}

interface MarketplaceItem {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  category: 'indicator' | 'strategy' | 'cosmetic' | 'gamemaster';
  price: number;
  originalPrice?: number;
  isFree: boolean;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  version: string;
  indicatorType?: string;
  strategyConfig?: StrategyConfig;
  gameMasterConfig?: GameMasterConfig;
  cosmeticType?: string;
  imageUrl?: string;
  iconName?: string; // Selected icon name for non-cosmetic items
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
  totalCosmetics: number;
  totalGameMaster: number;
  totalPurchases: number;
}

const CATEGORIES = [
  { value: 'indicator', label: 'Indicator', icon: TrendingUp },
  { value: 'strategy', label: 'Strategy', icon: Target },
  { value: 'cosmetic', label: 'Cosmetic', icon: Palette },
  { value: 'gamemaster', label: 'Game Master', icon: Crown },
];

const COSMETIC_TYPES = [
  { value: 'avatar', label: 'Avatar' },
  { value: 'profile_frame', label: 'Profile Frame' },
  { value: 'badge', label: 'Badge' },
  { value: 'title', label: 'Title' },
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
  imageUrl: '',
  iconName: 'TrendingUp', // Default icon
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
  gameMasterConfig: {
    subscriptionDurationDays: 30,
    referralFeePercentage: 5,
    maxCompetitionsPerDay: 1,
    maxUsersPerCompetition: 50,
    canCreateCompetitions: true,
    canEarnFromChallenges: false,
    challengeReferralFeePercentage: undefined,
  },
  cosmeticType: 'avatar',
  imageUrl: '',
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  
  useEffect(() => {
    fetchItems();
  }, []);
  
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/marketplace');
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
      const response = await fetch('/api/marketplace?action=seed');
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

  // Handle image upload for any marketplace item
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slug', editingItem.slug || 'item');
      formData.append('cosmeticType', editingItem.cosmeticType || 'avatar');

      console.log('[Marketplace Upload] Starting upload for:', file.name, file.size);
      
      const response = await fetch('/api/marketplace/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('[Marketplace Upload] Response status:', response.status);
      
      const data = await response.json();
      console.log('[Marketplace Upload] Response data:', data);

      if (response.ok && data.success) {
        setEditingItem(prev => ({ ...prev, imageUrl: data.url }));
        toast.success('Image uploaded successfully');
      } else {
        console.error('[Marketplace Upload] Error:', data);
        toast.error(data.error || `Upload failed (${response.status})`);
      }
    } catch (error) {
      console.error('[Marketplace Upload] Exception:', error);
      toast.error('Network error: ' + (error instanceof Error ? error.message : 'Failed to upload'));
    } finally {
      setUploadingImage(false);
    }
  };

  // Generate title and description from image using AI
  const handleGenerateWithAI = async () => {
    if (!editingItem.imageUrl) {
      toast.error('Please upload an image first');
      return;
    }

    setGeneratingAI(true);
    
    try {
      console.log('[AI Generate] Starting generation for:', editingItem.imageUrl);
      
      const response = await fetch('/api/marketplace/generate-cosmetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: editingItem.imageUrl,
          cosmeticType: editingItem.cosmeticType || 'avatar'
        }),
      });

      const data = await response.json();
      console.log('[AI Generate] Response:', data);

      if (response.ok && data.success) {
        setEditingItem(prev => ({
          ...prev,
          name: data.generated.name || prev.name,
          shortDescription: data.generated.shortDescription || prev.shortDescription,
          fullDescription: data.generated.fullDescription || prev.fullDescription,
          // Auto-generate slug from name
          slug: (data.generated.name || prev.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        }));
        toast.success('AI generated title and description!');
        // Switch to basic tab to show the generated content
        setActiveTab('basic');
      } else {
        toast.error(data.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('[AI Generate] Exception:', error);
      toast.error('Failed to generate: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setGeneratingAI(false);
    }
  };
  
  const handleCreate = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/marketplace', {
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
      const response = await fetch('/api/marketplace', {
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
      const response = await fetch(`/api/marketplace?itemId=${item._id}`, {
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
      const response = await fetch('/api/marketplace', {
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
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <Palette className="h-8 w-8 text-pink-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalCosmetics || 0}</div>
                <div className="text-sm text-gray-400">Cosmetics</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-yellow-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalGameMaster || 0}</div>
                <div className="text-sm text-gray-400">Game Master</div>
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
                <div className="text-sm text-gray-400">Purchases</div>
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
                            {/* Show image for cosmetics, icon for others */}
                            {item.category === 'cosmetic' && item.imageUrl ? (
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700 flex-shrink-0">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Palette className="h-5 w-5 text-pink-400 opacity-50" />
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 bg-gray-800 rounded-lg">
                                <CategoryIcon className="h-5 w-5 text-cyan-400" />
                              </div>
                            )}
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
              {editingItem.category === 'gamemaster' && (
                <TabsTrigger value="gamemaster">Game Master Settings</TabsTrigger>
              )}
              {editingItem.category !== 'cosmetic' && editingItem.category !== 'gamemaster' && (
                <TabsTrigger value="code">
                  {editingItem.category === 'strategy' ? 'Settings' : 'Code & Settings'}
                </TabsTrigger>
              )}
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
                
                {editingItem.category === 'cosmetic' && (
                  <div className="space-y-2">
                    <Label>Cosmetic Type</Label>
                    <Select
                      value={editingItem.cosmeticType || 'avatar'}
                      onValueChange={(v) => setEditingItem({ ...editingItem, cosmeticType: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue placeholder="Select cosmetic type" />
                      </SelectTrigger>
                      <SelectContent>
                        {COSMETIC_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              {/* Image Upload - Available for ALL categories */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-cyan-400" />
                    Item Image {editingItem.category === 'cosmetic' ? '*' : '(Optional)'}
                  </Label>
                  
                  {/* File Upload */}
                  <div className="flex flex-col gap-3">
                    <input
                      type="file"
                      id="item-image-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }}
                      disabled={uploadingImage}
                    />
                    <label 
                      htmlFor="item-image-upload"
                      className={cn(
                        "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                        uploadingImage 
                          ? "border-gray-600 bg-gray-800/50 cursor-not-allowed" 
                          : "border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500"
                      )}
                    >
                      {uploadingImage ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
                          <span className="text-cyan-400">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-5 w-5 text-cyan-400" />
                          <span className="text-cyan-400">Click to upload image</span>
                        </>
                      )}
                    </label>
                    
                    <p className="text-xs text-gray-500">
                      {editingItem.category === 'cosmetic' 
                        ? 'Recommended: 200x200px square image for avatars' 
                        : 'Optional: Upload a custom image for this item'}
                      {' '}(PNG, JPEG, max 5MB)
                    </p>
                  </div>
                </div>
                
                {/* Preview */}
                {editingItem.imageUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                      <div className="relative w-24 h-24 rounded-xl border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20 overflow-hidden bg-gray-900 flex items-center justify-center">
                        <img
                          src={editingItem.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <ImageIcon className="w-10 h-10 text-gray-600 absolute" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-400">Image Preview</p>
                        <p className="text-white font-medium text-lg">{editingItem.name || 'Untitled'}</p>
                        <p className="text-xs text-gray-500 mt-1 font-mono truncate max-w-[200px]">
                          {editingItem.imageUrl}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(prev => ({ ...prev, imageUrl: '' }))}
                          className="text-red-400 hover:text-red-300 mt-1 h-6 px-2"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Remove Image
                        </Button>
                      </div>
                    </div>
                    
                    {/* AI Generate Button - Only for cosmetics */}
                    {editingItem.category === 'cosmetic' && (
                      <>
                        <Button
                          type="button"
                          onClick={handleGenerateWithAI}
                          disabled={generatingAI || !editingItem.imageUrl}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium"
                        >
                          {generatingAI ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              AI Generating Title & Bio...
                            </>
                          ) : (
                            <>
                              <Star className="h-4 w-4 mr-2" />
                              ✨ Generate Title & Bio with AI
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          AI will analyze the image and create a unique name, tagline, and backstory
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Icon Picker - For non-cosmetic items */}
              {editingItem.category !== 'cosmetic' && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Item Icon
                  </Label>
                  <p className="text-xs text-gray-500">
                    Select an icon to represent this item in the marketplace
                  </p>
                  <div className="grid grid-cols-9 gap-2 p-4 bg-gray-800/50 border border-gray-700 rounded-xl max-h-48 overflow-y-auto">
                    {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setEditingItem(prev => ({ ...prev, iconName: name }))}
                        className={cn(
                          "p-2 rounded-lg transition-all flex items-center justify-center",
                          editingItem.iconName === name
                            ? "bg-cyan-500/30 border-2 border-cyan-500 text-cyan-400"
                            : "bg-gray-700/50 border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white"
                        )}
                        title={name}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                  {editingItem.iconName && (
                    <p className="text-xs text-cyan-400">
                      Selected: {editingItem.iconName}
                    </p>
                  )}
                </div>
              )}
              
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
            
            {/* Game Master Settings Tab */}
            {editingItem.category === 'gamemaster' && (
              <TabsContent value="gamemaster" className="space-y-6 pb-20">
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6">
                  <h4 className="text-yellow-400 font-bold text-lg flex items-center gap-2 mb-2">
                    <Crown className="h-5 w-5" />
                    Game Master Package Configuration
                  </h4>
                  <p className="text-sm text-gray-300">
                    Configure the subscription settings for this Game Master package. Users who purchase this package
                    will be able to create competitions and earn referral fees based on these settings.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Subscription Duration */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <Label className="text-white font-semibold">Subscription Duration</Label>
                    </div>
                    <Input
                      type="number"
                      value={editingItem.gameMasterConfig?.subscriptionDurationDays || 30}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        gameMasterConfig: {
                          ...editingItem.gameMasterConfig!,
                          subscriptionDurationDays: parseInt(e.target.value) || 30
                        }
                      })}
                      min={1}
                      max={365}
                      className="bg-gray-800 border-gray-600 text-white text-lg h-12"
                    />
                    <p className="text-xs text-gray-500">
                      Number of days the subscription is active (e.g., 30 for monthly)
                    </p>
                  </div>
                  
                  {/* Referral Fee Percentage */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="h-5 w-5 text-green-400" />
                      <Label className="text-white font-semibold">Referral Fee Percentage</Label>
                    </div>
                    <Input
                      type="number"
                      value={editingItem.gameMasterConfig?.referralFeePercentage || 5}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        gameMasterConfig: {
                          ...editingItem.gameMasterConfig!,
                          referralFeePercentage: parseFloat(e.target.value) || 5
                        }
                      })}
                      min={0}
                      max={50}
                      step={0.5}
                      className="bg-gray-800 border-gray-600 text-white text-lg h-12"
                    />
                    <p className="text-xs text-gray-500">
                      % of entry fees the Game Master earns from their referrals (e.g., 5%, 7.5%, 10%)
                    </p>
                    {(editingItem.gameMasterConfig?.referralFeePercentage || 5) >= 10 && (
                      <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400 flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span>
                            <strong>Warning:</strong> Referral fee must be LOWER than competition platform fees.
                            This fee is subtracted from the platform's share. If total GM fees exceed the platform fee
                            for a competition, GM earnings will be capped.
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Can Create Competitions Toggle */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-purple-400" />
                        <div>
                          <Label className="text-white font-semibold">Allow Competition Creation</Label>
                          <p className="text-xs text-gray-500 mt-1">
                            When OFF, Game Masters can only earn from admin-created competitions (referral earnings only)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingItem({
                          ...editingItem,
                          gameMasterConfig: {
                            ...editingItem.gameMasterConfig!,
                            canCreateCompetitions: !editingItem.gameMasterConfig?.canCreateCompetitions
                          }
                        })}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                          editingItem.gameMasterConfig?.canCreateCompetitions !== false 
                            ? 'bg-green-500' 
                            : 'bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                          editingItem.gameMasterConfig?.canCreateCompetitions !== false 
                            ? 'translate-x-8' 
                            : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {editingItem.gameMasterConfig?.canCreateCompetitions === false && (
                      <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-xs text-purple-400 flex items-center gap-2">
                          <span className="text-lg">💰</span>
                          <span>
                            <strong>Referral-Only Mode:</strong> Game Masters with this package will earn from their referrals 
                            in ANY competition (admin or other GM competitions), but cannot create their own.
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Max Competitions Per Day - Only show if canCreateCompetitions is enabled */}
                  {editingItem.gameMasterConfig?.canCreateCompetitions !== false && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-5 w-5 text-yellow-400" />
                        <Label className="text-white font-semibold">Max Competitions Per Day</Label>
                      </div>
                      <Input
                        type="number"
                        value={editingItem.gameMasterConfig?.maxCompetitionsPerDay || 1}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          gameMasterConfig: {
                            ...editingItem.gameMasterConfig!,
                            maxCompetitionsPerDay: parseInt(e.target.value) || 1
                          }
                        })}
                        min={1}
                        max={100}
                        className="bg-gray-800 border-gray-600 text-white text-lg h-12"
                      />
                      <p className="text-xs text-gray-500">
                        How many competitions this Game Master can create per day
                      </p>
                    </div>
                  )}
                  
                  {/* Max Users Per Competition */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="h-5 w-5 text-cyan-400" />
                      <Label className="text-white font-semibold">Max Users Per Competition</Label>
                    </div>
                    <Input
                      type="number"
                      value={editingItem.gameMasterConfig?.maxUsersPerCompetition || 50}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        gameMasterConfig: {
                          ...editingItem.gameMasterConfig!,
                          maxUsersPerCompetition: parseInt(e.target.value) || 50
                        }
                      })}
                      min={2}
                      max={1000}
                      className="bg-gray-800 border-gray-600 text-white text-lg h-12"
                    />
                    <p className="text-xs text-gray-500">
                      Maximum number of participants in competitions created by this Game Master
                    </p>
                  </div>
                </div>

                {/* Challenge Earnings Section */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <h4 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
                    ⚔️ Challenge (1v1) Earnings
                  </h4>
                  
                  {/* Enable Challenge Earnings Toggle */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white font-semibold">Earn from Challenges</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Allow GM to earn referral fees when their referred users participate in 1v1 challenges
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingItem({
                          ...editingItem,
                          gameMasterConfig: {
                            ...editingItem.gameMasterConfig!,
                            canEarnFromChallenges: !editingItem.gameMasterConfig?.canEarnFromChallenges
                          }
                        })}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                          editingItem.gameMasterConfig?.canEarnFromChallenges 
                            ? 'bg-orange-500' 
                            : 'bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                          editingItem.gameMasterConfig?.canEarnFromChallenges 
                            ? 'translate-x-8' 
                            : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Challenge Referral Fee % - Only show if canEarnFromChallenges is enabled */}
                  {editingItem.gameMasterConfig?.canEarnFromChallenges && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-5 w-5 text-orange-400" />
                        <Label className="text-white font-semibold">Challenge Referral Fee (%)</Label>
                      </div>
                      <Input
                        type="number"
                        value={editingItem.gameMasterConfig?.challengeReferralFeePercentage ?? editingItem.gameMasterConfig?.referralFeePercentage ?? 5}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          gameMasterConfig: {
                            ...editingItem.gameMasterConfig!,
                            challengeReferralFeePercentage: parseFloat(e.target.value) || undefined
                          }
                        })}
                        min={0}
                        max={50}
                        step={0.5}
                        className="bg-gray-800 border-gray-600 text-white text-lg h-12"
                      />
                      <p className="text-xs text-gray-500">
                        % of challenge entry fees from referred users. Leave empty to use the same % as competitions ({editingItem.gameMasterConfig?.referralFeePercentage || 5}%)
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingItem({
                          ...editingItem,
                          gameMasterConfig: {
                            ...editingItem.gameMasterConfig!,
                            challengeReferralFeePercentage: undefined
                          }
                        })}
                        className="text-xs text-orange-400 hover:text-orange-300 underline"
                      >
                        Reset to use competition fee ({editingItem.gameMasterConfig?.referralFeePercentage || 5}%)
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Summary Card */}
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
                  <h5 className="text-purple-400 font-bold mb-4 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Package Summary
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-400">
                        {editingItem.gameMasterConfig?.subscriptionDurationDays || 30}
                      </div>
                      <div className="text-xs text-gray-400">Days</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-400">
                        {editingItem.gameMasterConfig?.referralFeePercentage || 5}%
                      </div>
                      <div className="text-xs text-gray-400">Comp Fee</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className={`text-2xl font-bold ${editingItem.gameMasterConfig?.canCreateCompetitions !== false ? 'text-green-400' : 'text-red-400'}`}>
                        {editingItem.gameMasterConfig?.canCreateCompetitions !== false ? '✓' : '✗'}
                      </div>
                      <div className="text-xs text-gray-400">Create Comps</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className={`text-2xl font-bold ${editingItem.gameMasterConfig?.canEarnFromChallenges ? 'text-orange-400' : 'text-red-400'}`}>
                        {editingItem.gameMasterConfig?.canEarnFromChallenges ? '✓' : '✗'}
                      </div>
                      <div className="text-xs text-gray-400">Challenges</div>
                    </div>
                    {editingItem.gameMasterConfig?.canEarnFromChallenges && (
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-orange-400">
                          {editingItem.gameMasterConfig?.challengeReferralFeePercentage ?? editingItem.gameMasterConfig?.referralFeePercentage ?? 5}%
                        </div>
                        <div className="text-xs text-gray-400">Challenge Fee</div>
                      </div>
                    )}
                    {editingItem.gameMasterConfig?.canCreateCompetitions !== false && (
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-yellow-400">
                          {editingItem.gameMasterConfig?.maxCompetitionsPerDay || 1}
                        </div>
                        <div className="text-xs text-gray-400">Comps/Day</div>
                      </div>
                    )}
                  </div>
                  {editingItem.gameMasterConfig?.canCreateCompetitions === false && !editingItem.gameMasterConfig?.canEarnFromChallenges && (
                    <div className="mt-4 text-center text-sm text-purple-400">
                      💰 Referral-Only Package: GM earns from referrals in admin/other GM competitions
                    </div>
                  )}
                  {editingItem.gameMasterConfig?.canEarnFromChallenges && (
                    <div className="mt-4 text-center text-sm text-orange-400">
                      ⚔️ Also earns from 1v1 challenges where referrals participate
                    </div>
                  )}
                </div>
                
                {/* Tips */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h5 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Pricing Tips
                  </h5>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <strong>Starter:</strong> 30 days, 5% fee, 1 comp/day, 30 max users → ~299 credits</li>
                    <li>• <strong>Pro:</strong> 30 days, 7.5% fee, 3 comps/day, 75 max users → ~599 credits</li>
                    <li>• <strong>Elite:</strong> 30 days, 10% fee, 10 comps/day, 150 max users → ~999 credits</li>
                  </ul>
                </div>
              </TabsContent>
            )}
            
            {/* Code Tab - Not for cosmetics */}
            {editingItem.category !== 'cosmetic' && (
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
            )}
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

