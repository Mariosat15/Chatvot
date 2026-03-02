"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "@/lib/utils/html-sanitizer";
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
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  Swords,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";

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
    canCreateCompetitions: boolean;
    canEarnFromChallenges?: boolean;
    challengeReferralFeePercentage?: number;
  };
}

type Category = "all" | "indicator" | "strategy" | "cosmetic" | "gamemaster";
type SortOption =
  | "popular"
  | "cheapest"
  | "expensive"
  | "rating"
  | "newest"
  | "name";

const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "popular", label: "Most Popular", icon: Flame },
  { value: "cheapest", label: "Cheapest First", icon: SortAsc },
  { value: "expensive", label: "Most Expensive", icon: TrendingUp },
  { value: "rating", label: "Highest Rated", icon: Star },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "name", label: "Name A-Z", icon: ArrowDownAZ },
];

const CATEGORIES: {
  value: Category;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
}[] = [
  {
    value: "all",
    label: "All Items",
    icon: Sparkles,
    color: "text-white",
    bgGradient: "from-gray-600/20 to-gray-800/20",
  },
  {
    value: "gamemaster",
    label: "Game Master",
    icon: Crown,
    color: "text-yellow-400",
    bgGradient: "from-yellow-500/20 to-amber-500/20",
  },
  {
    value: "indicator",
    label: "Indicators",
    icon: LineChart,
    color: "text-emerald-400",
    bgGradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    value: "strategy",
    label: "Strategies",
    icon: Target,
    color: "text-orange-400",
    bgGradient: "from-orange-500/20 to-amber-500/20",
  },
  {
    value: "cosmetic",
    label: "Cosmetics",
    icon: Palette,
    color: "text-pink-400",
    bgGradient: "from-pink-500/20 to-rose-500/20",
  },
];

const INDICATOR_TYPE_INFO: Record<
  string,
  { icon: typeof TrendingUp; color: string; label: string }
> = {
  sma: { icon: TrendingUp, color: "text-blue-400", label: "Moving Average" },
  ema: { icon: Activity, color: "text-cyan-400", label: "EMA" },
  bb: { icon: Layers, color: "text-purple-400", label: "Volatility" },
  rsi: { icon: BarChart3, color: "text-green-400", label: "Momentum" },
  macd: { icon: Activity, color: "text-pink-400", label: "Momentum" },
  support_resistance: {
    icon: LineChart,
    color: "text-yellow-400",
    label: "Levels",
  },
};

const RISK_STYLES = {
  low: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  medium: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  high: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  very_high: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
};

const MARKETPLACE_VIEW_KEY = "marketplace-view-mode";

