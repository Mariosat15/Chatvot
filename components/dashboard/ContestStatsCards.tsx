"use client";

import { Trophy, Award, Swords, Crown } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { motion } from "framer-motion";

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  delay?: number;
}) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(to right, ${color}, ${color}88)` }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

interface CompetitionStats {
  total: number;
  won: number;
  topThreeFinishes: number;
  totalCreditsWon: number;
  activeCount: number;
}

interface ChallengeStats {
  total: number;
  wins: number;
  losses: number;
  totalCreditsWon: number;
}

interface ContestStatsCardsProps {
  competitionStats: CompetitionStats;
  challengeStats: ChallengeStats;
}

export default function ContestStatsCards({
  competitionStats,
  challengeStats,
}: ContestStatsCardsProps) {
  const { settings } = useAppSettings();

  const hasActivity = competitionStats.total > 0 || challengeStats.total > 0;

  if (!hasActivity) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Competitions Card */}
      <motion.div
        className="bg-gray-800/30 rounded-2xl p-4 sm:p-6 border border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-base sm:text-lg font-semibold text-white">Competitions</h3>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-center gap-2 sm:gap-3">
              <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {competitionStats.won}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-400">Victories</p>
              </div>
            </div>
            <div className="text-right min-w-0">
              <p className="text-sm sm:text-lg font-bold text-yellow-400 truncate">
                {competitionStats.totalCreditsWon.toFixed(settings.credits.decimals)}{" "}
                {settings.credits.symbol}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-400">Total Prizes</p>
            </div>
          </div>

          <HorizontalBar
            label="Entered"
            value={competitionStats.total}
            maxValue={Math.max(competitionStats.total, 10)}
            color="#3b82f6"
            delay={0.3}
          />
          <HorizontalBar
            label="Podium Finishes"
            value={competitionStats.topThreeFinishes}
            maxValue={competitionStats.total || 1}
            color="#a855f7"
            delay={0.4}
          />
          <HorizontalBar
            label="Active"
            value={competitionStats.activeCount}
            maxValue={Math.max(competitionStats.activeCount, 5)}
            color="#22c55e"
            delay={0.5}
          />
        </div>
      </motion.div>

      {/* 1v1 Challenges Card */}
      <motion.div
        className="bg-gray-800/30 rounded-2xl p-4 sm:p-6 border border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Swords className="w-5 h-5 text-orange-400" />
          <h3 className="text-base sm:text-lg font-semibold text-white">1v1 Challenges</h3>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <div className="flex items-center gap-2 sm:gap-3">
              <Award className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {challengeStats.wins}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-400">Victories</p>
              </div>
            </div>
            <div className="text-right min-w-0">
              <p className="text-sm sm:text-lg font-bold text-yellow-400 truncate">
                {challengeStats.totalCreditsWon.toFixed(settings.credits.decimals)}{" "}
                {settings.credits.symbol}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-400">Total Won</p>
            </div>
          </div>

          <HorizontalBar
            label="Total Challenges"
            value={challengeStats.total}
            maxValue={Math.max(challengeStats.total, 10)}
            color="#f97316"
            delay={0.6}
          />
          <HorizontalBar
            label="Won"
            value={challengeStats.wins}
            maxValue={challengeStats.total || 1}
            color="#22c55e"
            delay={0.7}
          />
          <HorizontalBar
            label="Lost"
            value={challengeStats.losses}
            maxValue={challengeStats.total || 1}
            color="#ef4444"
            delay={0.8}
          />
        </div>
      </motion.div>
    </div>
  );
}
