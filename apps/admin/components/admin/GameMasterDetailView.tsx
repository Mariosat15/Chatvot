"use client";

import { useState, useMemo } from "react";
import {
  Users,
  DollarSign,
  Trophy,
  Crown,
  Ban,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  ChevronLeft,
  Clock,
  Trash2,
  ExternalLink,
  User,
  Shield,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from "lucide-react";
import Link from "next/link";

// ─── Interfaces ───────────────────────────────────────────────────────
interface GMSubscription {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  packageName: string;
  status: "active" | "expired" | "suspended" | "cancelled";
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
  totalReferredUsers: number;
  totalEarnings: number;
  totalCompetitionsCreated: number;
  createdAt: string;
  pendingEarnings: number;
  activeReferredUsers: number;
  renewalHistory: Array<{
    date: string;
    amount: number;
    status: string;
    failureReason?: string;
  }>;
  suspendedReason?: string;
}

interface ReferredUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  referredAt: string;
}

interface GMCompetition {
  id: string;
  name: string;
  status: string;
  participants: number;
  prizePool: number;
  startTime: string;
  endTime: string;
}

interface GMEarning {
  id: string;
  sourceType: string;
  sourceName: string;
  referredUserName: string;
  entryFeeAmount: number;
  netEarning: number;
  status: string;
  createdAt: string;
}

export interface DetailedGameMasterData {
  subscription: GMSubscription;
  referredUsers: ReferredUser[];
  competitions: GMCompetition[];
  earnings: GMEarning[];
}

interface GameMasterDetailViewProps {
  data: DetailedGameMasterData;
  onBack: () => void;
  onAction: (
    gmId: string,
    action: string,
    extraData?: Record<string, unknown>,
  ) => Promise<void>;
  actionLoading: boolean;
}

