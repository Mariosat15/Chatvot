"use client";

import { useState, useEffect } from "react";
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
  Palette,
  User,
  CheckCircle,
  Loader2,
  Info,
  Calendar,
  Tag,
  Crown,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface MarketplaceItem {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription?: string;
  category: string;
  version: string;
  strategyType?: string;
  indicatorType?: string;
  cosmeticType?: string;
  imageUrl?: string;
  defaultSettings: Record<string, any>;
  price?: number;
  tags?: string[];
  riskLevel?: string;
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
  { value: "all", label: "All Items", icon: ShoppingBag },
  { value: "gamemaster", label: "Game Master", icon: Crown },
  { value: "trading_bot", label: "Trading Bots", icon: Bot },
  { value: "indicator", label: "Indicators", icon: TrendingUp },
  { value: "strategy", label: "Strategies", icon: Zap },
  { value: "cosmetic", label: "Cosmetics", icon: Palette },
];

const getCategoryIcon = (category: string) => {
  const found = CATEGORIES.find((c) => c.value === category);
  return found ? found.icon : ShoppingBag;
};

interface GameMasterSubscription {
  _id: string;
  status: string;
  packageName: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  isPaused: boolean;
  scheduledForDeletion: boolean;
  limits: {
    referralFeePercentage: number;
    canCreateCompetitions: boolean;
  };
  totalEarnings: number;
  totalReferredUsers: number;
}

