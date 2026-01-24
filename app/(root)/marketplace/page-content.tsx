'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Palette,
  User,
  SortAsc,
  ArrowDownAZ,
  Flame,
  Clock,
  ChevronDown,
  Crown,
  Calendar,
  Percent,
  Zap,
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
  cosmeticType?: string;
  imageUrl?: string;
  totalPurchases: number;
  averageRating: number;
  totalRatings: number;
  tags: string[];
  riskLevel: string;
  riskWarning?: string;
  owned: boolean;
  gameMasterConfig?: {
    subscriptionDurationDays: number;
    referralFeePercentage: number;
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
  };
}

type Category = 'all' | 'indicator' | 'strategy' | 'cosmetic' | 'gamemaster';
type SortOption = 'popular' | 'cheapest' | 'expensive' | 'rating' | 'newest' | 'name';

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'popular', label: 'Most Popular', icon: Flame },
  { value: 'cheapest', label: 'Cheapest First', icon: SortAsc },
  { value: 'expensive', label: 'Most Expensive', icon: TrendingUp },
  { value: 'rating', label: 'Highest Rated', icon: Star },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'name', label: 'Name A-Z', icon: ArrowDownAZ },
];

const CATEGORIES: { value: Category; label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgGradient: string }[] = [
  { value: 'all', label: 'All Items', icon: Sparkles, color: 'text-white', bgGradient: 'from-gray-600/20 to-gray-800/20' },
  { value: 'indicator', label: 'Indicators', icon: LineChart, color: 'text-emerald-400', bgGradient: 'from-emerald-500/20 to-teal-500/20' },
  { value: 'strategy', label: 'Strategies', icon: Target, color: 'text-orange-400', bgGradient: 'from-orange-500/20 to-amber-500/20' },
  { value: 'cosmetic', label: 'Cosmetics', icon: Palette, color: 'text-pink-400', bgGradient: 'from-pink-500/20 to-rose-500/20' },
  { value: 'gamemaster', label: 'Game Master', icon: Crown, color: 'text-yellow-400', bgGradient: 'from-yellow-500/20 to-amber-500/20' },
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
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Use ref to store the current search value without triggering re-renders
  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchItems = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (showFreeOnly) params.set('free', 'true');
      // Use provided searchQuery or current search ref
      const currentSearch = searchQuery !== undefined ? searchQuery : searchRef.current;
      if (currentSearch) params.set('search', currentSearch);
      
      const response = await fetch(`/api/marketplace?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        // Filter out any trading_bot items - keep indicators, strategies, cosmetics, and gamemaster packages
        const filteredItems = data.items.filter((item: MarketplaceItem) => 
          item.category === 'indicator' || item.category === 'strategy' || item.category === 'cosmetic' || item.category === 'gamemaster'
        );
        setItems(filteredItems);
      }
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [category, showFreeOnly]);
  
  // Fetch on category or free filter change (not on search keystroke)
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
    fetchItems(search);
  };
  
  // Sorting function
  const sortItems = (itemsToSort: MarketplaceItem[]): MarketplaceItem[] => {
    return [...itemsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'cheapest':
          return a.price - b.price;
        case 'expensive':
          return b.price - a.price;
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'newest':
          return 0; // Would need createdAt field, defaulting to original order
        case 'name':
          return a.name.localeCompare(b.name);
        case 'popular':
        default:
          return b.totalPurchases - a.totalPurchases;
      }
    });
  };

  const featuredItems = items.filter(i => i.isFeatured);
  const indicators = sortItems(items.filter(i => i.category === 'indicator'));
  const strategies = sortItems(items.filter(i => i.category === 'strategy'));
  const cosmetics = sortItems(items.filter(i => i.category === 'cosmetic'));
  const gamemasterPackages = sortItems(items.filter(i => i.category === 'gamemaster'));
  
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
          
          <div className="flex items-center gap-3">
            {/* Free Only Toggle */}
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
            
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-700/50"
              >
                {(() => {
                  const currentSort = SORT_OPTIONS.find(s => s.value === sortBy);
                  const SortIcon = currentSort?.icon || SortAsc;
                  return (
                    <>
                      <SortIcon className="h-5 w-5" />
                      <span className="hidden sm:inline">{currentSort?.label}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        showSortDropdown && "rotate-180"
                      )} />
                    </>
                  );
                })()}
              </button>
              
              {showSortDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSortDropdown(false)} 
                  />
                  
                  {/* Dropdown menu */}
                  <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="py-2">
                      {SORT_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = sortBy === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(option.value);
                              setShowSortDropdown(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                              isActive 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{option.label}</span>
                            {isActive && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
                  {featuredItems.map((item) => {
                    // Use the correct card component based on category
                    if (item.category === 'cosmetic') {
                      return (
                        <CosmeticCard
                          key={item._id}
                          item={item}
                          onView={() => setSelectedItem(item)}
                          onPurchase={() => handlePurchase(item)}
                          purchasing={purchasing === item._id}
                        />
                      );
                    }
                    if (item.category === 'gamemaster') {
                      return (
                        <GameMasterCard
                          key={item._id}
                          item={item}
                          onView={() => setSelectedItem(item)}
                          onPurchase={() => handlePurchase(item)}
                          purchasing={purchasing === item._id}
                        />
                      );
                    }
                    return (
                      <ItemCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                        featured
                      />
                    );
                  })}
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
            
            {/* Cosmetics Section */}
            {(category === 'all' || category === 'cosmetic') && cosmetics.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <Palette className="h-5 w-5 text-pink-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Cosmetics</h2>
                  <span className="px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-sm font-medium">
                    {cosmetics.length}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-pink-500/20 to-transparent" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {cosmetics.filter(i => category === 'cosmetic' || !i.isFeatured).map((item) => (
                    <CosmeticCard
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
            
            {/* Game Master Packages Section */}
            {(category === 'all' || category === 'gamemaster') && gamemasterPackages.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Crown className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Game Master Packages</h2>
                  <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium">
                    {gamemasterPackages.length}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
                </div>
                <p className="text-gray-400 mb-6 -mt-4">
                  Become a Game Master! Create competitions, earn from referrals, and build your trading community.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gamemasterPackages.filter(i => category === 'gamemaster' || !i.isFeatured).map((item) => (
                    <GameMasterCard
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
  // Properly detect category from the actual category field
  const isIndicator = item.category === 'indicator';
  const isStrategy = item.category === 'strategy';
  const isCosmetic = item.category === 'cosmetic';
  const isGameMaster = item.category === 'gamemaster';
  
  const indicatorInfo = item.indicatorType ? INDICATOR_TYPE_INFO[item.indicatorType] : null;
  const riskStyle = RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] || RISK_STYLES.medium;
  
  // Set icon, color, and gradient based on ACTUAL category
  let CategoryIcon = LineChart;
  let iconColor = 'text-emerald-400';
  let gradientBg = 'from-emerald-500/10 to-teal-500/10';
  let categoryLabel = 'Indicator';
  let categoryBgColor = 'bg-emerald-500/10 text-emerald-400';
  let accentGradient = 'from-emerald-500 to-teal-500';
  
  if (isStrategy) {
    CategoryIcon = Target;
    iconColor = 'text-orange-400';
    gradientBg = 'from-orange-500/10 to-amber-500/10';
    categoryLabel = 'Strategy';
    categoryBgColor = 'bg-orange-500/10 text-orange-400';
    accentGradient = 'from-orange-500 to-amber-500';
  } else if (isCosmetic) {
    CategoryIcon = Palette;
    iconColor = 'text-pink-400';
    gradientBg = 'from-pink-500/10 to-rose-500/10';
    categoryLabel = item.cosmeticType === 'avatar' ? 'Avatar' : 'Cosmetic';
    categoryBgColor = 'bg-pink-500/10 text-pink-400';
    accentGradient = 'from-pink-500 to-rose-500';
  } else if (isGameMaster) {
    CategoryIcon = Crown;
    iconColor = 'text-yellow-400';
    gradientBg = 'from-yellow-500/10 to-amber-500/10';
    categoryLabel = 'Game Master';
    categoryBgColor = 'bg-yellow-500/10 text-yellow-400';
    accentGradient = 'from-yellow-500 to-amber-500';
  } else if (isIndicator && indicatorInfo) {
    CategoryIcon = indicatorInfo.icon;
    iconColor = indicatorInfo.color;
    categoryLabel = indicatorInfo.label;
  }
  
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
        accentGradient
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
            categoryBgColor
          )}>
            {categoryLabel}
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

// Cosmetic Card Component
function CosmeticCard({
  item,
  onView,
  onPurchase,
  purchasing,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer',
        'bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm',
        'border border-gray-700/50 hover:border-pink-500/50',
        'hover:shadow-2xl hover:shadow-pink-500/10 hover:-translate-y-1',
        item.owned && 'ring-2 ring-pink-500/30'
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
      
      {/* Image */}
      <div className="relative aspect-square bg-gray-800">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-16 h-16 text-gray-600" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          {item.owned && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-pink-500/20 backdrop-blur-sm border border-pink-500/30 rounded-full">
              <BadgeCheck className="h-3 w-3 text-pink-400" />
              <span className="text-xs font-semibold text-pink-400">Owned</span>
            </div>
          )}
          {!item.owned && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 backdrop-blur-sm border border-pink-500/20">
              Avatar
            </span>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-white mb-1 line-clamp-1 group-hover:text-pink-400 transition-colors">
          {item.name}
        </h3>
        <p className="text-xs text-gray-400 mb-3 line-clamp-2 min-h-[32px]">
          {item.shortDescription}
        </p>
        
        {/* Price & Action */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">
            {item.isFree ? (
              <span className="text-green-400">FREE</span>
            ) : (
              <span className="text-pink-400">⚡ {item.price}</span>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPurchase();
            }}
            disabled={purchasing}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              item.owned 
                ? 'bg-pink-500/20 text-pink-400 cursor-default'
                : 'bg-pink-500 hover:bg-pink-600 text-white hover:shadow-lg hover:shadow-pink-500/30'
            )}
          >
            {purchasing ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⏳</span>
              </span>
            ) : item.owned ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Owned
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Get
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Game Master Card Component
function GameMasterCard({
  item,
  onView,
  onPurchase,
  purchasing,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
}) {
  const config = item.gameMasterConfig;
  
  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer',
        'bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm',
        'border border-yellow-500/30 hover:border-yellow-500/50',
        'hover:shadow-2xl hover:shadow-yellow-500/10 hover:-translate-y-1',
        item.owned && 'ring-2 ring-yellow-500/50'
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-500" />
      
      {/* Crown decoration */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full blur-2xl" />
      
      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
              <Crown className="h-7 w-7 text-yellow-400" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400">
                Game Master
              </span>
              <h3 className="text-lg font-bold text-white mt-1 group-hover:text-yellow-400 transition-colors">
                {item.name}
              </h3>
            </div>
          </div>
          {item.owned && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-full">
              <BadgeCheck className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400">Active</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-400 mb-5 line-clamp-2">
          {item.shortDescription}
        </p>
        
        {/* Package Features */}
        {config && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Duration</span>
              </div>
              <p className="text-white font-semibold">{config.subscriptionDurationDays} Days</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-xs">Referral Fee</span>
              </div>
              <p className="text-emerald-400 font-semibold">{config.referralFeePercentage}%</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs">Competitions/Day</span>
              </div>
              <p className="text-white font-semibold">{config.maxCompetitionsPerDay}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Max Users/Comp</span>
              </div>
              <p className="text-white font-semibold">{config.maxUsersPerCompetition}</p>
            </div>
          </div>
        )}
        
        {/* Divider */}
        <div className="h-px bg-gray-700/50 mb-5" />
        
        {/* Price & Action */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">⚡ {item.price.toLocaleString()}</span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm text-gray-500 line-through">{item.originalPrice.toLocaleString()}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">credits</p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPurchase();
            }}
            disabled={purchasing || item.owned}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all',
              item.owned
                ? 'bg-yellow-500/10 text-yellow-400 cursor-default'
                : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black shadow-lg shadow-yellow-500/20'
            )}
          >
            {purchasing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
            ) : item.owned ? (
              <>
                <Check className="h-4 w-4" />
                Active
              </>
            ) : (
              <>
                <Crown className="h-4 w-4" />
                Become GM
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
  const isGameMaster = item.category === 'gamemaster';
  const indicatorInfo = item.indicatorType ? INDICATOR_TYPE_INFO[item.indicatorType] : null;
  const riskStyle = RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] || RISK_STYLES.medium;
  
  const CategoryIcon = isGameMaster ? Crown : (isStrategy ? Target : (indicatorInfo?.icon || LineChart));
  const iconColor = isGameMaster ? 'text-yellow-400' : (isStrategy ? 'text-orange-400' : (indicatorInfo?.color || 'text-emerald-400'));
  const gradientBg = isGameMaster
    ? 'from-yellow-500/20 to-amber-500/20'
    : (isStrategy 
      ? 'from-orange-500/20 to-amber-500/20' 
      : 'from-emerald-500/20 to-teal-500/20');
  
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
            isGameMaster ? 'from-yellow-500 to-amber-500' : (isStrategy ? 'from-orange-500 to-amber-500' : 'from-emerald-500 to-teal-500')
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
                  isGameMaster ? 'bg-yellow-500/10 text-yellow-400' : (isStrategy ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400')
                )}>
                  {isGameMaster ? 'Game Master' : (isStrategy ? 'Strategy' : 'Indicator')}
                </span>
                {!isGameMaster && <span className="text-xs text-gray-500">v{item.version}</span>}
                {!isGameMaster && (
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                    riskStyle.bg, riskStyle.text
                  )}>
                    {item.riskLevel.replace('_', ' ')} risk
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{item.name}</h2>
              <p className="text-gray-400">{item.shortDescription}</p>
            </div>
          </div>
        </div>
        
        {/* Content - Scrollable */}
        <div className="p-8 overflow-y-auto max-h-[50vh]">
          {/* Game Master Package Features */}
          {isGameMaster && item.gameMasterConfig && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-400" />
                Package Features
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-2xl p-5 border border-yellow-500/20">
                  <Calendar className="h-6 w-6 text-yellow-400 mb-2" />
                  <div className="text-2xl font-bold text-white">{item.gameMasterConfig.subscriptionDurationDays}</div>
                  <div className="text-sm text-gray-400">Days Duration</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-2xl p-5 border border-emerald-500/20">
                  <Percent className="h-6 w-6 text-emerald-400 mb-2" />
                  <div className="text-2xl font-bold text-emerald-400">{item.gameMasterConfig.referralFeePercentage}%</div>
                  <div className="text-sm text-gray-400">Referral Earnings</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-5 border border-blue-500/20">
                  <Zap className="h-6 w-6 text-blue-400 mb-2" />
                  <div className="text-2xl font-bold text-white">{item.gameMasterConfig.maxCompetitionsPerDay}</div>
                  <div className="text-sm text-gray-400">Competitions/Day</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-5 border border-purple-500/20">
                  <Users className="h-6 w-6 text-purple-400 mb-2" />
                  <div className="text-2xl font-bold text-white">{item.gameMasterConfig.maxUsersPerCompetition}</div>
                  <div className="text-sm text-gray-400">Max Users/Comp</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Stats - Only show for non-gamemaster items */}
          {!isGameMaster && (
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
          )}
          
          {/* Description */}
          <div className="prose prose-invert max-w-none mb-8">
            <div 
              className="text-gray-300 leading-relaxed whitespace-pre-line"
              dangerouslySetInnerHTML={{ 
                __html: item.fullDescription
                  // Headers
                  .replace(/^# (.*$)/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3 first:mt-0">$1</h2>')
                  .replace(/^## (.*$)/gm, '<h3 class="text-lg font-semibold text-white mt-5 mb-2">$1</h3>')
                  // Bold text (** or __)
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                  // Italic text for quotes (*"text"*)
                  .replace(/\*"(.*?)"\*/g, '<em class="text-cyan-400 italic block mt-4 text-lg">"$1"</em>')
                  .replace(/\*(.*?)\*/g, '<em class="text-gray-400 italic">$1</em>')
                  // Bullet points (- or •)
                  .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-300 list-disc">$1</li>')
                  .replace(/^• (.*$)/gm, '<li class="ml-4 text-gray-300 list-disc">$1</li>')
                  // Line breaks - convert double newlines to paragraph spacing
                  .replace(/\n\n/g, '</p><p class="mt-4">')
                  // Wrap in paragraph
                  .replace(/^(.*)$/, '<p>$1</p>')
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
            disabled={purchasing || item.owned}
            className={cn(
              'flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all',
              item.owned
                ? isGameMaster 
                  ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                : isGameMaster
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black shadow-xl shadow-yellow-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-xl shadow-emerald-500/30'
            )}
          >
            {purchasing ? (
              <div className={cn(
                "animate-spin rounded-full h-6 w-6 border-2 border-t-transparent",
                isGameMaster ? "border-black" : "border-white"
              )} />
            ) : item.owned ? (
              <>
                <Check className="h-6 w-6" />
                {isGameMaster ? 'Already Active' : 'Owned — Go to Arsenal'}
                {!isGameMaster && <ArrowUpRight className="h-5 w-5" />}
              </>
            ) : (
              <>
                {isGameMaster ? <Crown className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}
                {isGameMaster ? 'Become a Game Master' : 'Purchase Now'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
