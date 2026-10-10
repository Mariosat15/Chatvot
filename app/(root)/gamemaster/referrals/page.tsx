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
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { GmAwaitingClaimView, GmReferralView } from "@/lib/services/gamemaster/gm-referral-view";
import { describeAffiliationState, REFERRAL_KIND_LABELS } from "@/lib/services/gamemaster/referral-kind";
import {
  ReferralClientId,
  ReferralConsentBadge,
  ReferralContact,
  ReferralCountry,
  ReferralKindBadge,
} from "@/components/gamemaster/GmReferralBadges";
import SendTermsButton from "@/components/gamemaster/SendTermsButton";
import AwaitingTermsList from "@/components/gamemaster/AwaitingTermsList";

const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "own", label: REFERRAL_KIND_LABELS.own },
  { value: "external", label: REFERRAL_KIND_LABELS.external },
] as const;

interface ReferralsData {
  // Reason: the route maps every row through `toGameMasterReferralView`; typing the same shape
  // here means a hand-written interface cannot quietly re-admit a raw field.
  referrals: GmReferralView[];
  awaitingTerms: GmAwaitingClaimView[];
  stats: {
    pendingTerms: number;
    declinedTerms: number;
    totalReferred: number;
    currentReferred: number;
    activeUsers: number;
    ownReferrals: number;
    externalReferrals: number;
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
  const [filter, setFilter] = useState<"all" | "current" | "ended">("all");
  const [kind, setKind] = useState<"all" | "own" | "external">("all");

  useEffect(() => {
    fetchReferrals();
    // Reason: `search` is deliberately not a dependency - the search box fetches on submit, not
    // on every keystroke, so listing fetchReferrals (which closes over search) would change that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, kind]);

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
      if (kind !== "all") {
        params.set("kind", kind);
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
    <div className="min-h-screen bg-[#0a0a0f] pb-16 lg:pb-0">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Link
            href="/gamemaster"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Your Referrals</h1>
              <p className="text-gray-400 text-sm">
                Track users who signed up with your referral link
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4 mb-4 sm:mb-8">
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Total Referred</div>
              <div className="text-lg sm:text-2xl font-bold text-white">
                {data.stats.totalReferred}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-400" />
                Played (30 days)
              </div>
              <div className="text-lg sm:text-2xl font-bold text-emerald-400">
                {data.stats.activeUsers}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">{REFERRAL_KIND_LABELS.own}</div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-300">
                {data.stats.ownReferrals}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">{REFERRAL_KIND_LABELS.external}</div>
              <div className="text-lg sm:text-2xl font-bold text-sky-300">
                {data.stats.externalReferrals}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Entry Fees</div>
              <div className="text-lg sm:text-2xl font-bold text-white">
                ⚡ {data.stats.totalEntryFees.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Earnings</div>
              <div className="text-lg sm:text-2xl font-bold text-emerald-400">
                ⚡ {data.stats.totalEarningsGenerated.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-5 border border-gray-700/50 col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">Avg/User</div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-400">
                ⚡ {data.stats.avgEarningsPerUser.toFixed(0)}
              </div>
            </div>
          </div>
        )}

        {data && (
          <AwaitingTermsList
            rows={data.awaitingTerms ?? []}
            pending={data.stats.pendingTerms ?? 0}
            declined={data.stats.declinedTerms ?? 0}
          />
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
                placeholder="Search by name..."
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
                { value: "current", label: "Current" },
                { value: "ended", label: "Ended" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFilter(f.value as typeof filter);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[36px]",
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Source:</span>
            <div className="flex gap-1">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => {
                    setKind(k.value);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[36px]",
                    kind === k.value
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800",
                  )}
                >
                  {k.label}
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
                        key={user.referralId}
                        className="border-t border-gray-700/50 hover:bg-gray-800/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium">
                                {user.userName || "Unknown"}
                              </p>
                              <ReferralConsentBadge consent={user.consent} />
                              {(user.canSendTerms || user.termsSent) && (
                                <SendTermsButton
                                  target={{ referralId: user.referralId }}
                                  playerName={user.userName}
                                  alreadySent={user.termsSent}
                                />
                              )}
                            </div>
                            <ReferralContact referral={user} />
                            <ReferralCountry referral={user} />
                            <ReferralClientId referral={user} />
                            <ReferralKindBadge referral={user} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "-"}
                          </div>
                          {user.endedAt && (
                            <p className="text-gray-500 text-xs mt-1">
                              Ended {new Date(user.endedAt).toLocaleDateString()}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              user.isCurrent && user.isActive
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-gray-700 text-gray-400",
                            )}
                          >
                            {user.isCurrent && user.isActive ? (
                              <UserCheck className="h-3 w-3" />
                            ) : (
                              <UserX className="h-3 w-3" />
                            )}{" "}
                            {describeAffiliationState(user)}
                          </span>
                          {user.termsAccepted && (
                            <p className="text-emerald-500/80 text-xs mt-1">Terms accepted</p>
                          )}
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
                          ⚡ {user.entryFees.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-emerald-400 font-semibold">
                          ⚡ {user.earned.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-700/50">
                  <p className="text-xs sm:text-sm text-gray-400">
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
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs sm:text-sm text-gray-400">
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
                      className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
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
