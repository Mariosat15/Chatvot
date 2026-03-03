"use client";

import { Users, DollarSign, Trophy, TrendingUp, Filter, Search, Plus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import Link from "next/link";
import { Shield } from "lucide-react";
import type { DashboardStats, CompetitionItem, EarningItem, ReferralItem, SubscriptionData } from "./gamemaster-dashboard-types";

// Re-export types so existing imports still work
export type { DashboardStats, CompetitionItem, EarningItem, ReferralItem, SubscriptionData };

// ─── Constants ────────────────────────────────────────────────────────
const PIE_COLORS = ["#22c55e", "#eab308", "#6366f1", "#ef4444", "#64748b"];

function StatusBadge({ status }: { status: string }) {
  const statusMap = new Map([
    ["active", "bg-emerald-900/50 text-emerald-400"],
    ["upcoming", "bg-blue-900/50 text-blue-400"],
    ["completed", "bg-gray-700 text-gray-300"],
    ["cancelled", "bg-red-900/50 text-red-400"],
    ["paid", "bg-emerald-900/50 text-emerald-400"],
    ["pending", "bg-yellow-900/50 text-yellow-400"],
  ]);
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${statusMap.get(status) ?? "bg-gray-700 text-gray-300"}`}>
      {status}
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: "emerald" | "yellow" | "blue" | "purple" }) {
  const bgMap = new Map<string, string>([
    ["emerald", "border-emerald-700/30"],
    ["yellow", "border-yellow-700/30"],
    ["blue", "border-blue-700/30"],
    ["purple", "border-purple-700/30"],
  ]);
  const txMap = new Map<string, string>([
    ["emerald", "text-emerald-400"],
    ["yellow", "text-yellow-400"],
    ["blue", "text-blue-400"],
    ["purple", "text-purple-400"],
  ]);
  return (
    <div className={`rounded-xl p-4 border ${bgMap.get(color) ?? ""} bg-gray-800/50`}>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-lg font-bold ${txMap.get(color) ?? ""}`}>{value}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────
export function OverviewTab({ stats, subscription, earningsChartData, compStatusPieData, compStats }: {
  stats: DashboardStats;
  subscription: SubscriptionData;
  earningsChartData: Array<{ month: string; earnings: number }>;
  compStatusPieData: Array<{ name: string; value: number }>;
  compStats: { active: number; completed: number; upcoming: number; cancelled: number; totalParticipants: number; totalPrizePool: number } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" /> Earnings Over Time
          </h3>
          {earningsChartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">No earnings data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={earningsChartData}>
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }} />
                <Bar dataKey="earnings" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Competition Status Pie */}
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Competition Breakdown
          </h3>
          {compStatusPieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">No competitions yet</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={180}>
                <PieChart>
                  <Pie data={compStatusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} strokeWidth={2} stroke="#0a0a0f">
                    {compStatusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {compStatusPieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-300">{d.name}</span>
                    <span className="text-white font-bold ml-auto">{d.value}</span>
                  </div>
                ))}
                {compStats && (
                  <div className="pt-2 border-t border-gray-700 mt-2 text-gray-400 text-xs space-y-1">
                    <p>Total participants: <span className="text-white">{compStats.totalParticipants}</span></p>
                    <p>Total prize pools: <span className="text-white">⚡ {compStats.totalPrizePool.toFixed(0)}</span></p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Overview */}
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" /> Subscription Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <InfoBlock label="Status">
            <span className={subscription.status === "active" ? "text-emerald-400" : "text-red-400"}>
              {subscription.status === "active" ? "Active" : "Inactive"}
            </span>
          </InfoBlock>
          <InfoBlock label="Auto-Renewal">
            <span className={subscription.autoRenew ? "text-emerald-400" : "text-yellow-400"}>
              {subscription.autoRenew ? "Enabled" : "Disabled"}
            </span>
          </InfoBlock>
          <InfoBlock label="Renewal Price">
            <span className="text-white">⚡ {(subscription.renewalPrice || 0).toLocaleString()}</span>
          </InfoBlock>
          <InfoBlock label="End Date">
            <span className="text-white">{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : "N/A"}</span>
          </InfoBlock>
          <InfoBlock label="Comps Today">
            <span className="text-white">{subscription.currentPeriodCompetitionsCreated || 0} / {subscription.limits.maxCompetitionsPerDay || 0}</span>
          </InfoBlock>
          <InfoBlock label="Max Users/Comp">
            <span className="text-white">{subscription.limits.maxUsersPerCompetition || 0}</span>
          </InfoBlock>
        </div>
      </div>

      {/* Quick Earnings Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Total Earned" value={`⚡ ${(stats.totalEarnings ?? 0).toFixed(2)}`} color="emerald" />
        <MiniStat label="Paid Out" value={`⚡ ${(stats.paidEarnings ?? 0).toFixed(2)}`} color="emerald" />
        <MiniStat label="Pending" value={`⚡ ${(stats.pendingEarnings ?? 0).toFixed(2)}`} color="yellow" />
        <MiniStat label="Transactions" value={String(stats.totalTransactions ?? 0)} color="blue" />
      </div>
    </div>
  );
}

// ─── Competitions Tab ─────────────────────────────────────────────────
export function CompetitionsTab({ competitions, filter, onFilterChange, subscription, isExpired }: {
  competitions: CompetitionItem[]; filter: string; onFilterChange: (f: string) => void; subscription: SubscriptionData; isExpired: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-400" />
          {["all", "active", "upcoming", "completed", "cancelled"].map((f) => (
            <button key={f} onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {subscription.canCreateCompetitions && (
          <Link href={isExpired ? "#" : "/gamemaster/create-competition"} onClick={(e) => isExpired && e.preventDefault()}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isExpired ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-600 hover:to-amber-600"}`}>
            <Plus className="h-4 w-4" /> Create Competition
          </Link>
        )}
      </div>

      {competitions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Trophy className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No competitions match this filter.
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3 font-medium">Competition</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Players</th>
                  <th className="px-4 py-3 font-medium">Entry Fee</th>
                  <th className="px-4 py-3 font-medium">Prize Pool</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((comp) => (
                  <tr key={comp.id} className="border-b border-gray-700/50 hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{comp.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={comp.status} /></td>
                    <td className="px-4 py-3 text-gray-300">{comp.participants}{comp.maxParticipants ? ` / ${comp.maxParticipants}` : ""}</td>
                    <td className="px-4 py-3 text-gray-300">⚡ {comp.entryFee}</td>
                    <td className="px-4 py-3 text-gray-300">⚡ {(comp.prizePool || 0).toFixed(0)}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(comp.startTime).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(comp.endTime).toLocaleDateString()}</td>
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

// ─── Referrals Tab ────────────────────────────────────────────────────
export function ReferralsTab({ referrals, search, onSearchChange, total }: {
  referrals: ReferralItem[]; search: string; onSearchChange: (s: string) => void; total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-sm text-gray-400">Total: <span className="text-white font-medium">{total}</span> referred users</span>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none transition-colors" />
        </div>
      </div>
      {referrals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          {search ? "No referrals match your search." : "No referrals yet. Share your link!"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {referrals.map((r) => (
            <div key={r._id} className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full flex items-center justify-center text-black font-bold text-sm shrink-0">
                {r.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{r.name}</p>
                <p className="text-gray-400 text-xs truncate">{r.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</p>
                {r.isActive !== undefined && (
                  <p className={`text-xs mt-0.5 ${r.isActive ? "text-emerald-400" : "text-gray-500"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Earnings Tab ─────────────────────────────────────────────────────
export function EarningsTab({ earnings, filter, onFilterChange, stats }: {
  earnings: EarningItem[]; filter: string; onFilterChange: (f: string) => void; stats: DashboardStats;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Total Earned" value={`⚡ ${(stats.totalEarnings ?? 0).toFixed(2)}`} color="emerald" />
        <MiniStat label="Paid Out" value={`⚡ ${(stats.paidEarnings ?? 0).toFixed(2)}`} color="emerald" />
        <MiniStat label="Pending" value={`⚡ ${(stats.pendingEarnings ?? 0).toFixed(2)}`} color="yellow" />
        <MiniStat label="Total Transactions" value={String(stats.totalTransactions ?? 0)} color="blue" />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {["all", "paid", "pending"].map((f) => (
          <button key={f} onClick={() => onFilterChange(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {earnings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-600" />
          No earnings match this filter.
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Referred User</th>
                  <th className="px-4 py-3 font-medium">Entry Fee</th>
                  <th className="px-4 py-3 font-medium">Earning</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-b border-gray-700/50 hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{e.sourceName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${e.sourceType === "competition" ? "bg-purple-900/50 text-purple-400" : "bg-blue-900/50 text-blue-400"}`}>
                        {e.sourceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{e.referredUserName}</td>
                    <td className="px-4 py-3 text-gray-300">⚡ {e.entryFeeAmount ?? 0}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">+{(e.netEarning ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3 text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</td>
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

// ─── Shared ───────────────────────────────────────────────────────────
function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
