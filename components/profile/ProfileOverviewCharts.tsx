"use client";

import Link from "next/link";
import { Trophy, Award, Swords, Crown } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { motion } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProfileOverviewChartsProps {
  combinedStats: any;
  competitionStats: any;
  challengeStats?: any;
  walletData: any;
}

// Removed: GlowStatCard, DonutChart, RingChart, BarChart — stats now only on dashboard

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
  combinedStats: _combinedStats,
  competitionStats,
  challengeStats,
  walletData: _walletData,
}: ProfileOverviewChartsProps) {
  void _combinedStats; // Reason: kept in interface for backward compat; stats now only on dashboard
  void _walletData;
  const { settings } = useAppSettings();

  const hasActivity =
    competitionStats?.totalCompetitionsEntered > 0 ||
    challengeStats?.totalChallengesEntered > 0;

  // Early return must be after all hooks (Rules of Hooks)
  if (!settings) return null;

  return (
    <div className="space-y-6">
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
