'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Crown, 
  Copy, 
  Check, 
  Users, 
  TrendingUp, 
  Calendar, 
  Percent,
  Trophy,
  Link2,
  RefreshCw,
  Zap,
  Clock,
  Shield,
  Gift,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GameMasterData {
  subscription: {
    _id: string;
    status: string;
    packageName: string;
    referralCode: string;
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    renewalPrice: number;
    limits: {
      maxCompetitionsPerDay: number;
      maxUsersPerCompetition: number;
      referralFeePercentage: number;
    };
    currentPeriodCompetitionsCreated: number;
    totalCompetitionsCreated: number;
    totalEarnings: number;
    pendingEarnings: number;
    totalReferredUsers: number;
    activeReferredUsers: number;
  } | null;
  referredUsers: Array<{
    _id: string;
    name: string;
    email: string;
    createdAt: string;
  }>;
  recentEarnings: Array<{
    _id: string;
    amount: number;
    source: string;
    createdAt: string;
  }>;
}

export default function GameMasterDashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GameMasterData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [togglingRenewal, setTogglingRenewal] = useState(false);

  useEffect(() => {
    fetchGameMasterData();
  }, []);

  const fetchGameMasterData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gamemaster/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        // User is not a Game Master
        setData({ subscription: null, referredUsers: [], recentEarnings: [] });
      }
    } catch (error) {
      console.error('Error fetching GM data:', error);
      toast.error('Failed to load Game Master data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const toggleAutoRenew = async () => {
    if (!data?.subscription) return;
    
    try {
      setTogglingRenewal(true);
      const response = await fetch('/api/gamemaster/toggle-renewal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: !data.subscription.autoRenew }),
      });
      
      const result = await response.json();
      if (result.success) {
        setData(prev => prev ? {
          ...prev,
          subscription: prev.subscription ? {
            ...prev.subscription,
            autoRenew: !prev.subscription.autoRenew,
          } : null,
        } : null);
        toast.success(`Auto-renewal ${!data.subscription.autoRenew ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(result.error || 'Failed to update auto-renewal');
      }
    } catch (error) {
      console.error('Error toggling auto-renewal:', error);
      toast.error('Failed to update auto-renewal');
    } finally {
      setTogglingRenewal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
          <p className="text-gray-400">Loading Game Master Dashboard...</p>
        </div>
      </div>
    );
  }

  // Not a Game Master - show upgrade prompt
  if (!data?.subscription) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 mb-8">
              <Crown className="h-12 w-12 text-yellow-400" />
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">
              Become a Game Master
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Create competitions, build your trading community, and earn from referrals. 
              Unlock the power of Game Master status today!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <Trophy className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Create Competitions</h3>
                <p className="text-gray-400 text-sm">Host your own trading competitions for your community</p>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <Users className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Grow Your Community</h3>
                <p className="text-gray-400 text-sm">Refer traders and build your trading network</p>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <TrendingUp className="h-10 w-10 text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Earn Rewards</h3>
                <p className="text-gray-400 text-sm">Get a percentage of entry fees from your referrals</p>
              </div>
            </div>
            
            <Link
              href="/marketplace?category=gamemaster"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-bold text-lg rounded-2xl transition-all shadow-lg shadow-yellow-500/20"
            >
              <ShoppingBag className="h-6 w-6" />
              View Game Master Packages
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sub = data.subscription;
  const daysRemaining = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/sign-up?ref=${sub.referralCode}`;
  const isExpired = sub.status !== 'active' || daysRemaining === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-amber-500/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                <Crown className="h-8 w-8 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  Game Master Dashboard
                  <span className={cn(
                    'px-3 py-1 rounded-full text-sm font-semibold',
                    isExpired 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-emerald-500/20 text-emerald-400'
                  )}>
                    {isExpired ? 'Expired' : 'Active'}
                  </span>
                </h1>
                <p className="text-gray-400 mt-1">{sub.packageName}</p>
              </div>
            </div>
            
            <button
              onClick={fetchGameMasterData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Warning for expired subscription */}
        {isExpired && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400">Your Game Master subscription has expired</h3>
              <p className="text-gray-400 text-sm mt-1">
                Renew your subscription to continue creating competitions and earning from referrals.
              </p>
              <Link
                href="/marketplace?category=gamemaster"
                className="inline-flex items-center gap-2 mt-3 text-yellow-400 hover:text-yellow-300 font-medium"
              >
                Renew Subscription <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Referral Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-2xl p-6 border border-yellow-500/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-yellow-400" />
              Your Referral Link
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Share this link to invite new traders. You'll earn <span className="text-emerald-400 font-semibold">{sub.limits.referralFeePercentage}%</span> of their competition entry fees!
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Referral Code */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Referral Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-900 rounded-xl px-4 py-3 font-mono text-xl text-yellow-400 border border-gray-700">
                    {sub.referralCode}
                  </div>
                  <button
                    onClick={() => copyToClipboard(sub.referralCode, 'code')}
                    className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    {copiedCode ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>
              
              {/* Full Referral Link */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Full Referral Link</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-900 rounded-xl px-4 py-3 text-sm text-gray-300 border border-gray-700 truncate">
                    {referralLink}
                  </div>
                  <button
                    onClick={() => copyToClipboard(referralLink, 'link')}
                    className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    {copiedLink ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm text-gray-400">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-white">⚡ {sub.totalEarnings.toLocaleString()}</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Referred Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{sub.totalReferredUsers}</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Trophy className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Competitions Created</span>
            </div>
            <p className="text-2xl font-bold text-white">{sub.totalCompetitionsCreated}</p>
          </div>
          
          <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Calendar className="h-5 w-5 text-yellow-400" />
              </div>
              <span className="text-sm text-gray-400">Days Remaining</span>
            </div>
            <p className="text-2xl font-bold text-white">{daysRemaining}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Subscription Details */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-400" />
              Subscription Details
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                <span className="text-gray-400">Package</span>
                <span className="text-white font-medium">{sub.packageName}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                <span className="text-gray-400">Competitions/Day</span>
                <span className="text-white font-medium">
                  {sub.currentPeriodCompetitionsCreated} / {sub.limits.maxCompetitionsPerDay}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                <span className="text-gray-400">Max Users/Competition</span>
                <span className="text-white font-medium">{sub.limits.maxUsersPerCompetition}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                <span className="text-gray-400">Referral Fee</span>
                <span className="text-emerald-400 font-medium">{sub.limits.referralFeePercentage}%</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                <span className="text-gray-400">Expires</span>
                <span className="text-white font-medium">
                  {new Date(sub.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-400">Auto-Renewal</span>
                <button
                  onClick={toggleAutoRenew}
                  disabled={togglingRenewal}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    sub.autoRenew ? 'bg-emerald-500' : 'bg-gray-600'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    sub.autoRenew ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
            </div>
            
            {sub.autoRenew && (
              <p className="text-sm text-gray-500 mt-4">
                <Clock className="h-4 w-4 inline mr-1" />
                Auto-renews for ⚡ {sub.renewalPrice.toLocaleString()} credits on {new Date(sub.endDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Package Limits / Create Competition */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Quick Actions
            </h2>
            
            <div className="space-y-4">
              {/* Today's Usage */}
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Today's Competitions</span>
                  <span className="text-white font-medium">
                    {sub.currentPeriodCompetitionsCreated} / {sub.limits.maxCompetitionsPerDay}
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all"
                    style={{ 
                      width: `${Math.min(100, (sub.currentPeriodCompetitionsCreated / sub.limits.maxCompetitionsPerDay) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <Link
                href="/competitions"
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl transition-all',
                  isExpired 
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 hover:from-yellow-500/20 hover:to-amber-500/20 text-white border border-yellow-500/20'
                )}
                onClick={(e) => isExpired && e.preventDefault()}
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <div>
                    <p className="font-medium">Create Competition</p>
                    <p className="text-sm text-gray-400">Host a new trading competition</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Link>

              <Link
                href="/leaderboard"
                className="flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-900 rounded-xl transition-all text-white"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="font-medium">View Leaderboard</p>
                    <p className="text-sm text-gray-400">See top traders and your referrals</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Link>

              <Link
                href="/wallet"
                className="flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-900 rounded-xl transition-all text-white"
              >
                <div className="flex items-center gap-3">
                  <Gift className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="font-medium">View Earnings</p>
                    <p className="text-sm text-gray-400">Check your referral earnings</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Referred Users */}
        {data.referredUsers.length > 0 && (
          <div className="mt-8 bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Your Referred Users
              <span className="text-sm font-normal text-gray-400">
                ({data.referredUsers.length} total)
              </span>
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referredUsers.slice(0, 10).map((user) => (
                    <tr key={user._id} className="border-b border-gray-700/50">
                      <td className="py-4">
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
