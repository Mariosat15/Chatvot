"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Swords,
  DollarSign,
  Clock,
  Trophy,
  Loader2,
  Target,
  Zap,
  AlertTriangle,
  Shield,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";

interface ChallengeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengedUser: {
    userId: string;
    username: string;
  } | null;
}

interface ChallengeSettings {
  minEntryFee: number;
  maxEntryFee: number;
  defaultStartingCapital: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  defaultDurationMinutes: number;
  platformFeePercentage: number;
}

export default function ChallengeCreateDialog({
  open,
  onOpenChange,
  challengedUser,
}: ChallengeCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [settings, setSettings] = useState<ChallengeSettings | null>(null);
  const [formData, setFormData] = useState({
    entryFee: 10,
    duration: 60,
    startingCapital: 10000,
    rankingMethod: "pnl",
    tieBreaker1: "trades_count",
    tieBreaker2: "",
    minimumTrades: 1,
    disqualifyOnLiquidation: true,
  });

  // Market status state
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    message: string;
    loading: boolean;
  }>({
    isOpen: true,
    message: "",
    loading: true,
  });

  // Fetch challenge settings and market status
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/challenges/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
          setFormData((prev) => ({
            ...prev,
            entryFee: data.settings.minEntryFee || 10,
            duration: data.settings.defaultDurationMinutes || 60,
            startingCapital: data.settings.defaultStartingCapital || 10000,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };

    const fetchMarketStatus = async () => {
      try {
        const res = await fetch("/api/trading/market-status");
        if (res.ok) {
          const data = await res.json();
          const isOpen = data.isOpen ?? data.status?.toLowerCase() === "open";
          setMarketStatus({
            isOpen,
            message: isOpen
              ? "Forex market is open"
              : `Forex market is ${data.status || "closed"}`,
            loading: false,
          });
        } else {
          fallbackMarketCheck();
        }
      } catch (error) {
        console.error("Failed to fetch market status:", error);
        fallbackMarketCheck();
      }
    };

    // Reason: Fallback time-based check when API is unavailable
    const fallbackMarketCheck = () => {
      const now = new Date();
      const utcDay = now.getUTCDay();
      const utcHour = now.getUTCHours();
      const isClosed =
        utcDay === 6 ||
        (utcDay === 0 && utcHour < 22) ||
        (utcDay === 5 && utcHour >= 22);
      setMarketStatus({
        isOpen: !isClosed,
        message: isClosed
          ? "Forex market is closed (Weekend)"
          : "Forex market is open",
        loading: false,
      });
    };

    if (open) {
      fetchSettings();
      fetchMarketStatus();
    }
  }, [open]);

  const platformFee = settings?.platformFeePercentage || 10;
  const prizePool = formData.entryFee * 2;
  const platformFeeAmount = Math.floor(prizePool * (platformFee / 100));
  const winnerPrize = prizePool - platformFeeAmount;

  const handleSubmit = async () => {
    if (!challengedUser) return;
    setShowTerms(true);
  };

  const proceedAfterTerms = async () => {
    setShowTerms(false);
    if (!challengedUser) return;

    setLoading(true);
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengedId: challengedUser.userId,
          entryFee: formData.entryFee,
          duration: formData.duration,
          startingCapital: formData.startingCapital,
          rankingMethod: formData.rankingMethod,
          tieBreaker1: formData.tieBreaker1,
          tieBreaker2: formData.tieBreaker2 || undefined,
          minimumTrades: formData.minimumTrades,
          disqualifyOnLiquidation: formData.disqualifyOnLiquidation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create challenge");
      }

      toast.success(`Challenge sent to ${challengedUser.username}!`);
      onOpenChange(false);
      router.push("/challenges");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send challenge",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!challengedUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-gray-950 border-orange-500/30 max-sm:border-0 p-0 gap-0 overflow-hidden"
        fullScreenMobile
        size="lg"
      >
        {/* ─── Themed Header ─── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-4 bg-gradient-to-br from-orange-600/20 via-gray-950 to-red-900/10 border-b border-orange-500/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-500 to-red-500 rounded-full blur-3xl opacity-10 -translate-y-16 translate-x-16" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Challenge {challengedUser.username}
              </h2>
              <p className="text-xs text-gray-400">
                1v1 Trading Battle &middot; Winner Takes All
              </p>
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-220px)] sm:max-h-[65vh] overflow-y-auto">
          {/* ═══ Two-column grid on desktop ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* ─── LEFT: Battle Settings ─── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  Battle Settings
                </span>
              </div>

              {/* Entry Fee */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-2 text-sm">
                  <DollarSign className="h-3.5 w-3.5 text-green-400" />
                  Entry Fee (Credits)
                </Label>
                <Input
                  type="number"
                  min={settings?.minEntryFee || 5}
                  max={settings?.maxEntryFee || 1000}
                  value={formData.entryFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      entryFee: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-gray-800/60 border-gray-700 text-white h-9"
                />
                <p className="text-[11px] text-gray-500">
                  Both players pay this amount
                </p>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  Duration (Minutes)
                </Label>
                <Input
                  type="number"
                  min={settings?.minDurationMinutes || 15}
                  max={settings?.maxDurationMinutes || 1440}
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: parseInt(e.target.value) || 60,
                    })
                  }
                  className="bg-gray-800/60 border-gray-700 text-white h-9"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[15, 30, 60, 120, 240].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, duration: mins })
                      }
                      className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                        formData.duration === mins
                          ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                      }`}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ranking Method */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-2 text-sm">
                  <Target className="h-3.5 w-3.5 text-purple-400" />
                  Ranking Method
                </Label>
                <select
                  value={formData.rankingMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rankingMethod: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-3 py-2 text-sm h-9 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 transition-colors"
                >
                  <option value="pnl">P&L (Profit &amp; Loss)</option>
                  <option value="roi">ROI (Return on Investment)</option>
                  <option value="total_capital">Total Capital</option>
                  <option value="win_rate">Win Rate</option>
                  <option value="total_wins">Total Wins</option>
                  <option value="profit_factor">Profit Factor</option>
                </select>
              </div>
            </div>

            {/* ─── RIGHT: Rules & Conditions ─── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  Rules & Conditions
                </span>
              </div>

              {/* Tiebreakers */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Tiebreaker 1</Label>
                  <select
                    value={formData.tieBreaker1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tieBreaker1: e.target.value,
                      })
                    }
                    className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-2.5 py-2 text-xs h-9 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
                  >
                    <option value="trades_count">Most Trades</option>
                    <option value="win_rate">Higher Win Rate</option>
                    <option value="total_capital">Higher Capital</option>
                    <option value="roi">Higher ROI</option>
                    <option value="join_time">First to Join</option>
                    <option value="split_prize">Split Prize</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">
                    Tiebreaker 2 (Opt.)
                  </Label>
                  <select
                    value={formData.tieBreaker2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tieBreaker2: e.target.value,
                      })
                    }
                    className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-2.5 py-2 text-xs h-9 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
                  >
                    <option value="">None</option>
                    <option value="trades_count">Most Trades</option>
                    <option value="win_rate">Higher Win Rate</option>
                    <option value="total_capital">Higher Capital</option>
                    <option value="roi">Higher ROI</option>
                    <option value="join_time">First to Join</option>
                    <option value="split_prize">Split Prize</option>
                  </select>
                </div>
              </div>

              {/* Minimum Trades */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 flex items-center gap-2 text-sm">
                  <Target className="h-3.5 w-3.5 text-red-400" />
                  Minimum Trades to Qualify
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.minimumTrades}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimumTrades: Math.max(
                        1,
                        parseInt(e.target.value) || 1,
                      ),
                    })
                  }
                  className="bg-gray-800/60 border-gray-700 text-white h-9"
                />
                <p className="text-[11px] text-gray-500">
                  Players must complete at least this many trades or get
                  disqualified
                </p>
              </div>

              {/* Disqualify on Liquidation — locked */}
              <div className="flex items-center justify-between bg-gray-800/40 rounded-xl p-3 border border-gray-700/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="text-sm text-gray-300">
                      Liquidation = Auto-Lose
                    </span>
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                      LOCKED
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 pl-5.5">
                    Always enabled for 1v1 challenges
                  </p>
                </div>
                <div
                  className="relative w-10 h-5 rounded-full bg-orange-500/80 cursor-not-allowed shrink-0 ml-3"
                  title="Locked for challenges"
                >
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full translate-x-5 shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Prize Pool Summary — full width ═══ */}
          <div className="relative overflow-hidden rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-950/40 via-gray-900/80 to-red-950/30">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Prize Pool */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      Total Prize Pool
                    </p>
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
                      {prizePool} credits
                    </p>
                  </div>
                </div>

                {/* Fee + Winner breakdown */}
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase">
                      Platform Fee
                    </p>
                    <p className="text-sm font-bold text-red-400">
                      -{platformFeeAmount}
                    </p>
                    <p className="text-[10px] text-gray-600">({platformFee}%)</p>
                  </div>
                  <div className="w-px h-8 bg-gray-700" />
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1 justify-center">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      Winner Takes
                    </p>
                    <p className="text-lg font-black text-green-400">
                      {winnerPrize}
                    </p>
                    <p className="text-[10px] text-gray-600">credits</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Warnings ═══ */}
          {!marketStatus.loading && !marketStatus.isOpen && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  Market Closed
                </p>
                <p className="text-xs text-red-300/80 mt-0.5">
                  {marketStatus.message || "Forex market is currently closed."}{" "}
                  Challenges cannot be created while the market is closed.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
            <span className="text-sm shrink-0 mt-px">⚠️</span>
            <p className="text-xs text-yellow-300/80">
              Credits are only deducted if{" "}
              <span className="font-semibold text-yellow-300">
                {challengedUser.username}
              </span>{" "}
              accepts. Both players need at least {formData.minimumTrades} trade
              {formData.minimumTrades > 1 ? "s" : ""} to qualify — otherwise
              they get disqualified!
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="px-6 py-4 border-t border-gray-800 bg-gray-950/80">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || formData.entryFee < 1 || !marketStatus.isOpen}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Swords className="h-4 w-4 mr-2" />
                Send Challenge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Action Terms Dialog */}
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.CHALLENGE}
        open={showTerms}
        onAccept={proceedAfterTerms}
        onDecline={() => setShowTerms(false)}
      />
    </Dialog>
  );
}
