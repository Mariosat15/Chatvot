'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  Trophy, 
  Search,
  RefreshCw, 
  Crown,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  Clock,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface GameMaster {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  packageName: string;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  referralCode: string;
  referralLink: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewalPrice: number;
  limits: {
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
    referralFeePercentage: number;
    canCreateCompetitions: boolean;
  };
  competitionCreationOverride?: 'enabled' | 'disabled' | null;
  overrideLimits?: {
    maxCompetitionsPerDay?: number;
    maxUsersPerCompetition?: number;
  };
  totalReferredUsers: number;
  totalEarnings: number;
  totalCompetitionsCreated: number;
  createdAt: string;
}

interface Stats {
  totalActive: number;
  totalExpired: number;
  totalSuspended: number;
  totalEarnings: number;
  totalReferrals: number;
  totalCompetitions: number;
}

interface DetailedGameMaster {
  subscription: GameMaster & {
    pendingEarnings: number;
    activeReferredUsers: number;
    renewalHistory: Array<{
      date: string;
      amount: number;
      status: string;
      failureReason?: string;
    }>;
    suspendedReason?: string;
  };
  referredUsers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    referredAt: string;
  }>;
  competitions: Array<{
    id: string;
    name: string;
    status: string;
    participants: number;
    prizePool: number;
    startTime: string;
    endTime: string;
  }>;
  earnings: Array<{
    id: string;
    sourceType: string;
    sourceName: string;
    referredUserName: string;
    entryFeeAmount: number;
    netEarning: number;
    status: string;
    createdAt: string;
  }>;
}

