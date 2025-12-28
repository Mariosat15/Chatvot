'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Swords,
  DollarSign,
  Clock,
  Trophy,
  Loader2,
  Target,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const [settings, setSettings] = useState<ChallengeSettings | null>(null);
  const [formData, setFormData] = useState({
    entryFee: 10,
    duration: 60,
    startingCapital: 10000,
    rankingMethod: 'pnl',
    tieBreaker1: 'trades_count',
    tieBreaker2: '',
    minimumTrades: 1,
  });

  // Market status state - challenges require market to be open
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    message: string;
    loading: boolean;
  }>({
    isOpen: true,
    message: '',
    loading: true,
  });

  // Fetch challenge settings and market status
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/challenges/settings');
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
        console.error('Failed to fetch settings:', error);
      }
    };

    const fetchMarketStatus = async () => {
      try {
        const res = await fetch('/api/trading/market-status');
        if (res.ok) {
          const data = await res.json();
          const isOpen = data.isOpen ?? data.status?.toLowerCase() === 'open';
          setMarketStatus({
            isOpen,
            message: isOpen 
              ? 'Forex market is open' 
              : `Forex market is ${data.status || 'closed'}`,
            loading: false,
          });
        } else {
          // Fallback: use time-based check
          const now = new Date();
          const utcDay = now.getUTCDay();
          const utcHour = now.getUTCHours();
          
          // Forex closed: Saturday all day, Sunday before 10pm UTC, Friday after 10pm UTC
          const isClosed = utcDay === 6 || 
            (utcDay === 0 && utcHour < 22) || 
            (utcDay === 5 && utcHour >= 22);
          
          setMarketStatus({
            isOpen: !isClosed,
            message: isClosed ? 'Forex market is closed (Weekend)' : 'Forex market is open',
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch market status:', error);
        // Fallback on error
        const now = new Date();
        const utcDay = now.getUTCDay();
        const utcHour = now.getUTCHours();
        const isClosed = utcDay === 6 || 
          (utcDay === 0 && utcHour < 22) || 
          (utcDay === 5 && utcHour >= 22);
        
        setMarketStatus({
          isOpen: !isClosed,
          message: isClosed ? 'Forex market is closed (Weekend)' : 'Forex market is open',
          loading: false,
        });
      }
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

    setLoading(true);
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengedId: challengedUser.userId,
          entryFee: formData.entryFee,
          duration: formData.duration,
          startingCapital: formData.startingCapital,
          rankingMethod: formData.rankingMethod,
          tieBreaker1: formData.tieBreaker1,
          tieBreaker2: formData.tieBreaker2 || undefined,
          minimumTrades: formData.minimumTrades,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create challenge');
      }

      toast.success(`Challenge sent to ${challengedUser.username}!`);
      onOpenChange(false);
      router.push('/challenges');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send challenge');
    } finally {
      setLoading(false);
    }
  };

  if (!challengedUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-orange-500/50 max-sm:border-0" fullScreenMobile size="sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Swords className="h-5 w-5 text-orange-500" />
            Challenge {challengedUser.username}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a 1v1 trading battle. Winner takes all!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Entry Fee */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              Entry Fee (Credits)
            </Label>
            <Input
              type="number"
              min={settings?.minEntryFee || 5}
              max={settings?.maxEntryFee || 1000}
              value={formData.entryFee}
              onChange={(e) =>
                setFormData({ ...formData, entryFee: parseInt(e.target.value) || 0 })
              }
              className="bg-gray-800 border-gray-600 text-white"
            />
            <p className="text-xs text-gray-500">
              Both players pay this amount
            </p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Duration (Minutes)
            </Label>
            <Input
              type="number"
              min={settings?.minDurationMinutes || 15}
              max={settings?.maxDurationMinutes || 1440}
              value={formData.duration}
              onChange={(e) =>
                setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })
              }
              className="bg-gray-800 border-gray-600 text-white"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {[15, 30, 60, 120, 240].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration: mins })}
                  className={`px-3 py-1 text-xs rounded-full ${
                    formData.duration === mins
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Ranking Method */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-400" />
              Ranking Method
            </Label>
            <select
              value={formData.rankingMethod}
              onChange={(e) =>
                setFormData({ ...formData, rankingMethod: e.target.value })
              }
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-md p-2"
            >
              <option value="pnl">P&L (Profit & Loss)</option>
              <option value="roi">ROI (Return on Investment)</option>
              <option value="total_capital">Total Capital</option>
              <option value="win_rate">Win Rate</option>
              <option value="total_wins">Total Wins</option>
              <option value="profit_factor">Profit Factor</option>
            </select>
          </div>

          {/* Tiebreakers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Tiebreaker 1</Label>
              <select
                value={formData.tieBreaker1}
                onChange={(e) =>
                  setFormData({ ...formData, tieBreaker1: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-md p-2 text-sm"
              >
                <option value="trades_count">Most Trades</option>
                <option value="win_rate">Higher Win Rate</option>
                <option value="total_capital">Higher Capital</option>
                <option value="roi">Higher ROI</option>
                <option value="join_time">First to Join</option>
                <option value="split_prize">Split Prize</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Tiebreaker 2 (Optional)</Label>
              <select
                value={formData.tieBreaker2}
                onChange={(e) =>
                  setFormData({ ...formData, tieBreaker2: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-md p-2 text-sm"
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
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Target className="h-4 w-4 text-red-400" />
              Minimum Trades to Qualify
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={formData.minimumTrades}
              onChange={(e) =>
                setFormData({ ...formData, minimumTrades: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="bg-gray-800 border-gray-600 text-white"
            />
            <p className="text-xs text-gray-500">
              Players must complete at least this many trades or be disqualified
            </p>
          </div>

          {/* Prize Pool Summary */}
          <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Prize Pool
              </span>
              <span className="text-xl font-bold text-yellow-400">
                {prizePool} credits
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Platform Fee ({platformFee}%)</span>
                <span className="text-red-400">-{platformFeeAmount} credits</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-white font-semibold flex items-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Winner Takes
                </span>
                <span className="text-green-400 font-bold text-lg">
                  {winnerPrize} credits
                </span>
              </div>
            </div>
          </div>

          {/* Market Status Warning */}
          {!marketStatus.loading && !marketStatus.isOpen && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Market Closed</p>
                  <p className="text-xs text-red-300 mt-1">
                    {marketStatus.message || 'Forex market is currently closed.'}
                    {' '}Challenges cannot be created while the market is closed because trading is not available.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs text-yellow-300">
              ⚠️ Credits will only be deducted if {challengedUser.username} accepts the challenge.
              Both players need at least {formData.minimumTrades} trade{formData.minimumTrades > 1 ? 's' : ''} to qualify - otherwise they get disqualified!
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || formData.entryFee < 1 || !marketStatus.isOpen}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
    </Dialog>
  );
}