// ─── Component ────────────────────────────────────────────────────────
export default function GameMasterDetailView({
  data,
  onBack,
  onAction,
  actionLoading,
}: GameMasterDetailViewProps) {
  const gm = data.subscription;
  const [activeSection, setActiveSection] = useState<
    "overview" | "competitions" | "referrals" | "earnings"
  >("overview");
  const [referralSearch, setReferralSearch] = useState("");
  const [earningsFilter, setEarningsFilter] = useState<string>("all");
  const [compFilter, setCompFilter] = useState<string>("all");

  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(gm.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
  const isCritical = daysRemaining > 0 && daysRemaining <= 3;

  // ─── Computed Stats ──────────────────────────────
  const compStats = useMemo(() => {
    const active = data.competitions.filter(
      (c) => c.status === "active",
    ).length;
    const completed = data.competitions.filter(
      (c) => c.status === "completed",
    ).length;
    const upcoming = data.competitions.filter(
      (c) => c.status === "upcoming",
    ).length;
    const cancelled = data.competitions.filter(
      (c) => c.status === "cancelled",
    ).length;
    const totalPrizePool = data.competitions.reduce(
      (s, c) => s + (c.prizePool || 0),
      0,
    );
    const totalParticipants = data.competitions.reduce(
      (s, c) => s + (c.participants || 0),
      0,
    );
    return {
      active,
      completed,
      upcoming,
      cancelled,
      totalPrizePool,
      totalParticipants,
      total: data.competitions.length,
    };
  }, [data.competitions]);

  const earningStats = useMemo(() => {
    const paid = data.earnings
      .filter((e) => e.status === "paid")
      .reduce((s, e) => s + (e.netEarning || 0), 0);
    const pending = data.earnings
      .filter((e) => e.status === "pending")
      .reduce((s, e) => s + (e.netEarning || 0), 0);
    const fromComps = data.earnings
      .filter((e) => e.sourceType === "competition")
      .reduce((s, e) => s + (e.netEarning || 0), 0);
    const fromChallenges = data.earnings
      .filter((e) => e.sourceType === "challenge")
      .reduce((s, e) => s + (e.netEarning || 0), 0);
    return { paid, pending, fromComps, fromChallenges };
  }, [data.earnings]);

  // Filtered lists
  const filteredReferrals = useMemo(() => {
    if (!referralSearch) return data.referredUsers;
    const q = referralSearch.toLowerCase();
    return data.referredUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id?.includes(q),
    );
  }, [data.referredUsers, referralSearch]);

  const filteredCompetitions = useMemo(() => {
    if (compFilter === "all") return data.competitions;
    return data.competitions.filter((c) => c.status === compFilter);
  }, [data.competitions, compFilter]);

  const filteredEarnings = useMemo(() => {
    if (earningsFilter === "all") return data.earnings;
    return data.earnings.filter((e) => e.status === earningsFilter);
  }, [data.earnings, earningsFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900/50 text-green-400";
      case "completed":
        return "bg-gray-700 text-gray-300";
      case "upcoming":
        return "bg-blue-900/50 text-blue-400";
      case "cancelled":
        return "bg-red-900/50 text-red-400";
      case "expired":
        return "bg-gray-700 text-gray-300";
      case "suspended":
        return "bg-red-900/50 text-red-400";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  // ─── Tabs ────────────────────────────────────────
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    {
      id: "competitions" as const,
      label: `Competitions (${data.competitions.length})`,
      icon: Trophy,
    },
    {
      id: "referrals" as const,
      label: `Referrals (${data.referredUsers.length})`,
      icon: Users,
    },
    {
      id: "earnings" as const,
      label: `Earnings (${data.earnings.length})`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to list
      </button>

      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-900/50 rounded-lg">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{gm.userName}</h2>
            <p className="text-gray-400">{gm.userEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-1 rounded text-xs ${getStatusColor(gm.status)}`}
              >
                {gm.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                Code: {gm.referralCode}
              </span>
            </div>
            <Link
              href={`/dashboard?activeTab=users&userId=${gm.userId}`}
              className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <User className="h-3 w-3" />
              View User Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {gm.status === "active" && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded ${
                gm.limits?.canCreateCompetitions !== false
                  ? "bg-green-600/20 text-green-400 border border-green-600/50"
                  : "bg-gray-600/20 text-gray-400 border border-gray-600/50"
              }`}
              title={`Based on ${gm.packageName} package settings`}
            >
              <Trophy className="h-4 w-4" />
              {gm.limits?.canCreateCompetitions !== false
                ? "Comps: ON"
                : "Comps: OFF"}
            </div>
          )}
          {gm.status === "active" && (
            <button
              onClick={() =>
                onAction(gm.id, "suspend", {
                  reason: "Suspended by admin",
                })
              }
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Suspend
            </button>
          )}
          {gm.status === "suspended" && (
            <button
              onClick={() => onAction(gm.id, "reactivate")}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Reactivate
            </button>
          )}
          <button
            onClick={() =>
              onAction(gm.id, "extend", { extensionDays: 30 })
            }
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            Extend 30 Days
          </button>
          <button
            onClick={() => onAction(gm.id, "revoke")}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Revoke
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Days Left"
          value={daysRemaining}
          color={isCritical ? "red" : isExpiringSoon ? "yellow" : "white"}
          subtitle={
            isCritical
              ? "⚠️ Expires soon!"
              : isExpiringSoon
                ? "⏰ Expiring soon"
                : undefined
          }
        />
        <KPICard
          label="Total Referrals"
          value={gm.totalReferredUsers}
          color="blue"
        />
        <KPICard
          label="Total Earnings"
          value={(gm.totalEarnings ?? 0).toFixed(2)}
          color="green"
          prefix=""
        />
        <KPICard
          label="Pending Payout"
          value={(gm.pendingEarnings ?? 0).toFixed(2)}
          color="yellow"
          prefix=""
        />
        <KPICard
          label="Competitions"
          value={gm.totalCompetitionsCreated}
          color="purple"
        />
        <KPICard
          label="Active Comps"
          value={compStats.active}
          color="emerald"
        />
      </div>

      {/* ─── Tab Navigation ─────────────────────────── */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeSection === tab.id
                ? "bg-gray-700 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ────────────────────────────── */}
      {activeSection === "overview" && (
        <OverviewTab
          gm={gm}
          compStats={compStats}
          earningStats={earningStats}
          daysRemaining={daysRemaining}
        />
      )}

      {activeSection === "competitions" && (
        <CompetitionsTab
          competitions={filteredCompetitions}
          filter={compFilter}
          onFilterChange={setCompFilter}
          stats={compStats}
          getStatusColor={getStatusColor}
        />
      )}

      {activeSection === "referrals" && (
        <ReferralsTab
          referrals={filteredReferrals}
          search={referralSearch}
          onSearchChange={setReferralSearch}
          total={data.referredUsers.length}
        />
      )}

      {activeSection === "earnings" && (
        <EarningsTab
          earnings={filteredEarnings}
          filter={earningsFilter}
          onFilterChange={setEarningsFilter}
          stats={earningStats}
          getStatusColor={getStatusColor}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────

function KPICard({
  label,
  value,
  color = "white",
  subtitle,
  prefix,
}: {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
  prefix?: string;
}) {
  const colorMap: Record<string, string> = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    white: "text-white",
  };
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color] || "text-white"}`}>
        {prefix !== undefined ? prefix : ""}
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-0.5 ${colorMap[color] || "text-gray-400"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────
function OverviewTab({
  gm,
  compStats,
  earningStats,
  daysRemaining,
}: {
  gm: GMSubscription;
  compStats: {
    active: number;
    completed: number;
    upcoming: number;
    cancelled: number;
    totalPrizePool: number;
    totalParticipants: number;
    total: number;
  };
  earningStats: {
    paid: number;
    pending: number;
    fromComps: number;
    fromChallenges: number;
  };
  daysRemaining: number;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Subscription Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          Subscription Details
        </h3>
        <div className="space-y-3 text-sm">
          <InfoRow label="Package" value={gm.packageName} />
          <InfoRow
            label="Referral Code"
            value={gm.referralCode}
            className="font-mono text-amber-400"
          />
          <InfoRow
            label="Start Date"
            value={new Date(gm.startDate).toLocaleDateString()}
          />
          <InfoRow
            label="End Date"
            value={new Date(gm.endDate).toLocaleDateString()}
          />
          <InfoRow
            label="Days Remaining"
            value={`${daysRemaining} days`}
            className={
              daysRemaining <= 3
                ? "text-red-400"
                : daysRemaining <= 7
                  ? "text-yellow-400"
                  : "text-white"
            }
          />
          <InfoRow
            label="Auto-Renewal"
            value={gm.autoRenew ? "Enabled" : "Disabled"}
            className={gm.autoRenew ? "text-green-400" : "text-red-400"}
          />
          <InfoRow
            label="Renewal Price"
            value={`${gm.renewalPrice} Credits`}
          />
          <hr className="border-gray-700 my-2" />
          <InfoRow
            label="Can Create Competitions"
            value={
              gm.limits?.canCreateCompetitions !== false
                ? "Yes"
                : "No (Package)"
            }
            className={
              gm.limits?.canCreateCompetitions !== false
                ? "text-green-400"
                : "text-gray-500"
            }
          />
          {gm.limits?.canCreateCompetitions !== false && (
            <>
              <InfoRow
                label="Max Competitions/Day"
                value={gm.limits?.maxCompetitionsPerDay || 1}
              />
              <InfoRow
                label="Max Users/Competition"
                value={gm.limits?.maxUsersPerCompetition || 50}
              />
            </>
          )}
          <InfoRow
            label="Referral Fee %"
            value={`${gm.limits?.referralFeePercentage || 0}%`}
          />
        </div>
      </div>

      {/* Performance Summary */}
      <div className="space-y-6">
        {/* Earnings Breakdown */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Earnings Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat
              label="Total Earned"
              value={`${(gm.totalEarnings ?? 0).toFixed(2)}`}
              color="green"
            />
            <MiniStat
              label="Pending"
              value={`${(gm.pendingEarnings ?? 0).toFixed(2)}`}
              color="yellow"
            />
            <MiniStat
              label="From Competitions"
              value={`${earningStats.fromComps.toFixed(2)}`}
              color="purple"
            />
            <MiniStat
              label="From Challenges"
              value={`${earningStats.fromChallenges.toFixed(2)}`}
              color="blue"
            />
          </div>
        </div>

        {/* Competition Summary */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Competition Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat
              label="Total Created"
              value={compStats.total}
              color="white"
            />
            <MiniStat
              label="Active"
              value={compStats.active}
              color="green"
            />
            <MiniStat
              label="Completed"
              value={compStats.completed}
              color="gray"
            />
            <MiniStat
              label="Total Participants"
              value={compStats.totalParticipants}
              color="blue"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Competitions Tab ────────────────────────────────────────────────
function CompetitionsTab({
  competitions,
  filter,
  onFilterChange,
  stats,
  getStatusColor,
}: {
  competitions: GMCompetition[];
  filter: string;
  onFilterChange: (f: string) => void;
  stats: {
    active: number;
    completed: number;
    upcoming: number;
    cancelled: number;
    totalPrizePool: number;
    totalParticipants: number;
    total: number;
  };
  getStatusColor: (s: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-400">
          Total: {stats.total} competitions
        </span>
        <span className="text-sm text-gray-500">•</span>
        <span className="text-sm text-gray-400">
          Total prize pools: {stats.totalPrizePool.toFixed(0)} credits
        </span>
        <span className="text-sm text-gray-500">•</span>
        <span className="text-sm text-gray-400">
          Total participants: {stats.totalParticipants}
        </span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {["all", "active", "upcoming", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {competitions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Trophy className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No competitions found for this filter.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Participants</th>
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
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusColor(comp.status)}`}
                      >
                        {comp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {comp.participants}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(comp.prizePool || 0).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(comp.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
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

// ─── Referrals Tab ───────────────────────────────────────────────────
function ReferralsTab({
  referrals,
  search,
  onSearchChange,
  total,
}: {
  referrals: ReferredUser[];
  search: string;
  onSearchChange: (s: string) => void;
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          Total referrals: {total}
        </span>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-400"
          />
        </div>
      </div>

      {referrals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          {search ? "No referrals match your search." : "No referrals yet."}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Referred At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-700/50 hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">
                        {user.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-500 text-xs font-mono">
                        {user.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(
                        user.referredAt || user.createdAt,
                      ).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard?activeTab=users&userId=${user.id}`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <User className="h-3 w-3" />
                        View User
                      </Link>
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

// ─── Earnings Tab ────────────────────────────────────────────────────
function EarningsTab({
  earnings,
  filter,
  onFilterChange,
  stats,
  getStatusColor,
}: {
  earnings: GMEarning[];
  filter: string;
  onFilterChange: (f: string) => void;
  stats: {
    paid: number;
    pending: number;
    fromComps: number;
    fromChallenges: number;
  };
  getStatusColor: (s: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          label="Paid"
          value={`${stats.paid.toFixed(2)}`}
          color="green"
        />
        <MiniStat
          label="Pending"
          value={`${stats.pending.toFixed(2)}`}
          color="yellow"
        />
        <MiniStat
          label="From Competitions"
          value={`${stats.fromComps.toFixed(2)}`}
          color="purple"
        />
        <MiniStat
          label="From Challenges"
          value={`${stats.fromChallenges.toFixed(2)}`}
          color="blue"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {["all", "paid", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
        <div className="text-center py-8 text-gray-400">
          <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No earnings found for this filter.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700 bg-gray-900/50">
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
                    <td className="px-4 py-3 text-white text-sm">
                      {e.sourceName}
                    </td>
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
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {e.referredUserName}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {e.entryFeeAmount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-green-400 font-medium text-sm">
                      +{(e.netEarning ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          e.status === "paid"
                            ? "bg-green-900/50 text-green-400"
                            : "bg-yellow-900/50 text-yellow-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
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

// ─── Helpers ─────────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  className = "text-white",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color = "white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    gray: "text-gray-300",
    white: "text-white",
  };
  return (
    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorMap[color] || "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
