"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Crown, Users, TrendingUp, Calendar, Trophy, Link2, RefreshCw,
  Clock, ChevronRight, Loader2, AlertCircle, ShoppingBag,
  Pause, Play, AlertTriangle, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OverviewTab, CompetitionsTab, ReferralsTab, EarningsTab } from "./gamemaster-dashboard-tabs";
import { WarningBanner, RefField, KPI, SubscriptionPanel, CancelModal } from "./gamemaster-dashboard-helpers";
import { useGmSubscription } from "./use-gm-subscription";
import type { DashboardStats, CompetitionItem, EarningItem, ReferralItem, SubscriptionData } from "./gamemaster-dashboard-types";

// ─── Types ────────────────────────────────────────────────────────────
interface GameMasterData {
  subscription: SubscriptionData | null;
  referredUsers: ReferralItem[];
  recentEarnings: EarningItem[];
  recentCompetitions: CompetitionItem[];
  stats: DashboardStats;
}

const TABS = ["Overview", "Competitions", "Referrals", "Earnings"] as const;
type Tab = (typeof TABS)[number];

// ─── Main Component ───────────────────────────────────────────────────
export default function GameMasterDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GameMasterData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [compFilter, setCompFilter] = useState("all");
  const [earningsFilter, setEarningsFilter] = useState("all");
  const [referralSearch, setReferralSearch] = useState("");

  // ── Subscription Management Hook ──────────────────────────────────
  const getSub = useCallback(() => data?.subscription ?? null, [data?.subscription]);
  const updateSub = useCallback(
    (partial: Partial<SubscriptionData>) => {
      setData((prev) =>
        prev?.subscription ? { ...prev, subscription: { ...prev.subscription, ...partial } } : prev,
      );
    },
    [],
  );
  const {
    togglingRenewal, togglingPause, schedulingCancel,
    showCancelConfirm, setShowCancelConfirm,
    toggleAutoRenew, togglePause, toggleScheduledCancellation,
  } = useGmSubscription(getSub, updateSub);

  useEffect(() => { fetchGameMasterData(); }, []);

  const fetchGameMasterData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gamemaster/dashboard");
      const result = await res.json();
      if (result.success) setData(result.data);
      else setData(null);
    } catch (error) {
      console.error("Error fetching GM data:", error);
      toast.error("Failed to load Game Master data");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      const setter = type === "code" ? setCopiedCode : setCopiedLink;
      setter(true);
      setTimeout(() => setter(false), 2000);
      toast.success("Copied to clipboard!");
    } catch { toast.error("Failed to copy"); }
  };

  // ── Derived State ─────────────────────────────────────────────────
  const sub = data?.subscription;
  const stats = data?.stats;
  const daysRemaining = sub?.endDate
    ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000))
    : 0;
  const referralLink = sub?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/sign-up?ref=${sub.referralCode}`
    : "";
  const isExpired = !sub || sub.status !== "active" || daysRemaining === 0;
  const isPaused = sub?.isPaused === true;
  const isScheduledForDeletion = sub?.scheduledForDeletion === true;

  // ── Chart Data ────────────────────────────────────────────────────
  const earningsChartData = useMemo(() => {
    if (!data?.recentEarnings?.length) return [];
    const map = new Map<string, number>();
    for (const e of data.recentEarnings) {
      const d = new Date(e.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      map.set(key, (map.get(key) || 0) + (e.netEarning || 0));
    }
    return Array.from(map.entries()).slice(-14).map(([month, earnings]) => ({ month, earnings: +earnings.toFixed(2) }));
  }, [data?.recentEarnings]);

  const compStatusPieData = useMemo(() => {
    if (!stats) return [];
    const items = [
      { name: "Active", value: stats.activeCompetitions || 0 },
      { name: "Completed", value: stats.completedCompetitions || 0 },
    ];
    const total = stats.totalCompetitions || 0;
    const counted = items.reduce((s, i) => s + i.value, 0);
    if (total > counted) items.push({ name: "Other", value: total - counted });
    return items.filter((i) => i.value > 0);
  }, [stats]);

  const compStats = useMemo(() => {
    if (!data?.recentCompetitions) return null;
    const comps = data.recentCompetitions;
    return {
      active: comps.filter((c) => c.status === "active").length,
      completed: comps.filter((c) => c.status === "completed").length,
      upcoming: comps.filter((c) => c.status === "upcoming").length,
      cancelled: comps.filter((c) => c.status === "cancelled").length,
      totalParticipants: comps.reduce((s, c) => s + (c.participants || 0), 0),
      totalPrizePool: comps.reduce((s, c) => s + (c.prizePool || 0), 0),
    };
  }, [data?.recentCompetitions]);

  const filteredComps = useMemo(() => {
    if (!data?.recentCompetitions) return [];
    return compFilter === "all" ? data.recentCompetitions : data.recentCompetitions.filter((c) => c.status === compFilter);
  }, [data?.recentCompetitions, compFilter]);

  const filteredEarnings = useMemo(() => {
    if (!data?.recentEarnings) return [];
    return earningsFilter === "all" ? data.recentEarnings : data.recentEarnings.filter((e) => e.status === earningsFilter);
  }, [data?.recentEarnings, earningsFilter]);

  const filteredReferrals = useMemo(() => {
    if (!data?.referredUsers) return [];
    if (!referralSearch.trim()) return data.referredUsers;
    const q = referralSearch.toLowerCase();
    return data.referredUsers.filter((r) => r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
  }, [data?.referredUsers, referralSearch]);

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  // ── Not a Game Master ─────────────────────────────────────────────
  if (!sub) return <NotGameMasterView />;

  // ── Active Dashboard ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-16 lg:pb-0">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-amber-500/10" />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="truncate">Game Master Dashboard</span>
                  <span className={cn("px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold flex-shrink-0", isExpired ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400")}>
                    {isExpired ? "Expired" : isPaused ? "Paused" : "Active"}
                  </span>
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5 truncate">{sub.packageName}</p>
              </div>
            </div>
            <button onClick={fetchGameMasterData} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm min-h-[44px]">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Banners */}
        {isExpired && <WarningBanner icon={AlertCircle} color="red" title="Subscription expired" desc="Renew to continue creating competitions and earning." link="/marketplace?category=gamemaster" linkText="Renew Subscription" />}
        {isPaused && !isExpired && (
          <WarningBanner icon={Pause} color="yellow" title="Subscription Paused" desc="You will NOT receive referral fees until you resume.">
            <button onClick={togglePause} disabled={togglingPause} className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
              {togglingPause ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Resume
            </button>
          </WarningBanner>
        )}
        {isScheduledForDeletion && !isExpired && (
          <WarningBanner icon={AlertTriangle} color="orange" title="Scheduled for Cancellation" desc={`Deletes on ${sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "expiry"}.`}>
            <button onClick={toggleScheduledCancellation} disabled={schedulingCancel} className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
              {schedulingCancel ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel Deletion
            </button>
          </WarningBanner>
        )}

        {/* Referral Link */}
        <div className={cn("rounded-2xl p-4 sm:p-5 border", isPaused ? "bg-gray-800/50 border-gray-700/50 opacity-75" : "bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20")}>
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Link2 className={isPaused ? "h-5 w-5 text-gray-400" : "h-5 w-5 text-yellow-400"} /> Your Referral Link
            {isPaused && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">PAUSED</span>}
          </h2>
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            <RefField label="Referral Code" value={sub.referralCode || ""} copied={copiedCode} onCopy={() => copyToClipboard(sub.referralCode || "", "code")} mono />
            <RefField label="Full Referral Link" value={referralLink} copied={copiedLink} onCopy={() => copyToClipboard(referralLink, "link")} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <KPI icon={TrendingUp} color="emerald" label="Total Earnings" value={`⚡ ${(stats?.totalEarnings ?? 0).toFixed(2)}`} />
          <KPI icon={Clock} color="yellow" label="Pending" value={`⚡ ${(stats?.pendingEarnings ?? 0).toFixed(2)}`} />
          <KPI icon={Users} color="blue" label="Total Referrals" value={String(stats?.totalReferredUsers ?? 0)} />
          <KPI icon={Users} color="purple" label="Active Referrals" value={String(stats?.activeReferredUsers ?? 0)} />
          <KPI icon={Trophy} color="amber" label="Competitions" value={String(stats?.totalCompetitions ?? 0)} />
          <KPI icon={Calendar} color={daysRemaining <= 3 ? "red" : daysRemaining <= 7 ? "yellow" : "emerald"} label="Days Left" value={String(daysRemaining)} pulse={daysRemaining <= 3 && daysRemaining > 0} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-900/50 rounded-xl p-1 border border-gray-800 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 px-2 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap", activeTab === tab ? "bg-yellow-500 text-black shadow" : "text-gray-400 hover:text-white hover:bg-gray-800")}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && stats && <OverviewTab stats={stats} subscription={sub} earningsChartData={earningsChartData} compStatusPieData={compStatusPieData} compStats={compStats} />}
        {activeTab === "Competitions" && <CompetitionsTab competitions={filteredComps} filter={compFilter} onFilterChange={setCompFilter} subscription={sub} isExpired={isExpired} />}
        {activeTab === "Referrals" && <ReferralsTab referrals={filteredReferrals} search={referralSearch} onSearchChange={setReferralSearch} total={stats?.totalReferredUsers ?? 0} />}
        {activeTab === "Earnings" && stats && <EarningsTab earnings={filteredEarnings} filter={earningsFilter} onFilterChange={setEarningsFilter} stats={stats} />}

        <SubscriptionPanel sub={sub} isExpired={isExpired} isPaused={isPaused} isScheduledForDeletion={isScheduledForDeletion} togglingRenewal={togglingRenewal} togglingPause={togglingPause} schedulingCancel={schedulingCancel} toggleAutoRenew={toggleAutoRenew} togglePause={togglePause} onShowCancelConfirm={() => setShowCancelConfirm(true)} toggleScheduledCancellation={toggleScheduledCancellation} />
      </div>

      {showCancelConfirm && <CancelModal endDate={sub.endDate} schedulingCancel={schedulingCancel} onClose={() => setShowCancelConfirm(false)} onConfirm={toggleScheduledCancellation} />}
    </div>
  );
}

// ─── Not a Game Master View ───────────────────────────────────────────
function NotGameMasterView() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-16 lg:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 mb-6 sm:mb-8">
          <Crown className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-400" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">Become a Game Master</h1>
        <p className="text-base sm:text-xl text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto">Create competitions, build your trading community, and earn from referrals.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {[
            { icon: Trophy, color: "text-yellow-400", t: "Create Competitions", d: "Host your own trading competitions" },
            { icon: Users, color: "text-emerald-400", t: "Grow Community", d: "Refer traders and build your network" },
            { icon: TrendingUp, color: "text-blue-400", t: "Earn Rewards", d: "Percentage of entry fees from referrals" },
          ].map((item) => (
            <div key={item.t} className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 border border-gray-700/50">
              <item.icon className={`h-8 w-8 sm:h-10 sm:w-10 ${item.color} mx-auto mb-3 sm:mb-4`} />
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{item.t}</h3>
              <p className="text-gray-400 text-sm">{item.d}</p>
            </div>
          ))}
        </div>
        <Link href="/marketplace?category=gamemaster" className="inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-bold text-base sm:text-lg rounded-2xl transition-all shadow-lg shadow-yellow-500/20 min-h-[44px]">
          <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" /> View Game Master Packages <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </Link>
      </div>
    </div>
  );
}
