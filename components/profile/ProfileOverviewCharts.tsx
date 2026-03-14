"use client";

// Reason: useMemo removed — no longer needed after chart cleanup
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Award,
  Swords,
  Wallet,
  ArrowRight,
  DollarSign,
  Crown,
} from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { motion } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProfileOverviewChartsProps {
  combinedStats: any;
  competitionStats: any;
  challengeStats?: any;
  walletData: any;
}

// Removed: RingChart, BarChart, _RadialProgress components — no longer used in profile

// Stat Card with Gradient Border - Consistent glow effect
function GlowStatCard({
  icon,
  label,
  value,
  subvalue,
  trend,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: "up" | "down" | "neutral";
  color: "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "cyan";
  delay?: number;
}) {
  const colorMap = {
    blue: {
      gradient: "from-blue-500 to-cyan-500",
      border: "border-blue-500/50",
      text: "text-blue-400",
      shadow: "rgba(59, 130, 246, 0.3)",
    },
    green: {
      gradient: "from-green-500 to-emerald-500",
      border: "border-green-500/50",
      text: "text-green-400",
      shadow: "rgba(34, 197, 94, 0.3)",
    },
    red: {
      gradient: "from-red-500 to-rose-500",
      border: "border-red-500/50",
      text: "text-red-400",
      shadow: "rgba(239, 68, 68, 0.3)",
    },
    yellow: {
      gradient: "from-yellow-500 to-amber-500",
      border: "border-yellow-500/50",
      text: "text-yellow-400",
      shadow: "rgba(234, 179, 8, 0.3)",
    },
    purple: {
      gradient: "from-purple-500 to-violet-500",
      border: "border-purple-500/50",
      text: "text-purple-400",
      shadow: "rgba(168, 85, 247, 0.3)",
    },
    orange: {
      gradient: "from-orange-500 to-red-500",
      border: "border-orange-500/50",
      text: "text-orange-400",
      shadow: "rgba(249, 115, 22, 0.3)",
    },
    cyan: {
      gradient: "from-cyan-500 to-blue-500",
      border: "border-cyan-500/50",
      text: "text-cyan-400",
      shadow: "rgba(6, 182, 212, 0.3)",
    },
  };

  const colors = colorMap[color];

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Card with consistent glow */}
      <div
        className={`relative bg-gray-900/90 backdrop-blur-sm rounded-2xl p-4 border ${colors.border} transition-all duration-300 group-hover:scale-[1.02]`}
        style={{
          boxShadow: `0 0 20px ${colors.shadow}, 0 0 40px ${colors.shadow.replace("0.3", "0.15")}`,
        }}
      >
        <div className="flex items-start justify-between">
          <div
            className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} bg-opacity-20`}
          >
            {icon}
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-gray-400"}`}
            >
              {trend === "up" && <TrendingUp className="w-3 h-3" />}
              {trend === "down" && <TrendingDown className="w-3 h-3" />}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          {subvalue && <p className="text-xs text-gray-500 mt-1">{subvalue}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// Removed: DonutChart component — no longer used in profile

// Horizontal Progress Bar
function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  showValue = true,
  delay = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  showValue?: boolean;
  delay?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        {showValue && <span className="text-white font-medium">{value}</span>}
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(to right, ${color}, ${color}88)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function ProfileOverviewCharts({
  combinedStats,
  competitionStats,
  challengeStats,
  walletData,
}: ProfileOverviewChartsProps) {
  const { settings, creditsToEUR } = useAppSettings();

  const hasActivity =
    competitionStats?.totalCompetitionsEntered > 0 ||
    challengeStats?.totalChallengesEntered > 0;

  // Early return must be after all hooks (Rules of Hooks)
  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Hero Stats Row — key user metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <GlowStatCard
          icon={<Wallet className="w-5 h-5 text-white" />}
          label="Credit Balance"
          value={`${(walletData?.currentBalance || 0).toFixed(settings.credits.decimals)}`}
          subvalue={settings.credits.symbol}
          color="yellow"
          delay={0}
        />
        <GlowStatCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Total Spent"
          value={`${((walletData?.totalSpentOnCompetitions || 0) + (walletData?.totalSpentOnChallenges || 0) + (walletData?.totalSpentOnMarketplace || 0)).toFixed(settings.credits.decimals)}`}
          subvalue="Comp + Challenge + Market"
          color="red"
          delay={0.1}
        />
        <GlowStatCard
          icon={<Target className="w-5 h-5 text-white" />}
          label="Win Rate"
          value={`${(combinedStats?.winRate || 0).toFixed(1)}%`}
          trend={(combinedStats?.winRate || 0) >= 50 ? "up" : "down"}
          color={(combinedStats?.winRate || 0) >= 50 ? "green" : "red"}
          delay={0.2}
        />
        <GlowStatCard
          icon={<Crown className="w-5 h-5 text-white" />}
          label="GM Earnings"
          value={`${(walletData?.totalGMEarnings || 0).toFixed(settings.credits.decimals)}`}
          subvalue={settings.credits.symbol}
          color="purple"
          delay={0.3}
        />
        <GlowStatCard
          icon={<Trophy className="w-5 h-5 text-white" />}
          label="Prizes Won"
          value={`⚡ ${(combinedStats?.totalPrizesWon || 0).toFixed(settings.credits.decimals)}`}
          color="orange"
          delay={0.4}
        />
      </div>

      {/* Removed: Performance Overview (ring charts) and Trading Results (bar chart) — per user request */}

      {/* Wallet Section with Donut Chart */}
      <motion.div
        className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">
              Wallet Overview
            </h3>
          </div>
          <Link
            href="/wallet"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Balance + Income row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gradient-to-br from-yellow-500/20 to-amber-600/10 rounded-xl p-3 border border-yellow-500/30">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
            <p className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-geist-mono)" }}>
              {(walletData?.currentBalance || 0).toFixed(settings.credits.decimals)}
            </p>
            <p className="text-xs text-yellow-400">{settings.credits.symbol}</p>
            {settings.credits.showEUREquivalent && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                ≈ {settings.currency.symbol}{creditsToEUR(walletData?.currentBalance || 0).toFixed(2)}
              </p>
            )}
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-blue-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Deposited</p>
            <p className="text-xl font-bold text-blue-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              {(walletData?.totalDeposited || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-green-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Won</p>
            <p className="text-xl font-bold text-green-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              +{((walletData?.totalWonFromCompetitions || 0) + (walletData?.totalWonFromChallenges || 0)).toFixed(settings.credits.decimals)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-purple-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">GM Earnings</p>
            <p className="text-xl font-bold text-purple-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              {(walletData?.totalGMEarnings || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
        </div>

        {/* Spending + Withdrawal row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-800/50 rounded-xl p-3 border border-red-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Comp. Entries</p>
            <p className="text-lg font-bold text-red-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              -{(walletData?.totalSpentOnCompetitions || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-orange-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Challenge Entries</p>
            <p className="text-lg font-bold text-orange-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              -{(walletData?.totalSpentOnChallenges || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-pink-500/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Marketplace</p>
            <p className="text-lg font-bold text-pink-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              -{(walletData?.totalSpentOnMarketplace || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-600/20">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Withdrawn</p>
            <p className="text-lg font-bold text-gray-400" style={{ fontFamily: "var(--font-geist-mono)" }}>
              {(walletData?.totalWithdrawn || 0).toFixed(settings.credits.decimals)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Competition & Challenge Stats */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Competition Stats */}
        <motion.div
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Competitions</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {competitionStats?.competitionsWon || 0}
                  </p>
                  <p className="text-xs text-gray-400">Victories</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-400">
                  {(competitionStats?.totalCreditsWon || 0).toFixed(
                    settings.credits.decimals,
                  )}{" "}
                  {settings.credits.symbol}
                </p>
                <p className="text-xs text-gray-400">Total Prizes</p>
              </div>
            </div>

            <HorizontalBar
              label="Entered"
              value={competitionStats?.totalCompetitionsEntered || 0}
              maxValue={Math.max(
                competitionStats?.totalCompetitionsEntered || 0,
                10,
              )}
              color="#3b82f6"
              delay={0.8}
            />
            <HorizontalBar
              label="Podium Finishes"
              value={competitionStats?.podiumFinishes || 0}
              maxValue={competitionStats?.totalCompetitionsEntered || 1}
              color="#a855f7"
              delay={0.9}
            />
            <HorizontalBar
              label="Active"
              value={competitionStats?.totalCompetitionsActive || 0}
              maxValue={Math.max(
                competitionStats?.totalCompetitionsActive || 0,
                5,
              )}
              color="#22c55e"
              delay={1.0}
            />
          </div>
        </motion.div>

        {/* Challenge Stats */}
        <motion.div
          className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">1v1 Challenges</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {challengeStats?.totalChallengesWon || 0}
                  </p>
                  <p className="text-xs text-gray-400">Victories</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-400">
                  {(challengeStats?.totalCreditsWon || 0).toFixed(
                    settings.credits.decimals,
                  )}{" "}
                  {settings.credits.symbol}
                </p>
                <p className="text-xs text-gray-400">Total Won</p>
              </div>
            </div>

            <HorizontalBar
              label="Total Challenges"
              value={challengeStats?.totalChallengesEntered || 0}
              maxValue={Math.max(
                challengeStats?.totalChallengesEntered || 0,
                10,
              )}
              color="#f97316"
              delay={1.1}
            />
            <HorizontalBar
              label="Won"
              value={challengeStats?.totalChallengesWon || 0}
              maxValue={challengeStats?.totalChallengesEntered || 1}
              color="#22c55e"
              delay={1.2}
            />
            <HorizontalBar
              label="Lost"
              value={challengeStats?.totalChallengesLost || 0}
              maxValue={challengeStats?.totalChallengesEntered || 1}
              color="#ef4444"
              delay={1.3}
            />
          </div>
        </motion.div>
      </div>

      {/* Empty State */}
      {!hasActivity && (
        <motion.div
          className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-2xl p-8 text-center border border-gray-700/50"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Ready to Start Trading?
          </h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Join competitions or challenge other traders to start building your
            trading record and climb the leaderboard!
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/competitions"
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-900 rounded-xl font-semibold transition-all shadow-lg shadow-yellow-500/20"
            >
              Browse Competitions
            </Link>
            <Link
              href="/challenges"
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all"
            >
              Find Challengers
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
