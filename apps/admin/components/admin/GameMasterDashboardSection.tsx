'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  Trophy, 
  Link, 
  Copy, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus
} from 'lucide-react';

interface DashboardStats {
  totalReferredUsers: number;
  totalCompetitions: number;
  activeCompetitions: number;
  totalEarnings: number;
  paidEarnings: number;
  pendingEarnings: number;
  totalTransactions: number;
}

interface Subscription {
  id: string;
  packageName: string;
  status: string;
  referralCode: string;
  referralLink: string;
  startDate: string;
  endDate: string;
  nextRenewalDate: string;
  autoRenew: boolean;
  renewalPrice: number;
  daysRemaining: number;
  limits: {
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
    referralFeePercentage: number;
  };
  currentPeriodCompetitionsCreated: number;
}

interface Referral {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  image?: string;
}

interface Competition {
  id: string;
  name: string;
  status: string;
  participants: number;
  prizePool: number;
  startTime: string;
  endTime: string;
}

interface Earning {
  id: string;
  sourceType: string;
  sourceName: string;
  referredUserName: string;
  entryFeeAmount: number;
  netEarning: number;
  status: string;
  createdAt: string;
}

interface DashboardData {
  subscription: Subscription;
  stats: DashboardStats;
  recentReferrals: Referral[];
  recentCompetitions: Competition[];
  recentEarnings: Earning[];
}

export default function GameMasterDashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gamemaster/dashboard');
      if (response.status === 401) {
        setError('not_gamemaster');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const copyReferralLink = async () => {
    if (!data?.subscription.referralLink) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(data.subscription.referralLink);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      setCopying(false);
    }
  };

  const regenerateLink = async () => {
    if (!confirm('Are you sure you want to regenerate your referral link? Your old link will stop working.')) {
      return;
    }
    setRegenerating(true);
    try {
      const response = await fetch('/api/gamemaster/link', { method: 'POST' });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to regenerate link:', err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error === 'not_gamemaster') {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-8">
          <Trophy className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Game Master Access Required</h2>
          <p className="text-gray-400 mb-6">
            This dashboard is for Game Masters only. To become a Game Master, purchase a Game Master package from the Marketplace and activate it.
          </p>
          <div className="space-y-3 text-left bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-300 font-semibold">How to become a Game Master:</p>
            <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
              <li>Go to the main platform Marketplace</li>
              <li>Purchase a Game Master package</li>
              <li>Activate it in your Trading Arsenal</li>
              <li>Return here to access your dashboard</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">{error}</p>
        <button 
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { subscription, stats, recentReferrals, recentCompetitions, recentEarnings } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Game Master Dashboard</h2>
          <p className="text-gray-400">
            Package: {subscription.packageName} • {subscription.daysRemaining} days remaining
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Referral Link Card */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-700/50">
        <div className="flex items-center gap-2 mb-4">
          <Link className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Your Referral Link</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-900/50 rounded px-4 py-3 font-mono text-sm text-gray-300 break-all">
            {subscription.referralLink}
          </div>
          <button
            onClick={copyReferralLink}
            disabled={copying}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {copying ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={regenerateLink}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-3 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            New Link
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-400">
          Referral Code: <span className="font-mono text-blue-400">{subscription.referralCode}</span> • 
          Earn {subscription.limits.referralFeePercentage}% of entry fees from users who sign up with your link
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalReferredUsers}</p>
              <p className="text-sm text-gray-400">Referred Users</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{(stats.totalEarnings ?? 0).toFixed(2)}</p>
              <p className="text-sm text-gray-400">Total Earnings</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-900/50 rounded">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{(stats.pendingEarnings ?? 0).toFixed(2)}</p>
              <p className="text-sm text-gray-400">Pending Payout</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded">
              <Trophy className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalCompetitions}</p>
              <p className="text-sm text-gray-400">Competitions Created</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Subscription Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-gray-400 text-sm">Status</p>
            <p className={`text-lg font-medium ${subscription.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Auto-Renewal</p>
            <p className={`text-lg font-medium ${subscription.autoRenew ? 'text-green-400' : 'text-yellow-400'}`}>
              {subscription.autoRenew ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Renewal Price</p>
            <p className="text-lg font-medium text-white">{subscription.renewalPrice} Credits</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">End Date</p>
            <p className="text-lg font-medium text-white">
              {new Date(subscription.endDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Competitions Today</p>
            <p className="text-lg font-medium text-white">
              {subscription.currentPeriodCompetitionsCreated} / {subscription.limits.maxCompetitionsPerDay}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Max Users per Competition</p>
            <p className="text-lg font-medium text-white">{subscription.limits.maxUsersPerCompetition}</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Referrals */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Referrals</h3>
            <button className="text-blue-400 text-sm hover:text-blue-300">View All</button>
          </div>
          {recentReferrals.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No referrals yet. Share your link!</p>
          ) : (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div key={referral.id} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
                    {referral.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{referral.name}</p>
                    <p className="text-gray-400 text-sm truncate">{referral.email}</p>
                    <p className="text-gray-500 text-xs font-mono mt-0.5">ID: {referral.id}</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {new Date(referral.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Earnings */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Earnings</h3>
            <button className="text-blue-400 text-sm hover:text-blue-300">View All</button>
          </div>
          {recentEarnings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No earnings yet. Refer users to competitions!</p>
          ) : (
            <div className="space-y-3">
              {recentEarnings.map((earning) => (
                <div key={earning.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded">
                  <div>
                    <p className="text-white font-medium">{earning.sourceName}</p>
                    <p className="text-gray-400 text-sm">
                      From {earning.referredUserName} • {earning.sourceType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">+{(earning.netEarning ?? 0).toFixed(2)}</p>
                    <p className={`text-sm ${earning.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {earning.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Competitions */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Your Competitions</h3>
          <button 
            disabled={subscription.currentPeriodCompetitionsCreated >= subscription.limits.maxCompetitionsPerDay}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Create Competition
          </button>
        </div>
        {recentCompetitions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No competitions created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Participants</th>
                  <th className="pb-3">Prize Pool</th>
                  <th className="pb-3">Start</th>
                  <th className="pb-3">End</th>
                </tr>
              </thead>
              <tbody>
                {recentCompetitions.map((comp) => (
                  <tr key={comp.id} className="border-b border-gray-700/50">
                    <td className="py-3 text-white">{comp.name}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        comp.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        comp.status === 'upcoming' ? 'bg-blue-900/50 text-blue-400' :
                        comp.status === 'completed' ? 'bg-gray-700 text-gray-300' :
                        'bg-red-900/50 text-red-400'
                      }`}>
                        {comp.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300">{comp.participants}</td>
                    <td className="py-3 text-gray-300">{comp.prizePool} Credits</td>
                    <td className="py-3 text-gray-400 text-sm">
                      {new Date(comp.startTime).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-400 text-sm">
                      {new Date(comp.endTime).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
