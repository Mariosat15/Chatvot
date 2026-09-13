"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Swords,
  Trash2,
  Eye,
  Users,
  Calendar,
  DollarSign,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
  Loader2,
  Search,
  Filter,
  History,
  Settings,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ChallengeSettingsSection from "./ChallengeSettingsSection";

// Live countdown badge component
function LiveCountdownBadge({
  targetDate,
  label,
  isEnding = false,
}: {
  targetDate: string;
  label: string;
  isEnding?: boolean;
}) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(isEnding ? "Ended" : "Started");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate, isEnding]);

  return (
    <div
      className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 ${
        isEnding
          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
          : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      }`}
    >
      <Clock className="h-3 w-3 animate-pulse" />
      <span className="text-gray-400">{label}:</span>
      <span className="font-mono tabular-nums">{countdown}</span>
    </div>
  );
}

interface FinalStats {
  finalCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winRate: number;
  isDisqualified: boolean;
  disqualificationReason?: string;
}

interface Challenge {
  _id: string;
  slug: string;
  challengerId: string;
  challengerName: string;
  challengerEmail: string;
  challengedId: string;
  challengedName: string;
  challengedEmail: string;
  entryFee: number;
  startingCapital: number;
  prizePool: number;
  platformFeePercentage: number;
  platformFeeAmount: number;
  winnerPrize: number;
  createdAt: string;
  acceptDeadline: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "expired"
    | "active"
    | "completed"
    | "cancelled";
  winnerId?: string;
  winnerName?: string;
  winnerPnL?: number;
  loserId?: string;
  loserName?: string;
  loserPnL?: number;
  isTie?: boolean;
  // Final stats from challenge finalization
  challengerFinalStats?: FinalStats;
  challengedFinalStats?: FinalStats;
}

interface GmInfo {
  gameMasterId: string;
  gameMasterEmail: string;
  netEarning: number;
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  active: number;
  completed: number;
  declined: number;
  expired: number;
  cancelled: number;
  totalPrizePool: number;
  totalFees: number;
}

type Tab = "active" | "history" | "settings";

export default function ChallengesAdminSection() {
  const { settings } = useAppSettings();
  const cs = settings?.currency?.symbol || "€";
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [challengeToCancel, setChallengeToCancel] = useState<Challenge | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(
    null,
  );
  const [challengeGmInfo, setChallengeGmInfo] = useState<{
    challenger?: GmInfo;
    challenged?: GmInfo;
  }>({});

  // Fetch GM info when viewing a challenge
  const fetchChallengeGmInfo = useCallback(
    async (challengeId: string, challengerId: string, challengedId: string) => {
      try {
        const response = await fetch(
          `/api/challenges/${challengeId}/gm-info?challengerId=${challengerId}&challengedId=${challengedId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setChallengeGmInfo(data);
        }
      } catch (error) {
        console.error("Error fetching GM info:", error);
      }
    },
    [],
  );

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Set status based on tab
      if (activeTab === "active") {
        params.set("status", "active_all");
      } else if (activeTab === "history") {
        if (statusFilter) {
          params.set("status", statusFilter);
        } else {
          params.set("status", "history");
        }
      }

      if (searchQuery) params.set("search", searchQuery);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", page.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/challenges?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setChallenges(data.challenges || []);
      setStats(data.stats);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      toast.error("Failed to load challenges");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, searchQuery, dateFrom, dateTo, page]);

  useEffect(() => {
    if (activeTab !== "settings") {
      fetchChallenges();
    }
  }, [fetchChallenges, activeTab]);

  const handleCancelClick = (challenge: Challenge) => {
    setChallengeToCancel(challenge);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!challengeToCancel) return;

    setIsCancelling(true);
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          challengeId: challengeToCancel._id,
          reason: cancelReason || "Cancelled by admin",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel challenge");
      }

      toast.success(data.message || "Challenge cancelled successfully");
      fetchChallenges();
      setCancelDialogOpen(false);
      setChallengeToCancel(null);
      setCancelReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel challenge",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleViewClick = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setChallengeGmInfo({}); // Reset GM info
    setViewDialogOpen(true);
    // Fetch GM info for this challenge
    if (challenge.status === "completed" || challenge.status === "active") {
      fetchChallengeGmInfo(
        challenge._id,
        challenge.challengerId,
        challenge.challengedId,
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "accepted":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "completed":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "declined":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "expired":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Swords className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <Trophy className="h-4 w-4" />;
      case "declined":
        return <XCircle className="h-4 w-4" />;
      case "expired":
        return <Clock className="h-4 w-4" />;
      case "cancelled":
        return <Ban className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Swords className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  ⚔️ 1v1 Challenges
                </h2>
                <p className="text-orange-100 mt-1">
                  Manage trader vs trader challenges
                </p>
              </div>
            </div>
            {stats && (
              <div className="flex items-center gap-4 text-white/80">
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-white/60">Total Challenges</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-300">
                    {cs}{stats.totalFees.toFixed(0)}
                  </div>
                  <div className="text-xs text-white/60">Platform Fees</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => {
              setActiveTab("active");
              setPage(1);
              setStatusFilter("");
            }}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "active"
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/10"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Swords className="h-4 w-4" />
            Active Challenges
            {stats && (
              <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">
                {stats.pending + stats.accepted + stats.active}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              setPage(1);
              setStatusFilter("");
            }}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "history"
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/10"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <History className="h-4 w-4" />
            History
            {stats && (
              <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full text-xs">
                {stats.completed +
                  stats.declined +
                  stats.expired +
                  stats.cancelled}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "settings"
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/10"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Tab */}
      {activeTab === "settings" && <ChallengeSettingsSection />}

      {/* Active / History Tabs */}
      {activeTab !== "settings" && (
        <>
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Pending
                    </p>
                    <p className="text-xl font-bold text-yellow-400">
                      {stats.pending}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-yellow-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-blue-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Accepted
                    </p>
                    <p className="text-xl font-bold text-blue-400">
                      {stats.accepted}
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-blue-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Active
                    </p>
                    <p className="text-xl font-bold text-green-400">
                      {stats.active}
                    </p>
                  </div>
                  <Swords className="h-5 w-5 text-green-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Completed
                    </p>
                    <p className="text-xl font-bold text-purple-400">
                      {stats.completed}
                    </p>
                  </div>
                  <Trophy className="h-5 w-5 text-purple-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-orange-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Declined
                    </p>
                    <p className="text-xl font-bold text-orange-400">
                      {stats.declined}
                    </p>
                  </div>
                  <XCircle className="h-5 w-5 text-orange-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Expired
                    </p>
                    <p className="text-xl font-bold text-gray-400">
                      {stats.expired}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-gray-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-red-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Cancelled
                    </p>
                    <p className="text-xl font-bold text-red-400">
                      {stats.cancelled}
                    </p>
                  </div>
                  <Ban className="h-5 w-5 text-red-500/50" />
                </div>
              </div>
              <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      Prize Pool
                    </p>
                    <p className="text-xl font-bold text-green-400">
                      {cs}{stats.totalPrizePool.toFixed(0)}
                    </p>
                  </div>
                  <DollarSign className="h-5 w-5 text-green-500/50" />
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              {activeTab === "history" && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select
                    value={statusFilter || "all"}
                    onValueChange={(v) => {
                      setStatusFilter(v === "all" ? "" : v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px] bg-gray-900 border-gray-600 text-white">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="all" className="text-white">
                        All Statuses
                      </SelectItem>
                      <SelectItem value="completed" className="text-white">
                        Completed
                      </SelectItem>
                      <SelectItem value="declined" className="text-white">
                        Declined
                      </SelectItem>
                      <SelectItem value="expired" className="text-white">
                        Expired
                      </SelectItem>
                      <SelectItem value="cancelled" className="text-white">
                        Cancelled
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-[140px] bg-gray-900 border-gray-600 text-white"
                  placeholder="From"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-[140px] bg-gray-900 border-gray-600 text-white"
                  placeholder="To"
                />
              </div>

              <Button
                variant="outline"
                onClick={fetchChallenges}
                className="border-gray-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Challenges List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
            </div>
          ) : challenges.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-12 text-center">
              <Swords className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                No Challenges Found
              </h3>
              <p className="text-gray-500">
                {activeTab === "active"
                  ? "No active challenges at the moment."
                  : "No challenges match your filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge._id}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                          <Swords className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-gray-100">
                              {challenge.challengerName}
                            </h3>
                            <span className="text-gray-500">vs</span>
                            <h3 className="text-base font-bold text-gray-100">
                              {challenge.challengedName}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {challenge.challengerEmail} vs{" "}
                            {challenge.challengedEmail}
                          </p>
                        </div>
                      </div>

                      {/* Status and Stats */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <div
                          className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 ${getStatusColor(challenge.status)}`}
                        >
                          {getStatusIcon(challenge.status)}
                          {challenge.status.toUpperCase()}
                        </div>

                        {/* Live Countdown for Pending */}
                        {challenge.status === "pending" && (
                          <LiveCountdownBadge
                            targetDate={challenge.acceptDeadline}
                            label="Expires in"
                          />
                        )}

                        {/* Time Remaining for Active */}
                        {challenge.status === "active" && challenge.endTime && (
                          <LiveCountdownBadge
                            targetDate={challenge.endTime}
                            label="Ends in"
                            isEnding
                          />
                        )}

                        {/* Winner badge for completed */}
                        {challenge.status === "completed" &&
                          challenge.winnerName && (
                            <div className="px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              <Trophy className="h-3 w-3" />
                              Winner: {challenge.winnerName}
                            </div>
                          )}
                        {challenge.status === "completed" &&
                          challenge.isTie && (
                            <div className="px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1 bg-gray-500/20 text-gray-400 border-gray-500/30">
                              <Users className="h-3 w-3" />
                              Tie
                            </div>
                          )}

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <DollarSign className="h-3 w-3" />
                          Entry: {cs}{challenge.entryFee}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Trophy className="h-3 w-3" />
                          Prize: {cs}{challenge.winnerPrize}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDuration(challenge.duration)}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <TrendingUp className="h-3 w-3" />
                          Capital: {cs}{challenge.startingCapital}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(challenge.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2">
                      <Link href={`/challenges/view/${challenge._id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>

                      {/* Cancel Button - Only for pending, accepted, or active challenges */}
                      {["pending", "accepted", "active"].includes(
                        challenge.status,
                      ) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelClick(challenge)}
                          className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Cancel & Refund
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-gray-600"
                  >
                    Previous
                  </Button>
                  <span className="text-gray-400 px-4">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="border-gray-600"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* View Challenge Dialog - Full screen layout matching competitions */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedChallenge && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 -m-6 mb-0 p-6 rounded-t-lg">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Swords className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-white">
                        1v1 Challenge
                      </h2>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedChallenge.status === "completed"
                            ? "bg-gray-500 text-white"
                            : selectedChallenge.status === "active"
                              ? "bg-green-500 text-white"
                              : selectedChallenge.status === "cancelled"
                                ? "bg-red-500 text-white"
                                : "bg-blue-500 text-white"
                        }`}
                      >
                        {selectedChallenge.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-orange-100 text-sm">
                      {selectedChallenge.challengerName} vs{" "}
                      {selectedChallenge.challengedName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-6">
                {/* Key Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">Prize Pool</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {cs}{selectedChallenge.prizePool}
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">Entry Fee</p>
                    <p className="text-2xl font-bold text-green-400">
                      {cs}{selectedChallenge.entryFee}
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">Winner Prize</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {cs}{selectedChallenge.winnerPrize}
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">Platform Fee</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {selectedChallenge.platformFeePercentage}%
                    </p>
                  </div>
                </div>

                {/* Participants / Results */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    {selectedChallenge.status === "completed"
                      ? "Final Results"
                      : "Participants"}
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Challenger */}
                    {(() => {
                      const stats = selectedChallenge.challengerFinalStats;
                      const isDisqualified = stats?.isDisqualified || false;
                      const isWinner =
                        selectedChallenge.winnerId ===
                        selectedChallenge.challengerId;
                      const gmInfo = challengeGmInfo.challenger;

                      return (
                        <div
                          className={`rounded-xl p-4 ${
                            isDisqualified
                              ? "bg-red-500/10 border-2 border-red-500/30"
                              : selectedChallenge.status === "completed" &&
                                  isWinner
                                ? "bg-yellow-500/10 border-2 border-yellow-500/30"
                                : "bg-gray-700/50 border border-gray-600"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <span className="text-xs text-gray-500 uppercase">
                              Challenger
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {isDisqualified ? (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                                  DISQUALIFIED
                                </span>
                              ) : selectedChallenge.status === "completed" &&
                                isWinner ? (
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
                                  🏆 WINNER
                                </span>
                              ) : null}
                              {gmInfo && (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded">
                                  GM Referral
                                </span>
                              )}
                            </div>
                          </div>
                          <p
                            className={`font-bold text-lg ${isDisqualified ? "text-red-300 line-through" : "text-white"}`}
                          >
                            {selectedChallenge.challengerName}
                          </p>
                          <p className="text-xs text-gray-400 mb-3">
                            {selectedChallenge.challengerEmail}
                          </p>

                          {selectedChallenge.status === "completed" &&
                            stats && (
                              <div className="space-y-2 pt-3 border-t border-gray-600">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">P&L:</span>
                                  <span
                                    className={`font-bold ${stats.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {stats.pnl >= 0 ? "+" : ""}
                                    {stats.pnl?.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">ROI:</span>
                                  <span
                                    className={`${stats.pnlPercentage >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {stats.pnlPercentage >= 0 ? "+" : ""}
                                    {stats.pnlPercentage?.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Trades:</span>
                                  <span className="text-white">
                                    {stats.totalTrades}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">
                                    Win Rate:
                                  </span>
                                  <span className="text-white">
                                    {stats.winRate?.toFixed(1)}%
                                  </span>
                                </div>
                                {isWinner && (
                                  <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                    <span className="text-gray-400">
                                      Prize Won:
                                    </span>
                                    <span className="text-yellow-400 font-bold">
                                      {cs}{selectedChallenge.winnerPrize}
                                    </span>
                                  </div>
                                )}
                                {isDisqualified &&
                                  stats.disqualificationReason && (
                                    <p className="text-xs text-red-400 mt-2">
                                      Reason: {stats.disqualificationReason}
                                    </p>
                                  )}
                              </div>
                            )}

                          {/* GM Info */}
                          {gmInfo && (
                            <div className="mt-3 pt-3 border-t border-purple-500/30 bg-purple-500/10 -mx-4 -mb-4 p-4 rounded-b-xl">
                              <p className="text-xs text-purple-400 font-semibold mb-1">
                                Game Master Referral
                              </p>
                              <p className="text-xs text-purple-300">
                                {gmInfo.gameMasterEmail}
                              </p>
                              <p className="text-xs text-purple-400 mt-1">
                                GM Earned:{" "}
                                <span className="font-bold">
                                  {cs}{gmInfo.netEarning.toFixed(2)}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Challenged */}
                    {(() => {
                      const stats = selectedChallenge.challengedFinalStats;
                      const isDisqualified = stats?.isDisqualified || false;
                      const isWinner =
                        selectedChallenge.winnerId ===
                        selectedChallenge.challengedId;
                      const gmInfo = challengeGmInfo.challenged;

                      return (
                        <div
                          className={`rounded-xl p-4 ${
                            isDisqualified
                              ? "bg-red-500/10 border-2 border-red-500/30"
                              : selectedChallenge.status === "completed" &&
                                  isWinner
                                ? "bg-yellow-500/10 border-2 border-yellow-500/30"
                                : "bg-gray-700/50 border border-gray-600"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <span className="text-xs text-gray-500 uppercase">
                              Challenged
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {isDisqualified ? (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                                  DISQUALIFIED
                                </span>
                              ) : selectedChallenge.status === "completed" &&
                                isWinner ? (
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
                                  🏆 WINNER
                                </span>
                              ) : null}
                              {gmInfo && (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded">
                                  GM Referral
                                </span>
                              )}
                            </div>
                          </div>
                          <p
                            className={`font-bold text-lg ${isDisqualified ? "text-red-300 line-through" : "text-white"}`}
                          >
                            {selectedChallenge.challengedName}
                          </p>
                          <p className="text-xs text-gray-400 mb-3">
                            {selectedChallenge.challengedEmail}
                          </p>

                          {selectedChallenge.status === "completed" &&
                            stats && (
                              <div className="space-y-2 pt-3 border-t border-gray-600">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">P&L:</span>
                                  <span
                                    className={`font-bold ${stats.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {stats.pnl >= 0 ? "+" : ""}
                                    {stats.pnl?.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">ROI:</span>
                                  <span
                                    className={`${stats.pnlPercentage >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {stats.pnlPercentage >= 0 ? "+" : ""}
                                    {stats.pnlPercentage?.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Trades:</span>
                                  <span className="text-white">
                                    {stats.totalTrades}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">
                                    Win Rate:
                                  </span>
                                  <span className="text-white">
                                    {stats.winRate?.toFixed(1)}%
                                  </span>
                                </div>
                                {isWinner && (
                                  <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                    <span className="text-gray-400">
                                      Prize Won:
                                    </span>
                                    <span className="text-yellow-400 font-bold">
                                      {cs}{selectedChallenge.winnerPrize}
                                    </span>
                                  </div>
                                )}
                                {isDisqualified &&
                                  stats.disqualificationReason && (
                                    <p className="text-xs text-red-400 mt-2">
                                      Reason: {stats.disqualificationReason}
                                    </p>
                                  )}
                              </div>
                            )}

                          {/* GM Info */}
                          {gmInfo && (
                            <div className="mt-3 pt-3 border-t border-purple-500/30 bg-purple-500/10 -mx-4 -mb-4 p-4 rounded-b-xl">
                              <p className="text-xs text-purple-400 font-semibold mb-1">
                                Game Master Referral
                              </p>
                              <p className="text-xs text-purple-300">
                                {gmInfo.gameMasterEmail}
                              </p>
                              <p className="text-xs text-purple-400 mt-1">
                                GM Earned:{" "}
                                <span className="font-bold">
                                  {cs}{gmInfo.netEarning.toFixed(2)}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Tie notification */}
                  {selectedChallenge.status === "completed" &&
                    selectedChallenge.isTie && (
                      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                        <p className="text-blue-400 font-semibold">
                          🤝 This challenge ended in a TIE
                        </p>
                        <p className="text-blue-300/70 text-sm">
                          Entry fees were refunded to both participants
                        </p>
                      </div>
                    )}
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-400" />
                      Configuration
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-700">
                        <span className="text-gray-400">Starting Capital</span>
                        <span className="text-white font-semibold">
                          ${selectedChallenge.startingCapital}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-700">
                        <span className="text-gray-400">Duration</span>
                        <span className="text-white font-semibold">
                          {formatDuration(selectedChallenge.duration)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-400">Platform Fee</span>
                        <span className="text-white font-semibold">
                          {selectedChallenge.platformFeePercentage}% ({cs}
                          {selectedChallenge.platformFeeAmount})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-400" />
                      Timeline
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-700">
                        <span className="text-gray-400">Created</span>
                        <span className="text-white">
                          {new Date(
                            selectedChallenge.createdAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      {selectedChallenge.startTime && (
                        <div className="flex justify-between py-2 border-b border-gray-700">
                          <span className="text-gray-400">Started</span>
                          <span className="text-white">
                            {new Date(
                              selectedChallenge.startTime,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedChallenge.endTime && (
                        <div className="flex justify-between py-2">
                          <span className="text-gray-400">Ended</span>
                          <span className="text-white">
                            {new Date(
                              selectedChallenge.endTime,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Winner Banner (for completed) */}
                {selectedChallenge.status === "completed" &&
                  selectedChallenge.winnerName &&
                  !selectedChallenge.isTie && (
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6 text-center">
                      <Trophy className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                      <p className="text-2xl font-bold text-yellow-400 mb-1">
                        🏆 {selectedChallenge.winnerName}
                      </p>
                      <p className="text-yellow-300/70 mb-2">
                        Challenge Winner
                      </p>
                      <div className="inline-block bg-yellow-500/20 px-4 py-2 rounded-lg">
                        <p className="text-yellow-400 font-bold text-xl">
                          Earned {cs}{selectedChallenge.winnerPrize}
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                  className="border-gray-600"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Challenge Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Challenge & Refund
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel this challenge?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {challengeToCancel && (
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-white font-semibold">
                  {challengeToCancel.challengerName} vs{" "}
                  {challengeToCancel.challengedName}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Entry Fee: {cs}{challengeToCancel.entryFee} each • Prize: {cs}
                  {challengeToCancel.winnerPrize}
                </p>
              </div>
            )}

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300">
                <strong>⚠️ This action will:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-300/80 list-disc list-inside">
                <li>Immediately cancel the challenge</li>
                <li>Refund entry fees to all participants</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="cancelReason" className="text-gray-300">
                Reason for cancellation (optional)
              </Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., User request, Technical issues..."
                className="mt-2 bg-gray-800 border-gray-600 text-gray-100"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              className="border-gray-600"
            >
              Keep Challenge
            </Button>
            <Button
              onClick={handleCancelConfirm}
              disabled={isCancelling}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel & Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
