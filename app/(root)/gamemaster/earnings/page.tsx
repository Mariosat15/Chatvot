'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Crown, 
  ArrowLeft, 
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Trophy,
  Swords,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Earning {
  _id: string;
  sourceType: 'competition' | 'challenge';
  sourceId: string;
  sourceName: string;
  referredUserId: string;
  referredUserEmail: string;
  referredUserName: string;
  entryFeeAmount: number;
  earningPercentage: number;
  grossEarning: number;
  platformFee: number;
  netEarning: number;
  status: 'pending' | 'paid' | 'cancelled';
  eventStartTime: string;
  eventEndTime: string;
  createdAt: string;
}

interface EarningsData {
  earnings: Earning[];
  totals: {
    totalEarnings: number;
    pendingEarnings: number;
    paidEarnings: number;
    fromCompetitions: number;
    fromChallenges: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function GMEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EarningsData | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'competition' | 'challenge'>('all');

  useEffect(() => {
    fetchEarnings();
  }, [page, filter]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter !== 'all') {
        params.set('sourceType', filter);
      }
      
      const response = await fetch(`/api/gamemaster/earnings?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || 'Failed to load earnings');
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-emerald-500/10 to-green-500/10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link 
            href="/gamemaster"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Earnings History</h1>
              <p className="text-gray-400">Track your referral earnings in detail</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Total Earned</div>
              <div className="text-2xl font-bold text-emerald-400">⚡ {(data.totals?.totalEarnings ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Paid Out</div>
              <div className="text-2xl font-bold text-white">⚡ {(data.totals?.paidEarnings ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-400">⚡ {(data.totals?.pendingEarnings ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                <Trophy className="h-3 w-3 text-yellow-400" />
                From Competitions
              </div>
              <div className="text-xl font-bold text-white">⚡ {(data.totals?.fromCompetitions ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                <Swords className="h-3 w-3 text-red-400" />
                From Challenges
              </div>
              <div className="text-xl font-bold text-white">⚡ {(data.totals?.fromChallenges ?? 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filter:</span>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'competition', label: 'Competitions' },
                { value: 'challenge', label: 'Challenges' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setFilter(f.value as typeof filter); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filter === f.value
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Earnings Table */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : !data || data.earnings.length === 0 ? (
            <div className="text-center py-20">
              <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No earnings yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Earnings will appear here when your referred users participate in competitions
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900/50 text-left text-sm text-gray-400">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Source</th>
                      <th className="px-6 py-4 font-medium">Referred User</th>
                      <th className="px-6 py-4 font-medium">Entry Fee</th>
                      <th className="px-6 py-4 font-medium">Your %</th>
                      <th className="px-6 py-4 font-medium">Earned</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.earnings.map((earning) => (
                      <tr key={earning._id} className="border-t border-gray-700/50 hover:bg-gray-800/30">
                        <td className="px-6 py-4 text-gray-300 text-sm">
                          {new Date(earning.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {earning.sourceType === 'competition' ? (
                              <Trophy className="h-4 w-4 text-yellow-400" />
                            ) : (
                              <Swords className="h-4 w-4 text-red-400" />
                            )}
                            <span className="text-white text-sm">{earning.sourceName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-white text-sm">{earning.referredUserName}</p>
                            <p className="text-gray-500 text-xs">{earning.referredUserEmail}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          ⚡ {earning.entryFeeAmount}
                        </td>
                        <td className="px-6 py-4 text-emerald-400">
                          {earning.earningPercentage}%
                        </td>
                        <td className="px-6 py-4 text-emerald-400 font-semibold">
                          ⚡ {(earning.netEarning ?? 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            earning.status === 'paid' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : earning.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          )}>
                            {earning.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700/50">
                  <p className="text-sm text-gray-400">
                    Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-400">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={page === data.pagination.totalPages}
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