export default function TradingArsenalSection() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  const [applyingAvatar, setApplyingAvatar] = useState<string | null>(null);
  const [currentAvatarId, setCurrentAvatarId] = useState<string | null>(null);
  const [applyingFrame, setApplyingFrame] = useState<string | null>(null);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);
  const [infoDialogItem, setInfoDialogItem] = useState<Purchase | null>(null);

  // Game Master state
  const [gmSubscription, setGmSubscription] =
    useState<GameMasterSubscription | null>(null);
  const [togglingGmPause, setTogglingGmPause] = useState(false);
  const [schedulingGmCancel, setSchedulingGmCancel] = useState(false);
  const [showGmCancelConfirm, setShowGmCancelConfirm] = useState(false);

  useEffect(() => {
    fetchPurchases();
    fetchGmSubscription();
  }, [category]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== "all" && category !== "gamemaster")
        params.set("category", category);

      const response = await fetch(
        `/api/marketplace/purchases?${params.toString()}`,
      );
      const data = await response.json();

      if (data.success) {
        setPurchases(data.purchases.filter((p: Purchase) => p.item));
      }
    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast.error("Failed to load your items");
    } finally {
      setLoading(false);
    }
  };

  const fetchGmSubscription = async () => {
    try {
      const response = await fetch("/api/gamemaster/dashboard");
      const data = await response.json();

      if (data.success && data.data?.subscription) {
        setGmSubscription(data.data.subscription);
      }
    } catch (error) {
      console.error("Error fetching GM subscription:", error);
    }
  };

  const toggleGmPause = async () => {
    if (!gmSubscription) return;

    const isPaused = gmSubscription.isPaused;
    const action = isPaused ? "resume" : "pause";

    try {
      setTogglingGmPause(true);
      const response = await fetch("/api/gamemaster/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      if (result.success) {
        setGmSubscription((prev) =>
          prev ? { ...prev, isPaused: !isPaused } : null,
        );
        if (action === "pause") {
          toast.warning(
            "Subscription paused. You will NOT receive referral fees.",
          );
        } else {
          toast.success("Subscription resumed! Referral fees active.");
        }
      } else {
        toast.error(result.error || `Failed to ${action} subscription`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} subscription`);
    } finally {
      setTogglingGmPause(false);
    }
  };

  const toggleGmScheduledCancellation = async () => {
    if (!gmSubscription) return;

    const isScheduled = gmSubscription.scheduledForDeletion;
    const action = isScheduled ? "unschedule" : "schedule";

    try {
      setSchedulingGmCancel(true);
      const response = await fetch("/api/gamemaster/schedule-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      if (result.success) {
        setGmSubscription((prev) =>
          prev
            ? {
                ...prev,
                scheduledForDeletion: !isScheduled,
                autoRenew: isScheduled ? prev.autoRenew : false,
              }
            : null,
        );

        if (action === "schedule") {
          const daysRemaining = Math.max(
            0,
            Math.ceil(
              (new Date(gmSubscription.endDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          );
          toast.info(`Scheduled for deletion in ${daysRemaining} days.`);
        } else {
          toast.success("Cancellation cancelled.");
        }
        setShowGmCancelConfirm(false);
      } else {
        toast.error(result.error || `Failed to ${action} cancellation`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} cancellation`);
    } finally {
      setSchedulingGmCancel(false);
    }
  };

  const handleToggleEnabled = async (purchase: Purchase) => {
    try {
      const response = await fetch("/api/marketplace/purchases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: purchase.purchaseId,
          isEnabled: !purchase.isEnabled,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPurchases((prev) =>
          prev.map((p) =>
            p.purchaseId === purchase.purchaseId
              ? { ...p, isEnabled: !p.isEnabled }
              : p,
          ),
        );
        toast.success(purchase.isEnabled ? "Item disabled" : "Item enabled");
      }
    } catch (error) {
      toast.error("Failed to update");
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
      const response = await fetch("/api/marketplace/purchases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: selectedPurchase.purchaseId,
          customSettings: editedSettings,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPurchases((prev) =>
          prev.map((p) =>
            p.purchaseId === selectedPurchase.purchaseId
              ? { ...p, customSettings: editedSettings }
              : p,
          ),
        );
        toast.success("Settings saved");
        setIsSettingsOpen(false);
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAvatar = async (purchase: Purchase) => {
    if (!purchase.item?.imageUrl) {
      toast.error("Avatar image not found");
      return;
    }

    try {
      setApplyingAvatar(purchase.purchaseId);
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileImage: purchase.item.imageUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentAvatarId(purchase.itemId);
        toast.success(`Avatar "${purchase.item.name}" applied!`);
        // Refresh the page to show new avatar
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to apply avatar");
      }
    } catch (error) {
      console.error("Error applying avatar:", error);
      toast.error("Failed to apply avatar");
    } finally {
      setApplyingAvatar(null);
    }
  };

  const handleApplyFrame = async (purchase: Purchase) => {
    if (!purchase.item?.imageUrl) {
      toast.error("Frame image not found");
      return;
    }

    try {
      setApplyingFrame(purchase.purchaseId);
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeFrameId: purchase.itemId,
          activeFrameUrl: purchase.item.imageUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentFrameId(purchase.itemId);
        toast.success(`Frame "${purchase.item.name}" applied!`);
        // Refresh the page to show new frame
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to apply frame");
      }
    } catch (error) {
      console.error("Error applying frame:", error);
      toast.error("Failed to apply frame");
    } finally {
      setApplyingFrame(null);
    }
  };

  const handleRemoveFrame = async () => {
    try {
      setApplyingFrame("removing");
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeFrameId: "",
          activeFrameUrl: "",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentFrameId(null);
        toast.success("Frame removed");
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to remove frame");
      }
    } catch (error) {
      console.error("Error removing frame:", error);
      toast.error("Failed to remove frame");
    } finally {
      setApplyingFrame(null);
    }
  };

  const bots = purchases.filter((p) => p.item?.category === "trading_bot");
  const indicators = purchases.filter((p) => p.item?.category === "indicator");
  const cosmetics = purchases.filter((p) => p.item?.category === "cosmetic");
  const avatars = cosmetics.filter((p) => p.item?.cosmeticType === "avatar");
  const frames = cosmetics.filter(
    (p) => p.item?.cosmeticType === "profile_frame",
  );
  const otherCosmetics = cosmetics.filter(
    (p) => !["avatar", "profile_frame"].includes(p.item?.cosmeticType || ""),
  );
  const others = purchases.filter(
    (p) =>
      !["trading_bot", "indicator", "cosmetic"].includes(
        p.item?.category || "",
      ),
  );

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
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                category === cat.value
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50",
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
            <h3 className="text-xl font-semibold text-white mb-2">
              No Items Yet
            </h3>
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
          {/* Game Master Subscription */}
          {gmSubscription &&
            (category === "all" || category === "gamemaster") && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-400" />
                  Game Master Subscription
                </h3>
                <GameMasterSubscriptionCard
                  subscription={gmSubscription}
                  onTogglePause={toggleGmPause}
                  onScheduleCancel={() => setShowGmCancelConfirm(true)}
                  onUnscheduleCancel={toggleGmScheduledCancellation}
                  togglingPause={togglingGmPause}
                  schedulingCancel={schedulingGmCancel}
                />
              </div>
            )}

          {/* Trading Bots */}
          {bots.length > 0 &&
            (category === "all" || category === "trading_bot") && (
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
                      onInfo={() => setInfoDialogItem(purchase)}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Indicators */}
          {indicators.length > 0 &&
            (category === "all" || category === "indicator") && (
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
                      onInfo={() => setInfoDialogItem(purchase)}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Avatars */}
          {avatars.length > 0 &&
            (category === "all" || category === "cosmetic") && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-pink-400" />
                  Avatars ({avatars.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {avatars.map((purchase) => (
                    <CosmeticCard
                      key={purchase.purchaseId}
                      purchase={purchase}
                      onApply={() => handleApplyAvatar(purchase)}
                      onInfo={() => setInfoDialogItem(purchase)}
                      isApplying={applyingAvatar === purchase.purchaseId}
                      isCurrentItem={currentAvatarId === purchase.itemId}
                      applyLabel="Apply Avatar"
                      appliedLabel="Applied"
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Profile Frames */}
          {frames.length > 0 &&
            (category === "all" || category === "cosmetic") && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-400" />
                  Profile Frames ({frames.length})
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Frames wrap around your avatar wherever it&apos;s displayed
                </p>

                {/* Remove Frame Button */}
                {currentFrameId && (
                  <Button
                    onClick={handleRemoveFrame}
                    variant="outline"
                    size="sm"
                    className="mb-4 border-gray-600 text-gray-400 hover:text-white"
                    disabled={applyingFrame === "removing"}
                  >
                    {applyingFrame === "removing" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      "Remove Current Frame"
                    )}
                  </Button>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {frames.map((purchase) => (
                    <FrameCard
                      key={purchase.purchaseId}
                      purchase={purchase}
                      onApply={() => handleApplyFrame(purchase)}
                      onInfo={() => setInfoDialogItem(purchase)}
                      isApplying={applyingFrame === purchase.purchaseId}
                      isCurrentFrame={currentFrameId === purchase.itemId}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Other Cosmetics (badges, titles, etc.) */}
          {otherCosmetics.length > 0 &&
            (category === "all" || category === "cosmetic") && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-pink-400" />
                  Other Cosmetics ({otherCosmetics.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {otherCosmetics.map((purchase) => (
                    <CosmeticCard
                      key={purchase.purchaseId}
                      purchase={purchase}
                      onApply={() => {}}
                      onInfo={() => setInfoDialogItem(purchase)}
                      isApplying={false}
                      isCurrentItem={false}
                      applyLabel="View"
                      appliedLabel="Owned"
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Other Items */}
          {others.length > 0 && category === "all" && (
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
                    onInfo={() => setInfoDialogItem(purchase)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item Info Dialog */}
      <Dialog
        open={!!infoDialogItem}
        onOpenChange={(open) => !open && setInfoDialogItem(null)}
      >
        <DialogContent className="max-w-lg bg-gray-900 border-gray-700">
          {infoDialogItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Info className="h-5 w-5 text-cyan-400" />
                  Item Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Item Image/Icon */}
                <div className="flex items-start gap-4">
                  {infoDialogItem.item?.category === "cosmetic" &&
                  infoDialogItem.item?.imageUrl ? (
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-800 border border-gray-700 flex-shrink-0">
                      <img
                        src={infoDialogItem.item.imageUrl}
                        alt={infoDialogItem.item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                      {(() => {
                        const Icon = getCategoryIcon(
                          infoDialogItem.item?.category || "",
                        );
                        return <Icon className="h-8 w-8 text-cyan-400" />;
                      })()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">
                      {infoDialogItem.item?.name}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {infoDialogItem.item?.shortDescription}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium">
                        {infoDialogItem.item?.category?.replace("_", " ")}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                        v{infoDialogItem.item?.version || "1.0.0"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                {infoDialogItem.item?.fullDescription && (
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Description
                    </h4>
                    <div
                      className="text-gray-400 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: infoDialogItem.item.fullDescription
                          // Bold text
                          .replace(
                            /\*\*(.*?)\*\*/g,
                            '<strong class="text-white font-semibold">$1</strong>',
                          )
                          // Italic quotes
                          .replace(
                            /\*"(.*?)"\*/g,
                            '<em class="text-cyan-400 italic block mt-3 text-base">"$1"</em>',
                          )
                          .replace(
                            /\*(.*?)\*/g,
                            '<em class="text-gray-500 italic">$1</em>',
                          )
                          // Bullet points
                          .replace(
                            /^• (.*$)/gm,
                            '<li class="ml-3 text-gray-400 list-disc">$1</li>',
                          )
                          .replace(
                            /^- (.*$)/gm,
                            '<li class="ml-3 text-gray-400 list-disc">$1</li>',
                          )
                          // Line breaks
                          .replace(/\n\n/g, "<br/><br/>")
                          .replace(/\n/g, "<br/>"),
                      }}
                    />
                  </div>
                )}

                {/* Purchase Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Purchased
                    </div>
                    <p className="text-white font-medium">
                      {new Date(infoDialogItem.purchasedAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Tag className="h-3.5 w-3.5" />
                      Price Paid
                    </div>
                    <p className="text-white font-medium">
                      {infoDialogItem.pricePaid === 0 ? (
                        <span className="text-green-400">FREE</span>
                      ) : (
                        <span>
                          ⚡ {infoDialogItem.pricePaid.toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Usage Stats */}
                {infoDialogItem.item?.category !== "cosmetic" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        Total Usage
                      </div>
                      <p className="text-white font-medium">
                        {Math.floor(infoDialogItem.totalUsageTime / 60)}h{" "}
                        {infoDialogItem.totalUsageTime % 60}m
                      </p>
                    </div>
                    {infoDialogItem.item?.category === "trading_bot" && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                          <Activity className="h-3.5 w-3.5" />
                          Trades Executed
                        </div>
                        <p className="text-white font-medium">
                          {infoDialogItem.totalTradesExecuted}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {infoDialogItem.item?.tags &&
                  infoDialogItem.item.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {infoDialogItem.item.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInfoDialogItem(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
              {selectedPurchase.item.category === "trading_bot" && (
                <BotSettingsForm
                  settings={editedSettings}
                  onChange={setEditedSettings}
                  strategyType={selectedPurchase.item.strategyType}
                />
              )}

              {/* Indicator-specific settings */}
              {selectedPurchase.item.category === "indicator" && (
                <IndicatorSettingsForm
                  settings={editedSettings}
                  onChange={setEditedSettings}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* GM Cancel Confirmation Modal */}
      {showGmCancelConfirm && gmSubscription && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Cancel Subscription?
                </h3>
                <p className="text-sm text-gray-400">
                  Schedule for deletion after expiry
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-sm text-emerald-400">
                  ✓ Continue earning referral fees until{" "}
                  {new Date(gmSubscription.endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-sm text-orange-400">
                  ⚠ Pack will be deleted after expiry
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGmCancelConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
              >
                Keep
              </button>
              <button
                onClick={toggleGmScheduledCancellation}
                disabled={schedulingGmCancel}
                className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {schedulingGmCancel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Schedule Deletion</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Game Master Subscription Card Component
function GameMasterSubscriptionCard({
  subscription,
  onTogglePause,
  onScheduleCancel,
  onUnscheduleCancel,
  togglingPause,
  schedulingCancel,
}: {
  subscription: GameMasterSubscription;
  onTogglePause: () => void;
  onScheduleCancel: () => void;
  onUnscheduleCancel: () => void;
  togglingPause: boolean;
  schedulingCancel: boolean;
}) {
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(subscription.endDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const isExpired = subscription.status !== "active" || daysRemaining === 0;
  const isPaused = subscription.isPaused;
  const isScheduledForDeletion = subscription.scheduledForDeletion;

  return (
    <Card
      className={cn(
        "bg-gray-900/80 border transition-all",
        isExpired
          ? "border-red-500/30"
          : isPaused
            ? "border-yellow-500/30"
            : isScheduledForDeletion
              ? "border-orange-500/30"
              : "border-yellow-500/30 hover:border-yellow-500/50",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                isExpired
                  ? "bg-red-500/20"
                  : isPaused
                    ? "bg-yellow-500/20"
                    : "bg-yellow-500/20",
              )}
            >
              <Crown
                className={cn(
                  "h-5 w-5",
                  isExpired
                    ? "text-red-400"
                    : isPaused
                      ? "text-yellow-400"
                      : "text-yellow-400",
                )}
              />
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-2">
                {subscription.packageName}
                {isPaused && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                    PAUSED
                  </span>
                )}
                {isScheduledForDeletion && (
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                    ENDING
                  </span>
                )}
              </h4>
              <p className="text-sm text-gray-400">
                {subscription.limits?.canCreateCompetitions
                  ? "Create competitions & earn referrals"
                  : `Earn ${subscription.limits?.referralFeePercentage || 5}% from referrals`}
              </p>
            </div>
          </div>

          <Link href="/gamemaster">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            >
              Dashboard <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Days Left</p>
            <p
              className={cn(
                "text-lg font-bold",
                daysRemaining <= 3
                  ? "text-red-400"
                  : daysRemaining <= 7
                    ? "text-yellow-400"
                    : "text-white",
              )}
            >
              {daysRemaining}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Earnings</p>
            <p className="text-lg font-bold text-emerald-400">
              ⚡ {subscription.totalEarnings}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Referrals</p>
            <p className="text-lg font-bold text-blue-400">
              {subscription.totalReferredUsers}
            </p>
          </div>
        </div>

        {/* Controls */}
        {!isExpired && (
          <div className="flex gap-2 pt-3 border-t border-gray-800">
            {/* Pause/Resume Button */}
            <button
              onClick={onTogglePause}
              disabled={togglingPause}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                isPaused
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                  : "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/30",
              )}
            >
              {togglingPause ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPaused ? (
                <>
                  <Play className="h-4 w-4" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              )}
            </button>

            {/* Cancel/Uncancel Button */}
            {isScheduledForDeletion ? (
              <button
                onClick={onUnscheduleCancel}
                disabled={schedulingCancel}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50"
              >
                {schedulingCancel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Keep Active</>
                )}
              </button>
            ) : (
              <button
                onClick={onScheduleCancel}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 border border-gray-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>
        )}

        {/* Warning for paused */}
        {isPaused && !isExpired && (
          <p className="text-xs text-yellow-400/80 mt-3 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Not receiving referral fees while paused
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Purchase Card Component
function PurchaseCard({
  purchase,
  onToggle,
  onSettings,
  onInfo,
}: {
  purchase: Purchase;
  onToggle: () => void;
  onSettings: () => void;
  onInfo: () => void;
}) {
  const CategoryIcon = getCategoryIcon(purchase.item.category);

  return (
    <Card
      className={cn(
        "bg-gray-900/80 border transition-all",
        purchase.isEnabled
          ? "border-cyan-500/30 hover:border-cyan-500/50"
          : "border-gray-700 hover:border-gray-600",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                purchase.isEnabled ? "bg-cyan-500/20" : "bg-gray-800",
              )}
            >
              <CategoryIcon
                className={cn(
                  "h-5 w-5",
                  purchase.isEnabled ? "text-cyan-400" : "text-gray-500",
                )}
              />
            </div>
            <div>
              <h4 className="font-semibold text-white">{purchase.item.name}</h4>
              <p className="text-sm text-gray-400">
                {purchase.item.shortDescription}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onInfo}
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 gap-1.5"
            >
              <Info className="h-4 w-4" />
              <span className="text-xs">Info</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="text-gray-400 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <button
              onClick={onToggle}
              className={cn(
                "p-2 rounded-lg transition-colors",
                purchase.isEnabled
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  : "bg-gray-800 text-gray-500 hover:bg-gray-700",
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
          {purchase.item.category === "trading_bot" && (
            <div className="flex items-center gap-1 text-gray-400">
              <Activity className="h-3.5 w-3.5" />
              <span>{purchase.totalTradesExecuted} trades</span>
            </div>
          )}
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-xs",
              purchase.isEnabled
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-800 text-gray-500",
            )}
          >
            {purchase.isEnabled ? "Active" : "Inactive"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Cosmetic Card Component for Avatars and other cosmetics
function CosmeticCard({
  purchase,
  onApply,
  onInfo,
  isApplying,
  isCurrentItem,
  applyLabel = "Apply Avatar",
  appliedLabel = "Applied",
}: {
  purchase: Purchase;
  onApply: () => void;
  onInfo: () => void;
  isApplying: boolean;
  isCurrentItem: boolean;
  applyLabel?: string;
  appliedLabel?: string;
}) {
  return (
    <Card
      className={cn(
        "bg-gray-900/80 border transition-all group",
        isCurrentItem
          ? "border-pink-500/50 ring-2 ring-pink-500/30"
          : "border-gray-700 hover:border-pink-500/30",
      )}
    >
      <CardContent className="p-3">
        {/* Avatar Image */}
        <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-800">
          {purchase.item?.imageUrl ? (
            <img
              src={purchase.item.imageUrl}
              alt={purchase.item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-12 h-12 text-gray-600" />
            </div>
          )}

          {/* Info Button - Always Visible */}
          <button
            onClick={onInfo}
            className="absolute top-2 left-2 bg-cyan-500/90 hover:bg-cyan-400 rounded-full p-1.5 shadow-lg shadow-cyan-500/30 transition-all hover:scale-110"
            title="View Details"
          >
            <Info className="w-4 h-4 text-white" />
          </button>

          {/* Current Item Badge */}
          {isCurrentItem && (
            <div className="absolute top-2 right-2 bg-pink-500 rounded-full p-1">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Name & Description */}
        <h4 className="font-semibold text-white text-sm mb-1 line-clamp-1">
          {purchase.item?.name || "Unknown"}
        </h4>
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {purchase.item?.shortDescription || "Cosmetic"}
        </p>

        {/* Apply Button */}
        <Button
          onClick={onApply}
          disabled={isApplying || isCurrentItem}
          className={cn(
            "w-full",
            isCurrentItem
              ? "bg-pink-500/20 text-pink-400 border border-pink-500/30 cursor-default"
              : "bg-pink-500 hover:bg-pink-600 text-white",
          )}
          size="sm"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : isCurrentItem ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              {appliedLabel}
            </>
          ) : (
            <>
              <User className="w-4 h-4 mr-2" />
              {applyLabel}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Frame Card Component for Profile Frames
function FrameCard({
  purchase,
  onApply,
  onInfo,
  isApplying,
  isCurrentFrame,
}: {
  purchase: Purchase;
  onApply: () => void;
  onInfo: () => void;
  isApplying: boolean;
  isCurrentFrame: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-gray-900/80 border transition-all group",
        isCurrentFrame
          ? "border-purple-500/50 ring-2 ring-purple-500/30"
          : "border-gray-700 hover:border-purple-500/30",
      )}
    >
      <CardContent className="p-3">
        {/* Frame Preview */}
        <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
          {/* Demo Avatar in Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[60%] h-[60%] rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
              <User className="w-8 h-8 text-cyan-400/50" />
            </div>
          </div>

          {/* Frame Overlay */}
          {purchase.item?.imageUrl && (
            <img
              src={purchase.item.imageUrl}
              alt={purchase.item.name}
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          )}

          {/* Info Button */}
          <button
            onClick={onInfo}
            className="absolute top-2 left-2 bg-purple-500/90 hover:bg-purple-400 rounded-full p-1.5 shadow-lg shadow-purple-500/30 transition-all hover:scale-110 z-20"
            title="View Details"
          >
            <Info className="w-4 h-4 text-white" />
          </button>

          {/* Current Frame Badge */}
          {isCurrentFrame && (
            <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1 z-20">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Name & Description */}
        <h4 className="font-semibold text-white text-sm mb-1 line-clamp-1">
          {purchase.item?.name || "Unknown"}
        </h4>
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {purchase.item?.shortDescription || "Profile Frame"}
        </p>

        {/* Apply Button */}
        <Button
          onClick={onApply}
          disabled={isApplying || isCurrentFrame}
          className={cn(
            "w-full",
            isCurrentFrame
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 cursor-default"
              : "bg-purple-500 hover:bg-purple-600 text-white",
          )}
          size="sm"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : isCurrentFrame ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Applied
            </>
          ) : (
            <>
              <Palette className="w-4 h-4 mr-2" />
              Apply Frame
            </>
          )}
        </Button>
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
              value={settings.asset || "AAPL"}
              onValueChange={(v) => updateSetting("asset", v)}
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
              onChange={(e) =>
                updateSetting("positionSizePercent", parseInt(e.target.value))
              }
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
              onChange={(e) =>
                updateSetting("maxPositions", parseInt(e.target.value))
              }
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
              onChange={(e) =>
                updateSetting("leverage", parseInt(e.target.value))
              }
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
              onChange={(e) =>
                updateSetting("takeProfit", parseFloat(e.target.value))
              }
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
              onChange={(e) =>
                updateSetting("stopLoss", parseFloat(e.target.value))
              }
              min={0.1}
              step={0.1}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <div>
            <Label className="text-white">Trailing Stop</Label>
            <p className="text-xs text-gray-400">
              Move stop loss as price moves in your favor
            </p>
          </div>
          <Switch
            checked={settings.trailingStop || false}
            onCheckedChange={(v) => updateSetting("trailingStop", v)}
          />
        </div>
      </div>

      {/* Strategy-specific settings */}
      {strategyType === "moving_average" && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Moving Average Settings
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>MA Type</Label>
              <Select
                value={settings.maType || "SMA"}
                onValueChange={(v) => updateSetting("maType", v)}
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
                onChange={(e) =>
                  updateSetting("maPeriod", parseInt(e.target.value))
                }
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
              onChange={(e) =>
                updateSetting("signalThreshold", parseFloat(e.target.value))
              }
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

      {strategyType === "rsi" && (
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
                onChange={(e) =>
                  updateSetting("rsiPeriod", parseInt(e.target.value))
                }
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
                onChange={(e) =>
                  updateSetting("overboughtLevel", parseInt(e.target.value))
                }
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
                onChange={(e) =>
                  updateSetting("oversoldLevel", parseInt(e.target.value))
                }
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
            onCheckedChange={(v) => updateSetting("tradingHoursEnabled", v)}
          />
        </div>

        {settings.tradingHoursEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Hour</Label>
              <Input
                type="number"
                value={settings.tradingStartHour || 9}
                onChange={(e) =>
                  updateSetting("tradingStartHour", parseInt(e.target.value))
                }
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
                onChange={(e) =>
                  updateSetting("tradingEndHour", parseInt(e.target.value))
                }
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
          onChange={(e) => updateSetting("period", parseInt(e.target.value))}
          min={1}
          max={200}
          className="bg-gray-800 border-gray-700"
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <Label className="text-white">Show on Chart</Label>
          <p className="text-xs text-gray-400">
            Display indicator overlay on price chart
          </p>
        </div>
        <Switch
          checked={settings.showOnChart !== false}
          onCheckedChange={(v) => updateSetting("showOnChart", v)}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <Label className="text-white">Show Panel</Label>
          <p className="text-xs text-gray-400">
            Display indicator in separate panel
          </p>
        </div>
        <Switch
          checked={settings.showPanel !== false}
          onCheckedChange={(v) => updateSetting("showPanel", v)}
        />
      </div>
    </div>
  );
}