export default function MarketplaceContent() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [showFreeOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // Load saved view preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MARKETPLACE_VIEW_KEY) as "card" | "list" | null;
      if (saved === "card" || saved === "list") setViewMode(saved);
    } catch { /* ignore */ }
  }, []);

  // Persist view mode changes
  const handleSetViewMode = (mode: "card" | "list") => {
    setViewMode(mode);
    try { localStorage.setItem(MARKETPLACE_VIEW_KEY, mode); } catch { /* ignore */ }
  };

  // Use ref to store the current search value without triggering re-renders
  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchItems = useCallback(
    async (searchQuery?: string) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (category !== "all") params.set("category", category);
        if (showFreeOnly) params.set("free", "true");
        // Use provided searchQuery or current search ref
        const currentSearch =
          searchQuery !== undefined ? searchQuery : searchRef.current;
        if (currentSearch) params.set("search", currentSearch);

        const response = await fetch(`/api/marketplace?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (data.success) {
          // Filter out any trading_bot items - keep indicators, strategies, cosmetics, and gamemaster packages
          const filteredItems = data.items.filter(
            (item: MarketplaceItem) =>
              item.category === "indicator" ||
              item.category === "strategy" ||
              item.category === "cosmetic" ||
              item.category === "gamemaster",
          );
          setItems(filteredItems);
        }
      } catch (error) {
        console.error("Error fetching marketplace items:", error);
        toast.error("Failed to load marketplace");
      } finally {
        setLoading(false);
      }
    },
    [category, showFreeOnly],
  );

  // Fetch on category or free filter change (not on search keystroke)
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // State for GM action modal
  const [gmActionModal, setGmActionModal] = useState<{
    show: boolean;
    type: "upgrade_only" | "renew_or_delete" | null;
    details: {
      currentPackage?: string;
      currentPrice?: number;
      newPrice?: number;
      expiredDate?: string;
      renewalPrice?: number;
      message?: string;
    } | null;
  }>({ show: false, type: null, details: null });
  const [gmActionLoading, setGmActionLoading] = useState<
    "renew" | "delete" | null
  >(null);

  // Reason: Show terms dialog before marketplace purchases
  const [showTerms, setShowTerms] = useState(false);
  const [pendingPurchaseItem, setPendingPurchaseItem] =
    useState<MarketplaceItem | null>(null);

  const handlePurchase = async (item: MarketplaceItem) => {
    if (item.owned) {
      router.push("/profile?tab=trading-arsenal");
      return;
    }

    // Show terms dialog before proceeding with purchase
    setPendingPurchaseItem(item);
    setShowTerms(true);
  };

  /** Called after user accepts terms — proceeds with the actual purchase */
  const proceedWithPurchase = async () => {
    setShowTerms(false);
    const item = pendingPurchaseItem;
    if (!item) return;
    setPendingPurchaseItem(null);

    try {
      setPurchasing(item._id);
      const response = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item._id }),
      });

      const data = await response.json();

      if (data.success) {
        // Different success messages for GM packages
        if (data.gameMasterActivated) {
          const endDate = data.gameMasterSubscription?.endDate
            ? new Date(data.gameMasterSubscription.endDate).toLocaleDateString()
            : null;

          if (data.gameMasterPurchaseType === "upgrade") {
            const upgradeDetails = data.upgradeDetails;
            let description = "Your new Game Master benefits are now active.";
            if (upgradeDetails?.daysCarriedOver > 0) {
              description = `${upgradeDetails.daysCarriedOver} days carried over + ${upgradeDetails.newPackageDays} new days = ${upgradeDetails.totalDays} total days! Expires: ${endDate}`;
            } else {
              description = `${upgradeDetails?.totalDays || 30} days subscription. Expires: ${endDate}`;
            }
            toast.success(
              `🎉 Upgraded to ${data.gameMasterSubscription?.packageName}!`,
              {
                description,
                duration: 8000,
              },
            );
          } else {
            toast.success(`🎮 Welcome, Game Master!`, {
              description: `Your ${data.gameMasterSubscription?.packageName} subscription is active until ${endDate}!`,
              duration: 6000,
            });
          }

          // Redirect to GM dashboard after short delay to show the toast
          setTimeout(() => {
            router.push("/gamemaster");
          }, 2000);
        } else {
          toast.success(`Successfully purchased ${item.name}!`);
        }
        setItems((prev) =>
          prev.map((i) => (i._id === item._id ? { ...i, owned: true } : i)),
        );
        setSelectedItem(null);
      } else {
        // Handle GM-specific errors with custom modal
        if (data.errorCode === "GM_ACTIVE_UPGRADE_ONLY") {
          setGmActionModal({
            show: true,
            type: "upgrade_only",
            details: data.details,
          });
        } else if (data.errorCode === "GM_EXPIRED_MUST_RENEW_OR_DELETE") {
          setGmActionModal({
            show: true,
            type: "renew_or_delete",
            details: data.details,
          });
        } else {
          toast.error(data.error || "Failed to purchase");
        }
      }
    } catch (error) {
      console.error("Error purchasing item:", error);
      toast.error("Failed to purchase item");
    } finally {
      setPurchasing(null);
    }
  };

  const handleGmRenew = async () => {
    try {
      setGmActionLoading("renew");
      const response = await fetch("/api/gamemaster/renew", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setGmActionModal({ show: false, type: null, details: null });
        fetchItems(); // Refresh items
      } else {
        toast.error(data.error || "Failed to renew subscription");
      }
    } catch (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Failed to renew subscription");
    } finally {
      setGmActionLoading(null);
    }
  };

  const handleGmDelete = async () => {
    try {
      setGmActionLoading("delete");
      const response = await fetch("/api/gamemaster/delete", {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setGmActionModal({ show: false, type: null, details: null });
        fetchItems(); // Refresh items
      } else {
        toast.error(data.error || "Failed to delete subscription");
      }
    } catch (error) {
      console.error("Error deleting subscription:", error);
      toast.error("Failed to delete subscription");
    } finally {
      setGmActionLoading(null);
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
        case "cheapest":
          return a.price - b.price;
        case "expensive":
          return b.price - a.price;
        case "rating":
          return b.averageRating - a.averageRating;
        case "newest":
          return 0; // Would need createdAt field, defaulting to original order
        case "name":
          return a.name.localeCompare(b.name);
        case "popular":
        default:
          return b.totalPurchases - a.totalPurchases;
      }
    });
  };

  const featuredItems = items.filter((i) => i.isFeatured);
  const indicators = sortItems(items.filter((i) => i.category === "indicator"));
  const strategies = sortItems(items.filter((i) => i.category === "strategy"));
  const cosmetics = sortItems(items.filter((i) => i.category === "cosmetic"));
  const gamemasterPackages = sortItems(
    items.filter((i) => i.category === "gamemaster"),
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero Section with Animated Background */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent blur-3xl animate-pulse" />
          <div
            className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-orange-500/20 via-transparent to-transparent blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
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
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-orange-400 text-transparent bg-clip-text pb-2">
                Trading Strategy
              </span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Professional indicators and automated strategies to give you the
              edge in competitions and challenges.
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
                    "flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium transition-all",
                    isActive
                      ? `bg-gradient-to-br ${cat.bgGradient} border border-white/10 text-white shadow-lg`
                      : "text-gray-400 hover:text-white hover:bg-white/5",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? cat.color : "")} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-900/50 rounded-xl border border-gray-700/50 p-1">
              <button
                onClick={() => handleSetViewMode("card")}
                title="Card view"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === "card"
                    ? "bg-emerald-500 text-white"
                    : "text-gray-400 hover:text-gray-200",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSetViewMode("list")}
                title="List view"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === "list"
                    ? "bg-emerald-500 text-white"
                    : "text-gray-400 hover:text-gray-200",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-700/50"
              >
                {(() => {
                  const currentSort = SORT_OPTIONS.find(
                    (s) => s.value === sortBy,
                  );
                  const SortIcon = currentSort?.icon || SortAsc;
                  return (
                    <>
                      <SortIcon className="h-5 w-5" />
                      <span className="hidden sm:inline">
                        {currentSort?.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          showSortDropdown && "rotate-180",
                        )}
                      />
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
                              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                              isActive
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-gray-300 hover:bg-gray-800 hover:text-white",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{option.label}</span>
                            {isActive && <Check className="h-4 w-4 ml-auto" />}
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
            <h3 className="text-2xl font-bold text-white mb-3">
              No Items Found
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Try adjusting your filters or search terms to discover amazing
              trading tools.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Featured Section */}
            {featuredItems.length > 0 && category === "all" && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Featured</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
                </div>
                <div className={viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-2"}>
                  {featuredItems.map((item) => {
                    // Use the correct card component based on category
                    if (item.category === "cosmetic") {
                      return (
                        <CosmeticCard
                          key={item._id}
                          item={item}
                          onView={() => setSelectedItem(item)}
                          onPurchase={() => handlePurchase(item)}
                          purchasing={purchasing === item._id}
                          listView={viewMode === "list"}
                        />
                      );
                    }
                    if (item.category === "gamemaster") {
                      return (
                        <GameMasterCard
                          key={item._id}
                          item={item}
                          onView={() => setSelectedItem(item)}
                          onPurchase={() => handlePurchase(item)}
                          purchasing={purchasing === item._id}
                          listView={viewMode === "list"}
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
                        listView={viewMode === "list"}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Game Master Packages Section - Shown first */}
            {(category === "all" || category === "gamemaster") &&
              gamemasterPackages.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Crown className="h-5 w-5 text-yellow-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Game Master Packages
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium">
                      {gamemasterPackages.length}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
                  </div>
                  <p className="text-gray-400 mb-6 -mt-4">
                    Become a Game Master! Create competitions, earn from
                    referrals, and build your trading community.
                  </p>
                  <div className={viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-2"}>
                    {gamemasterPackages.map((item) => (
                      <GameMasterCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                        listView={viewMode === "list"}
                      />
                    ))}
                  </div>
                </section>
              )}

            {/* Indicators Section */}
            {(category === "all" || category === "indicator") &&
              indicators.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <LineChart className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Indicators
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium">
                      {indicators.length}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
                  </div>
                  <div className={viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-2"}>
                    {indicators.map((item) => (
                      <ItemCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                        listView={viewMode === "list"}
                      />
                    ))}
                  </div>
                </section>
              )}

            {/* Strategies Section */}
            {(category === "all" || category === "strategy") &&
              strategies.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Target className="h-5 w-5 text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Strategies
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-sm font-medium">
                      {strategies.length}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-orange-500/20 to-transparent" />
                  </div>
                  <div className={viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-2"}>
                    {strategies.map((item) => (
                      <ItemCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                        listView={viewMode === "list"}
                      />
                    ))}
                  </div>
                </section>
              )}

            {/* Cosmetics Section - Shown last */}
            {(category === "all" || category === "cosmetic") &&
              cosmetics.length > 0 && (
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
                  <div className={viewMode === "card" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" : "flex flex-col gap-2"}>
                    {cosmetics.map((item) => (
                      <CosmeticCard
                        key={item._id}
                        item={item}
                        onView={() => setSelectedItem(item)}
                        onPurchase={() => handlePurchase(item)}
                        purchasing={purchasing === item._id}
                        listView={viewMode === "list"}
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

      {/* GM Action Modal */}
      {gmActionModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f1a] border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            {gmActionModal.type === "upgrade_only" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-yellow-500/10">
                    <Crown className="h-6 w-6 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Upgrade Required
                  </h3>
                </div>
                <p className="text-gray-300 mb-4">
                  {gmActionModal.details?.message}
                </p>
                <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Current Package</span>
                    <span className="text-white font-medium">
                      {gmActionModal.details?.currentPackage}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Current Price</span>
                    <span className="text-yellow-400 font-medium">
                      ⚡ {gmActionModal.details?.currentPrice} credits
                    </span>
                  </div>
                  <hr className="border-gray-700 my-3" />
                  <p className="text-sm text-gray-400">
                    Choose a package priced higher than{" "}
                    <span className="text-yellow-400">
                      ⚡ {gmActionModal.details?.currentPrice}
                    </span>{" "}
                    credits to upgrade.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setGmActionModal({ show: false, type: null, details: null })
                  }
                  className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  Got it, I&apos;ll choose a higher tier
                </button>
              </>
            )}

            {gmActionModal.type === "renew_or_delete" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-red-500/10">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Subscription Expired
                  </h3>
                </div>
                <p className="text-gray-300 mb-4">
                  {gmActionModal.details?.message}
                </p>
                <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Expired Package</span>
                    <span className="text-white font-medium">
                      {gmActionModal.details?.currentPackage}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Renewal Price</span>
                    <span className="text-yellow-400 font-medium">
                      ⚡ {gmActionModal.details?.renewalPrice} credits
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  You have two options:
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleGmRenew}
                    disabled={gmActionLoading !== null}
                    className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {gmActionLoading === "renew" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Renew Current Package (⚡{" "}
                    {gmActionModal.details?.renewalPrice})
                  </button>

                  <button
                    onClick={handleGmDelete}
                    disabled={gmActionLoading !== null}
                    className="w-full py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 disabled:opacity-50 text-red-400 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {gmActionLoading === "delete" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete &amp; Start Fresh
                  </button>

                  <button
                    onClick={() =>
                      setGmActionModal({
                        show: false,
                        type: null,
                        details: null,
                      })
                    }
                    disabled={gmActionLoading !== null}
                    className="w-full py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Deleting preserves your referral history but allows you to
                  purchase any package.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Terms Dialog — shown before marketplace purchases */}
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.MARKETPLACE}
        open={showTerms}
        onAccept={proceedWithPurchase}
        onDecline={() => {
          setShowTerms(false);
          setPendingPurchaseItem(null);
        }}
      />
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
  listView = false,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
  featured?: boolean;
  listView?: boolean;
}) {
  // Properly detect category from the actual category field
  const isIndicator = item.category === "indicator";
  const isStrategy = item.category === "strategy";
  const isCosmetic = item.category === "cosmetic";
  const isGameMaster = item.category === "gamemaster";

  const indicatorInfo = item.indicatorType
    ? INDICATOR_TYPE_INFO[item.indicatorType]
    : null;
  const riskStyle =
    RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] ||
    RISK_STYLES.medium;

  // Set icon, color, and gradient based on ACTUAL category
  let CategoryIcon = LineChart;
  let iconColor = "text-emerald-400";
  let gradientBg = "from-emerald-500/10 to-teal-500/10";
  let categoryLabel = "Indicator";
  let categoryBgColor = "bg-emerald-500/10 text-emerald-400";
  let accentGradient = "from-emerald-500 to-teal-500";

  if (isStrategy) {
    CategoryIcon = Target;
    iconColor = "text-orange-400";
    gradientBg = "from-orange-500/10 to-amber-500/10";
    categoryLabel = "Strategy";
    categoryBgColor = "bg-orange-500/10 text-orange-400";
    accentGradient = "from-orange-500 to-amber-500";
  } else if (isCosmetic) {
    CategoryIcon = Palette;
    iconColor = "text-pink-400";
    gradientBg = "from-pink-500/10 to-rose-500/10";
    categoryLabel = item.cosmeticType === "avatar" ? "Avatar" : "Cosmetic";
    categoryBgColor = "bg-pink-500/10 text-pink-400";
    accentGradient = "from-pink-500 to-rose-500";
  } else if (isGameMaster) {
    CategoryIcon = Crown;
    iconColor = "text-yellow-400";
    gradientBg = "from-yellow-500/10 to-amber-500/10";
    categoryLabel = "Game Master";
    categoryBgColor = "bg-yellow-500/10 text-yellow-400";
    accentGradient = "from-yellow-500 to-amber-500";
  } else if (isIndicator && indicatorInfo) {
    CategoryIcon = indicatorInfo.icon;
    iconColor = indicatorInfo.color;
    categoryLabel = indicatorInfo.label;
  }

  const hasImage = !!item.imageUrl;

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (listView) {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer",
          "bg-gray-800/40 border border-gray-700/50",
          "hover:border-gray-600/60 hover:bg-gray-800/70",
          featured && "ring-1 ring-yellow-500/30",
          item.owned && "ring-1 ring-emerald-500/30",
        )}
        onClick={onView}
      >
        {/* Thumbnail / Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden bg-gradient-to-br",
            gradientBg,
          )}
        >
          {hasImage ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-10 h-10 object-contain"
            />
          ) : (
            <CategoryIcon className={cn("h-5 w-5", iconColor)} />
          )}
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
              {item.name}
            </h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0", categoryBgColor)}>
              {categoryLabel}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0", riskStyle.bg, riskStyle.text, riskStyle.border)}>
              {item.riskLevel.replace("_", " ")}
            </span>
            {featured && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0">
                Featured
              </span>
            )}
            {item.owned && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                Owned
              </span>
            )}
            {item.isFree && !item.owned && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                Free
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {item.shortDescription}
          </p>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {item.totalPurchases}
          </span>
          {item.averageRating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              {item.averageRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex-shrink-0 text-right min-w-[64px]">
          {item.isFree ? (
            <span className="text-sm font-bold text-green-400">FREE</span>
          ) : (
            <span className="text-sm font-bold text-white">
              ⚡ {item.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Action */}
        <button
          onClick={(e) => { e.stopPropagation(); onPurchase(); }}
          disabled={purchasing}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex-shrink-0",
            item.owned
              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20",
          )}
        >
          {purchasing ? (
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
          ) : item.owned ? (
            <><Check className="h-3 w-3" />Owned</>
          ) : (
            <><ShoppingCart className="h-3 w-3" />Get</>
          )}
        </button>
      </div>
    );
  }

  // ── CARD VIEW ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer",
        "bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm",
        "border border-gray-700/50 hover:border-gray-600/50",
        "hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1",
        featured && "ring-2 ring-yellow-500/30",
        item.owned && "ring-2 ring-emerald-500/30",
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r z-10",
          accentGradient,
        )}
      />

      {/* Large Image Area (when image exists) */}
      {hasImage && (
        <div className="relative aspect-[16/10] bg-gray-900 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {/* Badges over image */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {featured && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-full">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold text-yellow-400">
                  Featured
                </span>
              </div>
            )}
            {!featured && item.owned && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-full">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  Owned
                </span>
              </div>
            )}
            {!featured && !item.owned && item.isFree && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full">
                <Gift className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-semibold text-green-400">
                  Free
                </span>
              </div>
            )}
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ml-auto",
                riskStyle.bg,
                riskStyle.text,
                riskStyle.border,
              )}
            >
              {item.riskLevel.replace("_", " ")}
            </div>
          </div>
        </div>
      )}

      {/* Badges (when no image) */}
      {!hasImage && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          {featured && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-full">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400">
                Featured
              </span>
            </div>
          )}
          {!featured && item.owned && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-full">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">
                Owned
              </span>
            </div>
          )}
          {!featured && !item.owned && item.isFree && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full">
              <Gift className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">Free</span>
            </div>
          )}
          <div
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ml-auto",
              riskStyle.bg,
              riskStyle.text,
              riskStyle.border,
            )}
          >
            {item.riskLevel.replace("_", " ")}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn("p-6", !hasImage && "pt-14")}>
        {/* Icon (only when no image) */}
        {!hasImage && (
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br",
              gradientBg,
            )}
          >
            <CategoryIcon className={cn("h-7 w-7", iconColor)} />
          </div>
        )}

        {/* Category Tag */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-medium",
              categoryBgColor,
            )}
          >
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
                <span className="text-xl font-bold text-white">
                  ⚡ {item.price.toLocaleString()}
                </span>
                {item.originalPrice && item.originalPrice > item.price && (
                  <span className="text-sm text-gray-500 line-through">
                    {item.originalPrice.toLocaleString()}
                  </span>
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
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all",
              item.owned
                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20",
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
  listView = false,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
  listView?: boolean;
}) {
  if (listView) {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer",
          "bg-gray-800/40 border border-gray-700/50 hover:border-pink-500/40 hover:bg-gray-800/70",
          item.owned && "ring-1 ring-pink-500/30",
        )}
        onClick={onView}
      >
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-gray-900 border border-gray-700/50">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain" />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          )}
        </div>

        {/* Name + desc */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-pink-400 transition-colors">
              {item.name}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20 flex-shrink-0">
              Avatar
            </span>
            {item.owned && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/20 text-pink-400 border border-pink-500/30 flex-shrink-0">
                Owned
              </span>
            )}
            {item.isFree && !item.owned && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                Free
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.shortDescription}</p>
        </div>

        {/* Price */}
        <div className="flex-shrink-0 text-right min-w-[64px]">
          {item.isFree ? (
            <span className="text-sm font-bold text-green-400">FREE</span>
          ) : (
            <span className="text-sm font-bold text-pink-400">⚡ {item.price}</span>
          )}
        </div>

        {/* Action */}
        <button
          onClick={(e) => { e.stopPropagation(); onPurchase(); }}
          disabled={purchasing}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0",
            item.owned
              ? "bg-pink-500/20 text-pink-400 cursor-default"
              : "bg-pink-500 hover:bg-pink-600 text-white hover:shadow-lg hover:shadow-pink-500/30",
          )}
        >
          {purchasing ? (
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
          ) : item.owned ? (
            <><Check className="h-3 w-3" />Owned</>
          ) : (
            <><ShoppingCart className="h-3 w-3" />Get</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer",
        "bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm",
        "border border-gray-700/50 hover:border-pink-500/50",
        "hover:shadow-2xl hover:shadow-pink-500/10 hover:-translate-y-1",
        item.owned && "ring-2 ring-pink-500/30",
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-rose-500" />

      {/* Image */}
      <div className="relative aspect-square bg-gray-900 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
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
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              item.owned
                ? "bg-pink-500/20 text-pink-400 cursor-default"
                : "bg-pink-500 hover:bg-pink-600 text-white hover:shadow-lg hover:shadow-pink-500/30",
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
  listView = false,
}: {
  item: MarketplaceItem;
  onView: () => void;
  onPurchase: () => void;
  purchasing: boolean;
  listView?: boolean;
}) {
  const config = item.gameMasterConfig;
  const hasImage = !!item.imageUrl;

  if (listView) {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer",
          "bg-gray-800/40 border border-yellow-500/20 hover:border-yellow-500/40 hover:bg-gray-800/70",
          item.owned && "ring-1 ring-yellow-500/40",
        )}
        onClick={onView}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/20">
          {hasImage ? (
            <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-contain" />
          ) : (
            <Crown className="h-5 w-5 text-yellow-400" />
          )}
        </div>

        {/* Name + desc */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
              {item.name}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
              Game Master
            </span>
            {item.owned && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.shortDescription}</p>
        </div>

        {/* Key stats */}
        {config && (
          <div className="hidden md:flex items-center gap-3 text-xs flex-shrink-0">
            <span className="text-gray-400">{config.subscriptionDurationDays}d</span>
            <span className="text-emerald-400 font-medium">{config.referralFeePercentage}% ref</span>
            {config.canCreateCompetitions !== false && (
              <span className="text-blue-400">{config.maxCompetitionsPerDay}/day</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex-shrink-0 text-right min-w-[80px]">
          <span className="text-sm font-bold text-white">⚡ {item.price.toLocaleString()}</span>
        </div>

        {/* Action */}
        <button
          onClick={(e) => { e.stopPropagation(); onPurchase(); }}
          disabled={purchasing || item.owned}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex-shrink-0",
            item.owned
              ? "bg-yellow-500/10 text-yellow-400 cursor-default"
              : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black shadow-lg shadow-yellow-500/20",
          )}
        >
          {purchasing ? (
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-black border-t-transparent" />
          ) : item.owned ? (
            <><Check className="h-3 w-3" />Active</>
          ) : (
            <><Crown className="h-3 w-3" />Get GM</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer",
        "bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm",
        "border border-yellow-500/30 hover:border-yellow-500/50",
        "hover:shadow-2xl hover:shadow-yellow-500/10 hover:-translate-y-1",
        item.owned && "ring-2 ring-yellow-500/50",
      )}
      onClick={onView}
    >
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-500 z-10" />

      {/* Crown decoration */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full blur-2xl" />

      {/* Large Image Area (when image exists) */}
      {hasImage && (
        <div className="relative aspect-[16/10] bg-gray-900 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {/* Badges over image */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 text-yellow-400">
              Game Master
            </span>
            {item.owned && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-full">
                <BadgeCheck className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-xs font-semibold text-yellow-400">
                  Active
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Header (only when no image) */}
        {!hasImage && (
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
                <span className="text-xs font-semibold text-yellow-400">
                  Active
                </span>
              </div>
            )}
          </div>
        )}

        {/* Name (when image exists - shown below image) */}
        {hasImage && (
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">
            {item.name}
          </h3>
        )}

        <p className="text-sm text-gray-400 mb-5 line-clamp-2">
          {item.shortDescription}
        </p>

        {/* Package Features */}
        {config && (
          <div className="space-y-3 mb-5">
            {/* Row 1: Duration & Referral Fee - Always shown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Duration</span>
                </div>
                <p className="text-white font-semibold">
                  {config.subscriptionDurationDays || 30} Days
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Percent className="h-4 w-4" />
                  <span className="text-xs">Referral Fee</span>
                </div>
                <p className="text-emerald-400 font-semibold">
                  {config.referralFeePercentage || 5}%
                </p>
              </div>
            </div>

            {/* Row 2: Competition settings - Only shown if canCreateCompetitions is true */}
            {config.canCreateCompetitions !== false ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Zap className="h-4 w-4" />
                    <span className="text-xs">Competitions/Day</span>
                  </div>
                  <p className="text-white font-semibold">
                    {config.maxCompetitionsPerDay || 1}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">Max Users/Comp</span>
                  </div>
                  <p className="text-white font-semibold">
                    {config.maxUsersPerCompetition || 50}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Referral-Only Package</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Earn from referrals in any competition
                </p>
              </div>
            )}

            {/* Challenge Earnings Row */}
            {config.canEarnFromChallenges ? (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-400 text-sm">
                    <Swords className="h-4 w-4" />
                    <span className="font-medium">⚔️ Challenge Earnings</span>
                  </div>
                  <span className="text-orange-400 font-bold">
                    {config.challengeReferralFeePercentage ??
                      config.referralFeePercentage}
                    %
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Earn from 1v1 challenge referrals
                </p>
              </div>
            ) : (
              <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-3 mt-3">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Swords className="h-4 w-4" />
                  <span className="font-medium">No Challenge Earnings</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upgrade for 1v1 challenge fees
                </p>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gray-700/50 mb-5" />

        {/* Price & Action */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">
                ⚡ {item.price.toLocaleString()}
              </span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm text-gray-500 line-through">
                  {item.originalPrice.toLocaleString()}
                </span>
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
              "flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all",
              item.owned
                ? "bg-yellow-500/10 text-yellow-400 cursor-default"
                : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black shadow-lg shadow-yellow-500/20",
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
  const _isIndicator = item.category === "indicator";
  const isStrategy = item.category === "strategy";
  const isGameMaster = item.category === "gamemaster";
  const indicatorInfo = item.indicatorType
    ? INDICATOR_TYPE_INFO[item.indicatorType]
    : null;
  const riskStyle =
    RISK_STYLES[item.riskLevel as keyof typeof RISK_STYLES] ||
    RISK_STYLES.medium;

  const CategoryIcon = isGameMaster
    ? Crown
    : isStrategy
      ? Target
      : indicatorInfo?.icon || LineChart;
  const iconColor = isGameMaster
    ? "text-yellow-400"
    : isStrategy
      ? "text-orange-400"
      : indicatorInfo?.color || "text-emerald-400";

  const borderColor = isGameMaster
    ? "border-yellow-400"
    : isStrategy
      ? "border-orange-400"
      : "border-emerald-400";
  const headerBg = isGameMaster
    ? "from-yellow-400 via-amber-400 to-orange-500"
    : isStrategy
      ? "from-orange-400 to-red-500"
      : "from-emerald-400 to-teal-500";
  const tagBg = isGameMaster
    ? "bg-yellow-500/20 text-yellow-400"
    : isStrategy
      ? "bg-orange-500/20 text-orange-400"
      : "bg-emerald-500/20 text-emerald-400";
  const accentText = isGameMaster
    ? "text-yellow-400"
    : isStrategy
      ? "text-orange-400"
      : "text-emerald-400";

  const hasImage = !!item.imageUrl;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 30) setShowScrollHint(false);
      else setShowScrollHint(true);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Check if content is scrollable at all
    const timer = setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight + 20) setShowScrollHint(false);
    }, 300);
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center py-8 px-4">
      <div
        className={`relative border-[6px] ${borderColor} rounded-[18px] overflow-hidden shadow-2xl w-full max-w-[400px]`}
        style={{ background: "linear-gradient(135deg, #1a1d2e 0%, #131722 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Holographic shimmer */}
        <div
          className="absolute inset-0 pointer-events-none z-30 opacity-15 animate-shimmer"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 45%, transparent 50%)",
            backgroundSize: "200% 200%",
            animation: "shimmer 4s linear infinite",
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-40"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* === TOP BAR: Category + Name + Price === */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tagBg}`}>
                {isGameMaster ? "Game Master" : isStrategy ? "Strategy" : "Indicator"}
              </span>
              {!isGameMaster && (
                <span className="text-[10px] text-gray-400 italic">v{item.version}</span>
              )}
            </div>
            {item.owned && (
              <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                OWNED
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-extrabold ${accentText} leading-tight truncate mr-2`}>{item.name}</h2>
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.isFree ? (
                <span className="text-lg font-extrabold text-green-400">FREE</span>
              ) : (
                <>
                  <span className="text-lg font-extrabold text-amber-400">⚡{item.price.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* === ART FRAME (Image or Icon) === */}
        <div className="mx-3 mb-2">
          <div className={`relative rounded-lg border-2 ${borderColor} overflow-hidden bg-gradient-to-br ${headerBg}`}>
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <div className="absolute inset-0" style={{
                backgroundImage: "radial-gradient(circle at 30% 30%, white 2px, transparent 2px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }} />
            </div>

            {hasImage ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full aspect-[16/10] object-contain relative z-10"
              />
            ) : (
              <div className="w-full aspect-[16/10] flex items-center justify-center relative z-10">
                <CategoryIcon className={cn("h-20 w-20 text-white drop-shadow-lg")} />
              </div>
            )}
          </div>
        </div>

        {/* === FLAVOR TEXT (Short Description) === */}
        <div className="mx-4 mb-2">
          <p className="text-[11px] text-gray-400 italic text-center leading-snug line-clamp-2">{item.shortDescription}</p>
        </div>

        {/* === CONTENT === */}
        <div className="mx-3 mb-2 space-y-2">
          {/* Risk + Version badge row */}
          {!isGameMaster && (
            <div className="flex items-center gap-2 justify-center">
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", riskStyle.bg, riskStyle.text)}>
                {item.riskLevel.replace("_", " ")} risk
              </span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-[10px] text-gray-500 line-through">{item.originalPrice.toLocaleString()} credits</span>
              )}
            </div>
          )}

          {/* Game Master Package Features */}
          {isGameMaster && item.gameMasterConfig && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
                <Crown className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-400">Package Features</span>
              </div>
              <div className={cn(
                "grid divide-x divide-gray-700",
                item.gameMasterConfig.canCreateCompetitions !== false ? "grid-cols-4" : "grid-cols-2"
              )}>
                <div className="py-2 px-2 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Duration</p>
                  <p className="text-sm font-bold text-white mt-0.5">{item.gameMasterConfig.subscriptionDurationDays}d</p>
                </div>
                <div className="py-2 px-2 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Referral</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{item.gameMasterConfig.referralFeePercentage}%</p>
                </div>
                {item.gameMasterConfig.canCreateCompetitions !== false && (
                  <>
                    <div className="py-2 px-2 text-center">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Comps/Day</p>
                      <p className="text-sm font-bold text-blue-400 mt-0.5">{item.gameMasterConfig.maxCompetitionsPerDay}</p>
                    </div>
                    <div className="py-2 px-2 text-center">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold">Max Users</p>
                      <p className="text-sm font-bold text-purple-400 mt-0.5">{item.gameMasterConfig.maxUsersPerCompetition}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Stats - Only show for non-gamemaster items */}
          {!isGameMaster && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">Stats</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-700">
                <div className="py-2 px-2 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Users</p>
                  <p className="text-sm font-bold text-white mt-0.5">{item.totalPurchases}</p>
                </div>
                <div className="py-2 px-2 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Rating</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-bold text-white">{item.averageRating > 0 ? item.averageRating.toFixed(1) : "—"}</span>
                  </div>
                </div>
                <div className="py-2 px-2 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Reviews</p>
                  <p className="text-sm font-bold text-white mt-0.5">{item.totalRatings}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description Section */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
              <Sparkles className={cn("h-3.5 w-3.5", accentText)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wide", accentText)}>Description</span>
            </div>
            <div className="px-3 py-2">
              <div
                className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-line prose-sm"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    item.fullDescription
                      .replace(
                        /^# (.*$)/gm,
                        '<h2 class="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0">$1</h2>',
                      )
                      .replace(
                        /^## (.*$)/gm,
                        '<h3 class="text-xs font-semibold text-white mt-2 mb-1">$1</h3>',
                      )
                      .replace(
                        /\*\*(.*?)\*\*/g,
                        '<strong class="text-white font-semibold">$1</strong>',
                      )
                      .replace(
                        /\*"(.*?)"\*/g,
                        '<em class="text-cyan-400 italic block mt-2 text-xs">"$1"</em>',
                      )
                      .replace(
                        /\*(.*?)\*/g,
                        '<em class="text-gray-400 italic">$1</em>',
                      )
                      .replace(
                        /^- (.*$)/gm,
                        '<li class="ml-3 text-gray-300 list-disc text-[11px]">$1</li>',
                      )
                      .replace(
                        /^• (.*$)/gm,
                        '<li class="ml-3 text-gray-300 list-disc text-[11px]">$1</li>',
                      )
                      .replace(/\n\n/g, '</p><p class="mt-2">')
                      .replace(/^(.*)$/, "<p>$1</p>")
                  ),
                }}
              />
            </div>
          </div>

          {/* Risk Warning */}
          {item.riskWarning && (
            <div className={cn("rounded-lg px-3 py-2 border", riskStyle.bg, riskStyle.border)}>
              <div className="flex items-start gap-2">
                <Shield className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", riskStyle.text)} />
                <div>
                  <h4 className={cn("text-[10px] font-bold uppercase", riskStyle.text)}>Risk Warning</h4>
                  <p className="text-[10px] text-gray-300 mt-0.5">{item.riskWarning}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-800/50 rounded text-[10px] text-gray-400 border border-gray-700/30"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* === ACTION BUTTON === */}
        <div className="mx-3 mb-3">
          <button
            onClick={onPurchase}
            disabled={purchasing || item.owned}
            className={cn(
              "w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
              item.owned
                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:brightness-110"
                : isGameMaster
                  ? "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black shadow-lg shadow-yellow-500/30"
                  : `bg-gradient-to-r ${headerBg} text-white shadow-lg hover:brightness-110`,
            )}
          >
            {purchasing ? (
              <div className={cn(
                "animate-spin rounded-full h-5 w-5 border-2 border-t-transparent",
                isGameMaster && !item.owned ? "border-black" : "border-white"
              )} />
            ) : item.owned ? (
              <>
                <Check className="h-4 w-4" />
                {isGameMaster ? "Already Active" : "Owned — Go to Arsenal"}
                {!isGameMaster && <ArrowUpRight className="h-3.5 w-3.5" />}
              </>
            ) : (
              <>
                {isGameMaster ? <Crown className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                {isGameMaster ? "Become a Game Master" : "Purchase Now"}
              </>
            )}
          </button>
        </div>

        {/* Card ID */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[8px] text-gray-500">Chartvolt Marketplace</span>
          <span className="text-[8px] text-gray-500 font-mono">{item.slug}</span>
        </div>
      </div>
      </div>

      {/* Scroll down hint arrow */}
      {showScrollHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div className="bg-white/10 backdrop-blur-sm rounded-full p-2">
            <ChevronDown className="h-5 w-5 text-white/60" />
          </div>
        </div>
      )}
    </div>
  );
}
