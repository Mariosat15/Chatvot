'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Star, 
  ShoppingCart, 
  Check, 
  Search,
  Sparkles,
  Shield,
  Users,
  BadgeCheck,
  Gift,
  Target,
  LineChart,
  Activity,
  BarChart3,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarketplaceItem {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  price: number;
  originalPrice?: number;
  isFree: boolean;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  iconUrl?: string;
  thumbnailUrl?: string;
  version: string;
  indicatorType?: string;
  strategyConfig?: Record<string, unknown>;
  totalPurchases: number;
  averageRating: number;
  totalRatings: number;
  tags: string[];
  riskLevel: string;
  riskWarning?: string;
  owned: boolean;
}

type Category = 'all' | 'indicator' | 'strategy';

const CATEGORIES: { value: Category; label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgGradient: string }[] = [
  { value: 'all', label: 'All Items', icon: Sparkles, color: 'text-white', bgGradient: 'from-gray-600/20 to-gray-800/20' },
  { value: 'indicator', label: 'Indicators', icon: LineChart, color: 'text-emerald-400', bgGradient: 'from-emerald-500/20 to-teal-500/20' },
  { value: 'strategy', label: 'Strategies', icon: Target, color: 'text-orange-400', bgGradient: 'from-orange-500/20 to-amber-500/20' },
];

const INDICATOR_TYPE_INFO: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  sma: { icon: TrendingUp, color: 'text-blue-400', label: 'Moving Average' },
  ema: { icon: Activity, color: 'text-cyan-400', label: 'EMA' },
  bb: { icon: Layers, color: 'text-purple-400', label: 'Volatility' },
  rsi: { icon: BarChart3, color: 'text-green-400', label: 'Momentum' },
  macd: { icon: Activity, color: 'text-pink-400', label: 'Momentum' },
  support_resistance: { icon: LineChart, color: 'text-yellow-400', label: 'Levels' },
};

const RISK_STYLES = {
  low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  very_high: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export default function MarketplaceContent() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (showFreeOnly) params.set('free', 'true');
      if (search) params.set('search', search);
      
      const response = await fetch(`/api/marketplace?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        // Filter out any trading_bot items
        const filteredItems = data.items.filter((item: MarketplaceItem) => 
          item.category === 'indicator' || item.category === 'strategy'
        );
        setItems(filteredItems);
      }
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [category, showFreeOnly, search]);
  
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);
  
  const handlePurchase = async (item: MarketplaceItem) => {
    if (item.owned) {
      router.push('/profile?tab=trading-arsenal');
      return;
    }
    
    try {
      setPurchasing(item._id);
      const response = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item._id }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully purchased ${item.name}!`);
        setItems(prev => prev.map(i => 
          i._id === item._id ? { ...i, owned: true } : i
        ));
        setSelectedItem(null);
      } else {
        toast.error(data.error || 'Failed to purchase');
      }
    } catch (error) {
      console.error('Error purchasing item:', error);
      toast.error('Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };
  
  const featuredItems = items.filter(i => i.isFeatured);
  const indicators = items.filter(i => i.category === 'indicator');
  const strategies = items.filter(i => i.category === 'strategy');
  
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero Section with Animated Background */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent blur-3xl animate-pulse" />
          <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-orange-500/20 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-orange-500/10 border border-white/10 mb-8">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium bg-gradient-to-r from-emerald-400 to-orange-400 text-transparent bg-clip-text">
                Trading Arsenal Marketplace
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
              Supercharge Your
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-orange-400 text-transparent bg-clip-text">
                Trading Strategy
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Professional indicators and automated strategies to give you the edge in competitions and challenges.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative flex items-center">
                  <Search className="absolute left-5 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search indicators, strategies..."
                    className="w-full pl-14 pr-32 py-4 bg-gray-900/90 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Category Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-12">
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium transition-all',
                    isActive
                      ? `bg-gradient-to-br ${cat.bgGradient} border border-white/10 text-white shadow-lg`
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? cat.color : '')} />
                  {cat.label}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setShowFreeOnly(!showFreeOnly)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all',
              showFreeOnly
                ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 text-green-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Gift className="h-5 w-5" />
            Free Only
          </button>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-orange-500 rounded-full blur-xl opacity-40 animate-pulse" />
              <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-emerald-400" />
            </div>
            <p className="mt-6 text-gray-400">Loading marketplace...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-32">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-800/50 mb-6">
              <LineChart className="h-10 w-10 text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No Items Found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Try adjusting your filters or search terms to discover amazing trading tools.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Featured Section */}
            {featuredItems.length > 0 && category === 'all' && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Featured</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredItems.map((item) => (
                    <ItemCard
                      key={item._id}
                      item={item}
                      onView={() => setSelectedItem(item)}
                      onPurchase={() => handlePurchase(item)}
                      purchasing={purchasing === item._id}
                      featured
                    />
                  ))}
                </div>
              </section>
            )}
            
            {/* Indicators Section */}
            {(category === 'all' || category === 'indicator') && indicators.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <LineChart className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Indicators</h2>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium">
                    {indicators.length}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {indicators.filter(i => category === 'indicator' || !i.isFeatured).map((item) => (
                    <ItemCard
                      key={item._id}
                      item={item}
                      onView={() => setSelectedItem(item)}
                      onPurchase={() => handlePurchase(item)}
                      purchasing={purchasing === item._id}
                    />
                  ))}
                </div>
              </section>
            )}
            
            {/* Strategies Section - Always show strategies section if there are any */}
            {(category === 'all' || category === 'strategy') && strategies.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Target className="h-5 w-5 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Strategies</h2>
                  <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-sm font-medium">
                    {strategies.length}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-orange-500/20 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {/* Show all strategies when viewing Strategies category, or non-featured when viewing All */}
                  {strategies
                    .filter(i => category === 'strategy' || !i.isFeatured)
                    .map((item) => (
                      <ItemCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                      />
                    ))}
                </div>
                {/* Show message if all strategies are featured and viewing 'all' */}
                {category === 'all' && strategies.every(s => s.isFeatured) && (
                  <p className="text-center text-gray-500 text-sm mt-4">
                    All strategies are featured above ☝️
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
      
      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onPurchase={() => handlePurchase(selectedItem)}
          purchasing={purchasing === selectedItem._id}
        />
      )}
    </div>
  );
}