export default function GameMasterManagementSection() {
  const [gamemasters, setGamemasters] = useState<GameMaster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGM, setSelectedGM] = useState<DetailedGameMaster | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // State for competition override limits modal
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [limitsModalGM, setLimitsModalGM] = useState<GameMaster | null>(null);
  const [overrideLimits, setOverrideLimits] = useState({ maxCompetitionsPerDay: 1, maxUsersPerCompetition: 50 });

  const fetchGameMasters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const response = await fetch(`/api/gamemasters?${params}`);
      if (!response.ok) throw new Error('Failed to fetch game masters');
      
      const data = await response.json();
      setGamemasters(data.gamemasters);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchGameMasters();
  }, [fetchGameMasters]);

  const viewDetails = async (gmId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/gamemasters/${gmId}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      
      const data = await response.json();
      setSelectedGM(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (gmId: string, action: string, extraData?: Record<string, unknown>) => {
    // Skip confirmation for toggle actions (modal already serves as confirmation)
    if (action !== 'toggleCompetitionCreation') {
      if (!confirm(`Are you sure you want to ${action} this game master?`)) return;
    }
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/gamemasters/${gmId}`, {
        method: action === 'revoke' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Action failed');
      }
      
      await fetchGameMasters();
      if (selectedGM) {
        await viewDetails(gmId);
      }
      
      // Only show alert for non-toggle actions
      if (action !== 'toggleCompetitionCreation') {
        alert(`${action} successful`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-900/50 text-green-400';
      case 'expired': return 'bg-gray-700 text-gray-300';
      case 'suspended': return 'bg-red-900/50 text-red-400';
      case 'cancelled': return 'bg-red-900/50 text-red-400';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  // Detail view
  if (selectedGM) {
    const gm = selectedGM.subscription;
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(gm.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedGM(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to list
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-900/50 rounded-lg">
              <Crown className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{gm.userName}</h2>
              <p className="text-gray-400">{gm.userEmail}</p>
              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(gm.status)}`}>
                {gm.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Competition Creation Toggle */}
            {gm.status === 'active' && (() => {
              // Calculate effective state
              const packageAllows = gm.limits?.canCreateCompetitions !== false; // Default to true if undefined
              const hasOverride = gm.competitionCreationOverride === 'enabled' || gm.competitionCreationOverride === 'disabled';
              const isEffectivelyEnabled = hasOverride 
                ? gm.competitionCreationOverride === 'enabled'
                : packageAllows;
              
              return (
                <button
                  onClick={() => {
                    if (isEffectivelyEnabled) {
                      // Currently ON, turn OFF (set override to disabled)
                      handleAction(gm.id, 'toggleCompetitionCreation', { override: 'disabled' });
                    } else {
                      // Currently OFF, show modal to set limits before turning ON
                      setLimitsModalGM(gm);
                      setOverrideLimits({
                        maxCompetitionsPerDay: gm.overrideLimits?.maxCompetitionsPerDay || gm.limits?.maxCompetitionsPerDay || 1,
                        maxUsersPerCompetition: gm.overrideLimits?.maxUsersPerCompetition || gm.limits?.maxUsersPerCompetition || 50,
                      });
                      setShowLimitsModal(true);
                    }
                  }}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded disabled:opacity-50 ${
                    isEffectivelyEnabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-600 text-white hover:bg-gray-500'
                  }`}
                  title={hasOverride ? `Override: ${gm.competitionCreationOverride}` : `Package default: ${packageAllows ? 'ON' : 'OFF'}`}
                >
                  <Trophy className="h-4 w-4" />
                  {isEffectivelyEnabled ? 'Comps: ON' : 'Comps: OFF'}
                  {hasOverride && (
                    <span className="text-xs bg-white/20 px-1 rounded">Override</span>
                  )}
                </button>
              );
            })()}
            {gm.status === 'active' && (
              <button
                onClick={() => handleAction(gm.id, 'suspend', { reason: 'Suspended by admin' })}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Suspend
              </button>
            )}
            {gm.status === 'suspended' && (
              <button
                onClick={() => handleAction(gm.id, 'reactivate')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Reactivate
              </button>
            )}
            <button
              onClick={() => handleAction(gm.id, 'extend', { extensionDays: 30 })}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Calendar className="h-4 w-4" />
              Extend 30 Days
            </button>
            <button
              onClick={() => handleAction(gm.id, 'revoke')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Revoke
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Days Remaining</p>
            <p className="text-2xl font-bold text-white">{daysRemaining}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Total Referrals</p>
            <p className="text-2xl font-bold text-white">{gm.totalReferredUsers}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Total Earnings</p>
            <p className="text-2xl font-bold text-green-400">{gm.totalEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Competitions Created</p>
            <p className="text-2xl font-bold text-white">{gm.totalCompetitionsCreated}</p>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription Info */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Subscription Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Package</span>
                <span className="text-white">{gm.packageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Referral Code</span>
                <span className="font-mono text-amber-400">{gm.referralCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Start Date</span>
                <span className="text-white">{new Date(gm.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">End Date</span>
                <span className="text-white">{new Date(gm.endDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Auto-Renewal</span>
                <span className={gm.autoRenew ? 'text-green-400' : 'text-red-400'}>
                  {gm.autoRenew ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Renewal Price</span>
                <span className="text-white">{gm.renewalPrice} Credits</span>
              </div>
              <hr className="border-gray-700 my-3" />
              <div className="flex justify-between">
                <span className="text-gray-400">Can Create Competitions</span>
                {(() => {
                  const packageAllows = gm.limits?.canCreateCompetitions !== false;
                  const hasOverride = gm.competitionCreationOverride === 'enabled' || gm.competitionCreationOverride === 'disabled';
                  const effectivelyEnabled = gm.competitionCreationOverride === 'enabled' || 
                    (gm.competitionCreationOverride !== 'disabled' && packageAllows);
                  
                  if (!packageAllows && !hasOverride) {
                    return <span className="text-gray-500 font-medium">Pack doesn't offer</span>;
                  }
                  
                  return (
                    <span className={`font-medium ${effectivelyEnabled ? 'text-green-400' : 'text-red-400'}`}>
                      {effectivelyEnabled ? 'Yes' : 'No'}
                      {hasOverride && <span className="ml-2 text-xs text-purple-400">(Override)</span>}
                    </span>
                  );
                })()}
              </div>
              {/* Only show these when competitions are effectively enabled */}
              {(() => {
                const packageAllows = gm.limits?.canCreateCompetitions !== false;
                const effectivelyEnabled = gm.competitionCreationOverride === 'enabled' || 
                  (gm.competitionCreationOverride !== 'disabled' && packageAllows);
                
                if (!effectivelyEnabled) return null;
                
                // Use override limits if admin enabled via override, otherwise package limits
                const maxComps = gm.overrideLimits?.maxCompetitionsPerDay || gm.limits.maxCompetitionsPerDay;
                const maxUsers = gm.overrideLimits?.maxUsersPerCompetition || gm.limits.maxUsersPerCompetition;
                
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Competitions/Day</span>
                      <span className="text-white">{maxComps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Users/Competition</span>
                      <span className="text-white">{maxUsers}</span>
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between">
                <span className="text-gray-400">Referral Fee %</span>
                <span className="text-white">{gm.limits.referralFeePercentage}%</span>
              </div>
            </div>
          </div>

          {/* Recent Referrals */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Referrals</h3>
            {selectedGM.referredUsers.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No referrals yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedGM.referredUsers.slice(0, 10).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                    <div>
                      <p className="text-white text-sm">{user.name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {new Date(user.referredAt || user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Earnings History */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Earnings History</h3>
          {selectedGM.earnings.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No earnings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Referred User</th>
                    <th className="pb-2">Entry Fee</th>
                    <th className="pb-2">Earning</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGM.earnings.slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-gray-700/50">
                      <td className="py-2 text-white">{e.sourceName}</td>
                      <td className="py-2 text-gray-300">{e.referredUserName}</td>
                      <td className="py-2 text-gray-300">{e.entryFeeAmount}</td>
                      <td className="py-2 text-green-400">+{e.netEarning.toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          e.status === 'paid' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-sm">
                        {new Date(e.createdAt).toLocaleDateString()}
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

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Game Master Management</h2>
          <p className="text-gray-400">Manage all game master subscriptions</p>
        </div>
        <button
          onClick={fetchGameMasters}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-green-700/50">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Expired</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalExpired}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-red-700/50">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Suspended</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalSuspended}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-blue-700/50">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalReferrals}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-purple-700/50">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Competitions</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalCompetitions}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-green-700/50">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalEarnings.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or referral code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : gamemasters.length === 0 ? (
          <div className="text-center py-12">
            <Crown className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No game masters found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Comps</th>
                <th className="px-4 py-3">Referral Code</th>
                <th className="px-4 py-3">Referrals</th>
                <th className="px-4 py-3">Earnings</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gamemasters.map((gm) => (
                <tr key={gm.id} className="border-b border-gray-700/50 hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{gm.userName}</p>
                    <p className="text-gray-400 text-sm">{gm.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{gm.packageName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(gm.status)}`}>
                      {gm.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const packageAllows = gm.limits?.canCreateCompetitions !== false;
                      const hasOverride = gm.competitionCreationOverride === 'enabled' || gm.competitionCreationOverride === 'disabled';
                      const effectivelyEnabled = gm.competitionCreationOverride === 'enabled' || 
                        (gm.competitionCreationOverride !== 'disabled' && packageAllows);
                      
                      if (!packageAllows && !hasOverride) {
                        // Package doesn't offer competitions, no admin override
                        return <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-500">Pack N/A</span>;
                      }
                      
                      return (
                        <span className={`px-2 py-1 rounded text-xs ${
                          effectivelyEnabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {effectivelyEnabled ? 'ON' : 'OFF'}
                          {hasOverride && <span className="ml-1 text-purple-400">(Override)</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-amber-400">{gm.referralCode}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{gm.totalReferredUsers}</td>
                  <td className="px-4 py-3 text-green-400">{gm.totalEarnings.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {new Date(gm.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewDetails(gm.id)}
                      disabled={detailLoading}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Override Limits Modal */}
      {showLimitsModal && limitsModalGM && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Enable Competition Creation
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Set the competition limits for <span className="text-white font-medium">{limitsModalGM.userName}</span>.
              These override the package defaults.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Competitions Per Day</label>
                <input
                  type="number"
                  value={overrideLimits.maxCompetitionsPerDay}
                  onChange={(e) => setOverrideLimits(prev => ({ ...prev, maxCompetitionsPerDay: parseInt(e.target.value) || 1 }))}
                  min={1}
                  max={100}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Users Per Competition</label>
                <input
                  type="number"
                  value={overrideLimits.maxUsersPerCompetition}
                  onChange={(e) => setOverrideLimits(prev => ({ ...prev, maxUsersPerCompetition: parseInt(e.target.value) || 50 }))}
                  min={2}
                  max={1000}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLimitsModal(false);
                  setLimitsModalGM(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleAction(limitsModalGM.id, 'toggleCompetitionCreation', { 
                    override: 'enabled',
                    overrideLimits 
                  });
                  setShowLimitsModal(false);
                  setLimitsModalGM(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
