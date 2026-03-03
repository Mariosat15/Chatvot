"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  DollarSign,
  Trophy,
  Search,
  RefreshCw,
  Crown,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Link2,
  Database,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import GameMasterDetailView, {
  type DetailedGameMasterData,
} from "./GameMasterDetailView";

interface GameMaster {
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
}

interface Stats {
  totalActive: number;
  totalExpired: number;
  totalSuspended: number;
  totalEarnings: number;
  totalReferrals: number;
  totalCompetitions: number;
}

// Reason: DetailedGameMaster interface is now exported from GameMasterDetailView
type DetailedGameMaster = DetailedGameMasterData;

interface SyncStatus {
  totalReferrals: number;
  synced: number;
  needsSync: number;
  missingUsers: number;
  sampleNeedsSync?: Array<{ userId: string; userName: string; gmId: string }>;
}

interface SyncResult {
  totalReferrals: number;
  synced: number;
  alreadyCorrect: number;
  errors: number;
  errorDetails?: string[];
}

interface GameMasterManagementSectionProps {
  initialGmId?: string;
}

export default function GameMasterManagementSection({
  initialGmId,
}: GameMasterManagementSectionProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [gamemasters, setGamemasters] = useState<GameMaster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGM, setSelectedGM] = useState<DetailedGameMaster | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Sync referrals state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const fetchGameMasters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/gamemasters?${params}`);
      if (!response.ok) throw new Error("Failed to fetch game masters");

      const data = await response.json();
      setGamemasters(data.gamemasters);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchGameMasters();
  }, [fetchGameMasters]);

  // Handle initial GM ID to auto-open specific GM's detail view
  useEffect(() => {
    if (initialGmId && !selectedGM && !detailLoading) {
      viewDetails(initialGmId);
    }
  }, [initialGmId]);

  const viewDetails = async (gmId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/gamemasters/${gmId}`);
      if (!response.ok) throw new Error("Failed to fetch details");

      const data = await response.json();
      setSelectedGM(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (
    gmId: string,
    action: string,
    extraData?: Record<string, unknown>,
  ) => {
    // Skip confirmation for toggle actions (modal already serves as confirmation)
    if (action !== "toggleCompetitionCreation") {
      if (!confirm(`Are you sure you want to ${action} this game master?`))
        return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/gamemasters/${gmId}`, {
        method: action === "revoke" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extraData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      await fetchGameMasters();
      if (selectedGM) {
        await viewDetails(gmId);
      }

      // Only show alert for non-toggle actions
      if (action !== "toggleCompetitionCreation") {
        alert(`${action} successful`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900/50 text-green-400";
      case "expired":
        return "bg-gray-700 text-gray-300";
      case "suspended":
        return "bg-red-900/50 text-red-400";
      case "cancelled":
        return "bg-red-900/50 text-red-400";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  // Check sync status
  const checkSyncStatus = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/gamemasters/sync-referrals");
      if (!response.ok) throw new Error("Failed to check sync status");

      const data = await response.json();
      if (data.success) {
        setSyncStatus(data.data);
        setShowSyncPanel(true);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to check sync status");
    } finally {
      setSyncLoading(false);
    }
  };

  // Perform sync
  const performSync = async () => {
    if (
      !confirm(
        "This will sync all UserReferral records to user documents. Continue?",
      )
    )
      return;

    setSyncLoading(true);
    try {
      const response = await fetch("/api/gamemasters/sync-referrals", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to perform sync");

      const data = await response.json();
      if (data.success) {
        setSyncResult(data.data);
        setSyncStatus(null); // Clear status to show result
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to perform sync");
    } finally {
      setSyncLoading(false);
    }
  };

  // Detail view — delegated to the extracted component
  if (selectedGM) {
    return (
      <GameMasterDetailView
        data={selectedGM}
        onBack={() => {
          setSelectedGM(null);
          if (initialGmId) {
            router.replace(pathname, { scroll: false });
          }
        }}
        onAction={handleAction}
        actionLoading={actionLoading}
      />
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Game Master Management
          </h2>
          <p className="text-gray-400">Manage all game master subscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkSyncStatus}
            disabled={syncLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            title="Check and sync referral data"
          >
            <Database
              className={`h-4 w-4 ${syncLoading ? "animate-pulse" : ""}`}
            />
            Sync Referrals
          </button>
          <button
            onClick={fetchGameMasters}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sync Referrals Panel */}
      {showSyncPanel && (
        <div className="bg-gray-800 rounded-lg border border-amber-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link2 className="h-6 w-6 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">
                Referral Data Sync
              </h3>
            </div>
            <button
              onClick={() => {
                setShowSyncPanel(false);
                setSyncStatus(null);
                setSyncResult(null);
              }}
              className="text-gray-400 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {syncStatus && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                This tool syncs referral data from the UserReferral collection
                to user documents, ensuring competition/challenge finalization
                correctly identifies referred users.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-gray-400 text-xs">Total Referrals</p>
                  <p className="text-xl font-bold text-white">
                    {syncStatus.totalReferrals}
                  </p>
                </div>
                <div className="bg-green-900/30 rounded p-3 border border-green-700/30">
                  <p className="text-gray-400 text-xs">Already Synced</p>
                  <p className="text-xl font-bold text-green-400">
                    {syncStatus.synced}
                  </p>
                </div>
                <div
                  className={`rounded p-3 ${syncStatus.needsSync > 0 ? "bg-amber-900/30 border border-amber-700/30" : "bg-gray-900/50"}`}
                >
                  <p className="text-gray-400 text-xs">Needs Sync</p>
                  <p
                    className={`text-xl font-bold ${syncStatus.needsSync > 0 ? "text-amber-400" : "text-gray-400"}`}
                  >
                    {syncStatus.needsSync}
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded p-3">
                  <p className="text-gray-400 text-xs">Missing Users</p>
                  <p className="text-xl font-bold text-gray-400">
                    {syncStatus.missingUsers}
                  </p>
                </div>
              </div>

              {syncStatus.sampleNeedsSync &&
                syncStatus.sampleNeedsSync.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-sm mb-2">
                      Users needing sync:
                    </p>
                    <div className="bg-gray-900/50 rounded p-3 max-h-32 overflow-y-auto">
                      {syncStatus.sampleNeedsSync.map((user, i) => (
                        <div
                          key={i}
                          className="text-sm text-gray-300 py-1 border-b border-gray-700/50 last:border-0"
                        >
                          {user.userName} ({user.userId.slice(0, 8)}...) → GM:{" "}
                          {user.gmId.slice(0, 8)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={performSync}
                  disabled={syncLoading || syncStatus.needsSync === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  {syncStatus.needsSync === 0
                    ? "All Synced"
                    : `Sync ${syncStatus.needsSync} Users`}
                </button>
                <button
                  onClick={checkSyncStatus}
                  disabled={syncLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`}
                  />
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          {syncResult && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${syncResult.errors > 0 ? "bg-yellow-900/30 border border-yellow-700/50" : "bg-green-900/30 border border-green-700/50"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {syncResult.errors > 0 ? (
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  )}
                  <span
                    className={`font-semibold ${syncResult.errors > 0 ? "text-yellow-400" : "text-green-400"}`}
                  >
                    Sync Complete
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <p className="text-gray-400 text-xs">Total Processed</p>
                    <p className="text-lg font-bold text-white">
                      {syncResult.totalReferrals}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Newly Synced</p>
                    <p className="text-lg font-bold text-green-400">
                      {syncResult.synced}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Already Correct</p>
                    <p className="text-lg font-bold text-gray-300">
                      {syncResult.alreadyCorrect}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Errors</p>
                    <p
                      className={`text-lg font-bold ${syncResult.errors > 0 ? "text-red-400" : "text-gray-400"}`}
                    >
                      {syncResult.errors}
                    </p>
                  </div>
                </div>
                {syncResult.errorDetails &&
                  syncResult.errorDetails.length > 0 && (
                    <div className="mt-3 p-2 bg-red-900/30 rounded text-sm text-red-300">
                      <p className="font-medium mb-1">Errors:</p>
                      {syncResult.errorDetails.map((err, i) => (
                        <p key={i} className="text-xs">
                          {err}
                        </p>
                      ))}
                    </div>
                  )}
              </div>
              <button
                onClick={checkSyncStatus}
                disabled={syncLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`}
                />
                Check Status Again
              </button>
            </div>
          )}
        </div>
      )}

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
            <p className="text-2xl font-bold text-white">
              {stats.totalExpired}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-red-700/50">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Suspended</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalSuspended}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-blue-700/50">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalReferrals}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-purple-700/50">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Competitions</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalCompetitions}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-green-700/50">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {(stats.totalEarnings ?? 0).toFixed(2)}
            </p>
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
                <tr
                  key={gm.id}
                  className="border-b border-gray-700/50 hover:bg-gray-900/30"
                >
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{gm.userName}</p>
                    <p className="text-gray-400 text-sm">{gm.userEmail}</p>
                    <Link
                      href={`/dashboard?activeTab=users&userId=${gm.userId}`}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <User className="h-3 w-3" />
                      View User
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{gm.packageName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${getStatusColor(gm.status)}`}
                    >
                      {gm.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        gm.limits?.canCreateCompetitions !== false
                          ? "bg-green-900/50 text-green-400"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {gm.limits?.canCreateCompetitions !== false
                        ? "ON"
                        : "OFF"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-amber-400">
                      {gm.referralCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {gm.totalReferredUsers ?? 0}
                  </td>
                  <td className="px-4 py-3 text-green-400">
                    {(gm.totalEarnings ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const daysLeft = Math.max(
                        0,
                        Math.ceil(
                          (new Date(gm.endDate).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24),
                        ),
                      );
                      const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
                      const isCritical = daysLeft > 0 && daysLeft <= 3;

                      return (
                        <div
                          className={`${isCritical ? "text-red-400" : isExpiringSoon ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          {new Date(gm.endDate).toLocaleDateString()}
                          {isCritical && (
                            <span className="ml-2 text-xs bg-red-500/20 px-1.5 py-0.5 rounded">
                              ⚠️ {daysLeft}d
                            </span>
                          )}
                          {isExpiringSoon && !isCritical && (
                            <span className="ml-2 text-xs bg-yellow-500/20 px-1.5 py-0.5 rounded">
                              {daysLeft}d
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
