"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Search,
  Calendar,
  Trophy,
  Swords,
  TrendingUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReferredUser {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  referredAt: string;
  isActive: boolean;
  lastActivityAt?: string;
  totalEntryFees: number;
  totalGMEarnings: number;
  competitionsEntered: number;
  challengesEntered: number;
}

interface ReferralsData {
  referrals: ReferredUser[];
  stats: {
    totalReferred: number;
    activeUsers: number;
    totalEarningsGenerated: number;
    totalEntryFees: number;
    avgEarningsPerUser: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function GMReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralsData | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    fetchReferrals();
  }, [page, filter]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (filter !== "all") {
        params.set("status", filter);
      }
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/gamemaster/referrals?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to load referrals");
      }
    } catch (error) {
      console.error("Error fetching referrals:", error);
      toast.error("Failed to load referrals");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReferrals();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link
            href="/gamemaster"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Users className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Your Referrals</h1>
              <p className="text-gray-400">
                Track users who signed up with your referral link
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Total Referred</div>
              <div className="text-2xl font-bold text-white">
                {data.stats.totalReferred}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-400" />
                Active Users
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {data.stats.activeUsers}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Total Entry Fees</div>
              <div className="text-2xl font-bold text-white">
                ⚡ {data.stats.totalEntryFees.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Your Earnings</div>
              <div className="text-2xl font-bold text-emerald-400">
                ⚡ {data.stats.totalEarningsGenerated.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Avg/User</div>
              <div className="text-2xl font-bold text-yellow-400">
                ⚡ {data.stats.avgEarningsPerUser.toFixed(0)}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Status:</span>
            <div className="flex gap-1">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFilter(f.value as typeof filter);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    filter === f.value
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : !data || data.referrals.length === 0 ? (
            <div className="text-center py-20">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No referrals yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Share your referral link to start building your community
              </p>
              <Link
                href="/gamemaster"
                className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300"
              >
                Get your referral link →
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900/50 text-left text-sm text-gray-400">
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Joined</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Activity</th>
                      <th className="px-6 py-4 font-medium">Entry Fees</th>
                      <th className="px-6 py-4 font-medium">Your Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((user) => (
                      <tr
                        key={user._id}
                        className="border-t border-gray-700/50 hover:bg-gray-800/30"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-white font-medium">
                              {user.userName || "Unknown"}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {user.userEmail}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(user.referredAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              user.isActive
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-gray-700 text-gray-400",
                            )}
                          >
                            {user.isActive ? (
                              <>
                                <UserCheck className="h-3 w-3" /> Active
                              </>
                            ) : (
                              <>
                                <UserX className="h-3 w-3" /> Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-yellow-400">
                              <Trophy className="h-3 w-3" />
                              {user.competitionsEntered}
                            </span>
                            <span className="flex items-center gap-1 text-red-400">
                              <Swords className="h-3 w-3" />
                              {user.challengesEntered}
                            </span>
                          </div>
                          {user.lastActivityAt && (
                            <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last:{" "}
                              {new Date(
                                user.lastActivityAt,
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          ⚡ {user.totalEntryFees.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-emerald-400 font-semibold">
                          ⚡ {user.totalGMEarnings.toLocaleString()}
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
                    Showing{" "}
                    {(data.pagination.page - 1) * data.pagination.limit + 1} -{" "}
                    {Math.min(
                      data.pagination.page * data.pagination.limit,
                      data.pagination.total,
                    )}{" "}
                    of {data.pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-400">
                      Page {data.pagination.page} of{" "}
                      {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((p) =>
                          Math.min(data.pagination.totalPages, p + 1),
                        )
                      }
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