// Item Card Component
function ItemCard({
  item,
  onView,
  onPurchase,
  purchasing,
  featured = false,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
  featured?: boolean;
}) {
  const _isIndicator = item.category === 'indicator';
  const isStrategy = item.category === 'strategy';
  const indicatorInfo = item.indicatorType ? INDICATOR_TYPE_INFO[item.indicatorType] : null;
  const riskStyle = RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] || RISK_STYLES.medium;
  
  const CategoryIcon = isStrategy ? Target : (indicatorInfo?.icon || LineChart);
  const iconColor = isStrategy ? 'text-orange-400' : (indicatorInfo?.color || 'text-emerald-400');
  const gradientBg = isStrategy 
    ? 'from-orange-500/10 to-amber-500/10' 
    : 'from-emerald-500/10 to-teal-500/10';
  
  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer',
        'bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm',
        'border border-gray-700/50 hover:border-gray-600/50',
        'hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1',
        featured && 'ring-2 ring-yellow-500/30',
        item.owned && 'ring-2 ring-emerald-500/30'
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r',
        isStrategy ? 'from-orange-500 to-amber-500' : 'from-emerald-500 to-teal-500'
      )} />
      
      {/* Badges */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {featured && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-full">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400">Featured</span>
          </div>
        )}
        {!featured && item.owned && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-full">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Owned</span>
          </div>
        )}
        {!featured && !item.owned && item.isFree && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full">
            <Gift className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-semibold text-green-400">Free</span>
          </div>
        )}
        
        {/* Risk Badge - Always on right */}
        <div className={cn(
          'px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ml-auto',
          riskStyle.bg, riskStyle.text, riskStyle.border
        )}>
          {item.riskLevel.replace('_', ' ')}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 pt-14">
        {/* Icon */}
        <div className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br',
          gradientBg
        )}>
          <CategoryIcon className={cn('h-7 w-7', iconColor)} />
        </div>
        
        {/* Category Tag */}
        <div className="flex items-center gap-2 mb-3">
          <span className={cn(
            'px-2.5 py-0.5 rounded-full text-xs font-medium',
            isStrategy ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
          )}>
            {isStrategy ? 'Strategy' : indicatorInfo?.label || 'Indicator'}
          </span>
          <span className="text-xs text-gray-500">v{item.version}</span>
        </div>
        
        {/* Name & Description */}
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors line-clamp-1">
          {item.name}
        </h3>
        <p className="text-sm text-gray-400 mb-5 line-clamp-2 min-h-[40px]">
          {item.shortDescription}
        </p>
        
        {/* Stats */}
        <div className="flex items-center gap-4 mb-5 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Users className="h-4 w-4" />
            <span>{item.totalPurchases}</span>
          </div>
          {item.averageRating > 0 && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span>{item.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-800/80 rounded-md text-xs text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-gray-700/50 mb-5" />
        
        {/* Price & Action */}
        <div className="flex items-center justify-between">
          <div>
            {item.isFree ? (
              <span className="text-xl font-bold text-green-400">FREE</span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white">⚡ {item.price.toLocaleString()}</span>
                {item.originalPrice && item.originalPrice > item.price && (
                  <span className="text-sm text-gray-500 line-through">{item.originalPrice.toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPurchase();
            }}
            disabled={purchasing}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all',
              item.owned
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20'
            )}
          >
            {purchasing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : item.owned ? (
              <>
                <Check className="h-4 w-4" />
                Owned
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Get
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Item Detail Modal
function ItemDetailModal({
  item,
  onClose,
  onPurchase,
  purchasing,
}: {
  item: MarketplaceItem;
  onClose: () => void;
  onPurchase: () => void;
  purchasing: boolean;
}) {
  const _isIndicator = item.category === 'indicator';
  const isStrategy = item.category === 'strategy';
  const indicatorInfo = item.indicatorType ? INDICATOR_TYPE_INFO[item.indicatorType] : null;
  const riskStyle = RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] || RISK_STYLES.medium;
  
  const CategoryIcon = isStrategy ? Target : (indicatorInfo?.icon || LineChart);
  const iconColor = isStrategy ? 'text-orange-400' : (indicatorInfo?.color || 'text-emerald-400');
  const gradientBg = isStrategy 
    ? 'from-orange-500/20 to-amber-500/20' 
    : 'from-emerald-500/20 to-teal-500/20';
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-gray-700/50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-8 border-b border-gray-800">
          <div className={cn(
            'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r',
            isStrategy ? 'from-orange-500 to-amber-500' : 'from-emerald-500 to-teal-500'
          )} />
          
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-start gap-5">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br flex-shrink-0',
              gradientBg
            )}>
              <CategoryIcon className={cn('h-8 w-8', iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium',
                  isStrategy ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
                )}>
                  {isStrategy ? 'Strategy' : 'Indicator'}
                </span>
                <span className="text-xs text-gray-500">v{item.version}</span>
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  riskStyle.bg, riskStyle.text
                )}>
                  {item.riskLevel.replace('_', ' ')} risk
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{item.name}</h2>
              <p className="text-gray-400">{item.shortDescription}</p>
            </div>
          </div>
        </div>
        
        {/* Content - Scrollable */}
        <div className="p-8 overflow-y-auto max-h-[50vh]">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
              <div className="text-3xl font-bold text-white mb-1">{item.totalPurchases}</div>
              <div className="text-sm text-gray-400">Users</div>
            </div>
            <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                <span className="text-3xl font-bold text-white">
                  {item.averageRating > 0 ? item.averageRating.toFixed(1) : '—'}
                </span>
              </div>
              <div className="text-sm text-gray-400">Rating</div>
            </div>
            <div className="bg-gray-800/30 rounded-2xl p-5 text-center border border-gray-700/30">
              <div className="text-3xl font-bold text-white mb-1">{item.totalRatings}</div>
              <div className="text-sm text-gray-400">Reviews</div>
            </div>
          </div>
          
          {/* Description */}
          <div className="prose prose-invert max-w-none mb-8">
            <div 
              className="text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: item.fullDescription
                  .replace(/^# (.*$)/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3 first:mt-0">$1</h2>')
                  .replace(/^## (.*$)/gm, '<h3 class="text-lg font-semibold text-white mt-5 mb-2">$1</h3>')
                  .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-300">$1</li>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
              }} 
            />
          </div>
          
          {/* Risk Warning */}
          {item.riskWarning && (
            <div className={cn(
              'rounded-2xl p-5 mb-8 border',
              riskStyle.bg, riskStyle.border
            )}>
              <div className="flex items-start gap-4">
                <Shield className={cn('h-6 w-6 flex-shrink-0', riskStyle.text)} />
                <div>
                  <h4 className={cn('font-semibold mb-1', riskStyle.text)}>Risk Warning</h4>
                  <p className="text-sm text-gray-300">{item.riskWarning}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-gray-800/50 rounded-xl text-sm text-gray-400 border border-gray-700/30"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-8 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <div>
            {item.isFree ? (
              <div className="text-3xl font-bold text-green-400">FREE</div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">⚡ {item.price.toLocaleString()}</span>
                <span className="text-gray-400">credits</span>
                {item.originalPrice && item.originalPrice > item.price && (
                  <span className="text-lg text-gray-500 line-through">{item.originalPrice.toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={onPurchase}
            disabled={purchasing}
            className={cn(
              'flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all',
              item.owned
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-xl shadow-emerald-500/30'
            )}
          >
            {purchasing ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            ) : item.owned ? (
              <>
                <Check className="h-6 w-6" />
                Owned — Go to Arsenal
                <ArrowUpRight className="h-5 w-5" />
              </>
            ) : (
              <>
                <ShoppingCart className="h-6 w-6" />
                Purchase Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
