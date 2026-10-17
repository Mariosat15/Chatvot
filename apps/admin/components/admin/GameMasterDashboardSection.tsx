"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  DollarSign,
  Trophy,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Award,
  Zap,
  Shield,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Interfaces ───────────────────────────────────────────────────────
interface DashboardStats {
  totalReferredUsers: number;
  totalCompetitions: number;
  activeCompetitions: number;
  completedCompetitions: number;
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
  maxParticipants: number;
  prizePool: number;
  entryFee: number;
  startTime: string;
  endTime: string;
  createdAt: string;
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

// ─── Constants ────────────────────────────────────────────────────────
const PIE_COLORS = ["#22c55e", "#eab308", "#6366f1", "#ef4444", "#64748b"];

// ─── Main Component ──────────────────────────────────────────────────
export default function GameMasterDashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "competitions" | "referrals" | "earnings"
  >("overview");
  const [compFilter, setCompFilter] = useState("all");
  const [earningFilter, setEarningFilter] = useState("all");
  const [referralSearch, setReferralSearch] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/gamemaster/dashboard");
      if (response.status === 401) {
        setError("not_gamemaster");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
    if (
      !confirm(
        "Are you sure you want to regenerate your referral link? Your old link will stop working.",
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const response = await fetch("/api/gamemaster/link", { method: "POST" });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      console.error("Failed to regenerate link:", err);
    } finally {
      setRegenerating(false);
    }
  };

  // ─── Computed Data ──────────────────────────
  const compStats = useMemo(() => {
    if (!data) return null;
    const comps = data.recentCompetitions;
    const active = comps.filter((c) => c.status === "active").length;
    const completed = comps.filter((c) => c.status === "completed").length;
    const upcoming = comps.filter((c) => c.status === "upcoming").length;
    const cancelled = comps.filter((c) => c.status === "cancelled").length;
    const totalParticipants = comps.reduce(
      (s, c) => s + (c.participants || 0),
      0,
    );
    const totalPrizePool = comps.reduce(
      (s, c) => s + (c.prizePool || 0),
      0,
    );
    return {
      active,
      completed,
      upcoming,
      cancelled,
      totalParticipants,
      totalPrizePool,
    };
  }, [data]);

  const earningsChartData = useMemo(() => {
    if (!data) return [];
    // Group earnings by month
    const monthMap = new Map<string, number>();
    for (const e of data.recentEarnings) {
      const d = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + (e.netEarning || 0));
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({
        month: new Date(month + "-01").toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
        }),
        earnings: Number(total.toFixed(2)),
      }));
  }, [data]);

  const compStatusPieData = useMemo(() => {
    if (!compStats) return [];
    return [
      { name: "Active", value: compStats.active },
      { name: "Upcoming", value: compStats.upcoming },
      { name: "Completed", value: compStats.completed },
      { name: "Cancelled", value: compStats.cancelled },
    ].filter((d) => d.value > 0);
  }, [compStats]);

  const filteredComps = useMemo(() => {
    if (!data) return [];
    if (compFilter === "all") return data.recentCompetitions;
    return data.recentCompetitions.filter((c) => c.status === compFilter);
  }, [data, compFilter]);

  const filteredEarnings = useMemo(() => {
    if (!data) return [];
    if (earningFilter === "all") return data.recentEarnings;
    return data.recentEarnings.filter((e) => e.status === earningFilter);
  }, [data, earningFilter]);

  const filteredReferrals = useMemo(() => {
    if (!data) return [];
    if (!referralSearch) return data.recentReferrals;
    const q = referralSearch.toLowerCase();
    return data.recentReferrals.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q),
    );
  }, [data, referralSearch]);

  // ─── Loading / Error States ──────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error === "not_gamemaster") {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-8">
          <Trophy className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Game Master Access Required
          </h2>
          <p className="text-gray-400 mb-6">
            This dashboard is for Game Masters only. To become a Game Master,
            purchase a Game Master package from the Marketplace and activate it.
          </p>
          <div className="space-y-3 text-left bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-300 font-semibold">
              How to become a Game Master:
            </p>
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

  const { subscription, stats } = data;

  // ─── Tabs ────────────────────────────────────
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    {
      id: "competitions" as const,
      label: `Competitions (${data.recentCompetitions.length})`,
      icon: Trophy,
    },
    {
      id: "referrals" as const,
      label: `Referrals (${data.recentReferrals.length})`,
      icon: Users,
    },
    {
      id: "earnings" as const,
      label: `Earnings (${data.recentEarnings.length})`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="h-7 w-7 text-amber-400" />
            Game Master Dashboard
          </h2>
          <p className="text-gray-400 mt-1">
            {subscription.packageName} •{" "}
            <span
              className={
                subscription.daysRemaining <= 7
                  ? "text-yellow-400"
                  : "text-green-400"
              }
            >
              {subscription.daysRemaining} days remaining
            </span>
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ─── Referral Link Card ─────────────────── */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-xl p-5 border border-blue-700/30">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">
            Your Referral Link
          </h3>
          <span className="ml-auto text-sm text-gray-400">
            Code:{" "}
            <span className="font-mono text-amber-400">
              {subscription.referralCode}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-900/60 rounded-lg px-4 py-3 font-mono text-sm text-gray-300 break-all border border-gray-700/50">
            {subscription.referralLink}
          </div>
          <button
            onClick={copyReferralLink}
            disabled={copying}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {copying ? (
              <>
                <CheckCircle className="h-4 w-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </button>
          <button
            onClick={regenerateLink}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`}
            />
            New
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Earn {subscription.limits.referralFeePercentage}% of entry fees from
          users who sign up with your link and enter competitions
        </p>
      </div>

      {/* ─── KPI Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          icon={Users}
          label="Referred Users"
          value={stats.totalReferredUsers}
          color="blue"
        />
        <KPICard
          icon={DollarSign}
          label="Total Earnings"
          value={(stats.totalEarnings ?? 0).toFixed(2)}
          color="green"
        />
        <KPICard
          icon={Clock}
          label="Pending Payout"
          value={(stats.pendingEarnings ?? 0).toFixed(2)}
          color="yellow"
        />
        <KPICard
          icon={Trophy}
          label="Total Competitions"
          value={stats.totalCompetitions}
          color="purple"
        />
        <KPICard
          icon={Zap}
          label="Active Competitions"
          value={stats.activeCompetitions}
          color="emerald"
        />
        <KPICard
          icon={Target}
          label="Completed"
          value={stats.completedCompetitions ?? 0}
          color="gray"
        />
      </div>

      {/* ─── Tab Navigation ─────────────────────── */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-gray-700 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ────────────────────────── */}
      {activeTab === "overview" && (
        <OverviewContent
          stats={stats}
          subscription={subscription}
          earningsChartData={earningsChartData}
          compStatusPieData={compStatusPieData}
          compStats={compStats}
        />
      )}

      {activeTab === "competitions" && (
        <CompetitionsContent
          competitions={filteredComps}
          filter={compFilter}
          onFilterChange={setCompFilter}
          subscription={subscription}
        />
      )}

      {activeTab === "referrals" && (
        <ReferralsContent
          referrals={filteredReferrals}
          search={referralSearch}
          onSearchChange={setReferralSearch}
          total={data.recentReferrals.length}
        />
      )}

      {activeTab === "earnings" && (
        <EarningsContent
          earnings={filteredEarnings}
          filter={earningFilter}
          onFilterChange={setEarningFilter}
          stats={stats}
        />
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────
function KPICard({
  icon: Icon,
  label,
  value,
  color = "white",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    blue: {
      bg: "bg-blue-900/30 border-blue-700/30",
      icon: "text-blue-400",
      text: "text-blue-400",
    },
    green: {
      bg: "bg-green-900/30 border-green-700/30",
      icon: "text-green-400",
      text: "text-green-400",
    },
    yellow: {
      bg: "bg-yellow-900/30 border-yellow-700/30",
      icon: "text-yellow-400",
      text: "text-yellow-400",
    },
    purple: {
      bg: "bg-purple-900/30 border-purple-700/30",
      icon: "text-purple-400",
      text: "text-purple-400",
    },
    emerald: {
      bg: "bg-emerald-900/30 border-emerald-700/30",
      icon: "text-emerald-400",
      text: "text-emerald-400",
    },
    gray: {
      bg: "bg-gray-800 border-gray-700",
      icon: "text-gray-400",
      text: "text-gray-300",
    },
    white: {
      bg: "bg-gray-800 border-gray-700",
      icon: "text-gray-400",
      text: "text-white",
    },
  };
  const c = colorMap[color] || colorMap.white;

  return (
    <div className={`rounded-xl p-4 border ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${c.icon}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}

// ─── Overview Content ────────────────────────────────────────────────
function OverviewContent({
  stats,
  subscription,
  earningsChartData,
  compStatusPieData,
  compStats,
}: {
  stats: DashboardStats;
  subscription: Subscription;
  earningsChartData: Array<{ month: string; earnings: number }>;
  compStatusPieData: Array<{ name: string; value: number }>;
  compStats: {
    active: number;
    completed: number;
    upcoming: number;
    cancelled: number;
    totalParticipants: number;
    totalPrizePool: number;
  } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Earnings Over Time
          </h3>
          {earningsChartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No earnings data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={earningsChartData}>
                <XAxis
                  dataKey="month"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar
                  dataKey="earnings"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Competition Status Pie */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Competition Breakdown
          </h3>
          {compStatusPieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No competitions yet
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={compStatusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    strokeWidth={2}
                    stroke="#111827"
                  >
                    {compStatusPieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {compStatusPieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    <span className="text-gray-300">{d.name}</span>
                    <span className="text-white font-bold ml-auto">
                      {d.value}
                    </span>
                  </div>
                ))}
                {compStats && (
                  <div className="pt-2 border-t border-gray-700 mt-2 text-gray-400 text-xs">
                    <p>
                      Total participants:{" "}
                      <span className="text-white">
                        {compStats.totalParticipants}
                      </span>
                    </p>
                    <p>
                      Total prize pools:{" "}
                      <span className="text-white">
                        {compStats.totalPrizePool.toFixed(0)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Details */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          Subscription Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <InfoBlock label="Status">
            <span
              className={
                subscription.status === "active"
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {subscription.status.charAt(0).toUpperCase() +
                subscription.status.slice(1)}
            </span>
          </InfoBlock>
          <InfoBlock label="Auto-Renewal">
            <span
              className={
                subscription.autoRenew ? "text-green-400" : "text-yellow-400"
              }
            >
              {subscription.autoRenew ? "Enabled" : "Disabled"}
            </span>
          </InfoBlock>
          <InfoBlock label="Renewal Price">
            <span className="text-white">{subscription.renewalPrice} Cr</span>
          </InfoBlock>
          <InfoBlock label="End Date">
            <span className="text-white">
              {new Date(subscription.endDate).toLocaleDateString()}
            </span>
          </InfoBlock>
          <InfoBlock label="Comps Today">
            <span className="text-white">
              {subscription.currentPeriodCompetitionsCreated} /{" "}
              {subscription.limits.maxCompetitionsPerDay}
            </span>
          </InfoBlock>
          <InfoBlock label="Max Users/Comp">
            <span className="text-white">
              {subscription.limits.maxUsersPerCompetition}
            </span>
          </InfoBlock>
        </div>
      </div>
    </div>
  );
}

// ─── Competitions Content ────────────────────────────────────────────
function CompetitionsContent({
  competitions,
  filter,
  onFilterChange,
  subscription,
}: {
  competitions: Array<{
    id: string;
    name: string;
    status: string;
    participants: number;
    maxParticipants: number;
    prizePool: number;
    entryFee: number;
    startTime: string;
    endTime: string;
  }>;
  filter: string;
  onFilterChange: (f: string) => void;
  subscription: Subscription;
}) {
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          {["all", "active", "upcoming", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          disabled={
            subscription.currentPeriodCompetitionsCreated >=
            subscription.limits.maxCompetitionsPerDay
          }
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <Plus className="h-4 w-4" />
          Create Competition
        </button>
      </div>

      {/* Table */}
      {competitions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Trophy className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No competitions match this filter.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3">Competition</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Players</th>
                  <th className="px-4 py-3">Entry Fee</th>
                  <th className="px-4 py-3">Prize Pool</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((comp) => (
                  <tr
                    key={comp.id}
                    className="border-b border-gray-700/50 hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {comp.name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={comp.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {comp.participants}
                      {comp.maxParticipants
                        ? ` / ${comp.maxParticipants}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {comp.entryFee ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(comp.prizePool || 0).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(comp.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(comp.endTime).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Referrals Content ───────────────────────────────────────────────
function ReferralsContent({
  referrals,
  search,
  onSearchChange,
  total,
}: {
  referrals: Referral[];
  search: string;
  onSearchChange: (s: string) => void;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          Total: {total} referred users
        </span>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {referrals.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          {search
            ? "No referrals match your search."
            : "No referrals yet. Share your link!"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {referrals.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                {r.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {r.name}
                </p>
                <p className="text-gray-400 text-xs truncate">{r.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-400 text-xs">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Earnings Content ────────────────────────────────────────────────
function EarningsContent({
  earnings,
  filter,
  onFilterChange,
  stats,
}: {
  earnings: Earning[];
  filter: string;
  onFilterChange: (f: string) => void;
  stats: DashboardStats;
}) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-xl p-4 border border-green-700/30">
          <p className="text-gray-400 text-xs">Total Earned</p>
          <p className="text-lg font-bold text-green-400">
            {(stats.totalEarnings ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-green-700/30">
          <p className="text-gray-400 text-xs">Paid</p>
          <p className="text-lg font-bold text-green-400">
            {(stats.paidEarnings ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-yellow-700/30">
          <p className="text-gray-400 text-xs">Pending</p>
          <p className="text-lg font-bold text-yellow-400">
            {(stats.pendingEarnings ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-xs">Transactions</p>
          <p className="text-lg font-bold text-white">
            {stats.totalTransactions}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {["all", "paid", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {earnings.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No earnings match this filter.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Referred User</th>
                  <th className="px-4 py-3">Entry Fee</th>
                  <th className="px-4 py-3">Earning</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-gray-700/50 hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3 text-white">{e.sourceName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          e.sourceType === "competition"
                            ? "bg-purple-900/50 text-purple-400"
                            : "bg-blue-900/50 text-blue-400"
                        }`}
                      >
                        {e.sourceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {e.referredUserName}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {e.entryFeeAmount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-green-400 font-medium">
                      +{(e.netEarning ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Helpers ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-900/50 text-green-400",
    upcoming: "bg-blue-900/50 text-blue-400",
    completed: "bg-gray-700 text-gray-300",
    cancelled: "bg-red-900/50 text-red-400",
    paid: "bg-green-900/50 text-green-400",
    pending: "bg-yellow-900/50 text-yellow-400",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${map[status] || "bg-gray-700 text-gray-300"}`}>
      {status}
    </span>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
