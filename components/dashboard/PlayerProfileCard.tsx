"use client";

import { motion } from "framer-motion";
import { Crown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";

interface PlayerProfileCardProps {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  title: string;
  titleColor: string;
  titleIcon: string;
  globalRank: number;
  totalUsers: number;
  recentBadges: Array<{
    id: string;
    name: string;
    icon: string;
    rarity: string;
    earnedAt: Date;
  }>;
  totalBadges: number;
}

// Reason: Rarity determines the border glow color of badge chips
const RARITY_COLORS: Record<string, { border: string; bg: string; glow: string }> = {
  common: { border: "border-gray-500/40", bg: "bg-gray-700/50", glow: "rgba(156,163,175,0.3)" },
  uncommon: { border: "border-green-500/40", bg: "bg-green-900/30", glow: "rgba(34,197,94,0.3)" },
  rare: { border: "border-blue-500/40", bg: "bg-blue-900/30", glow: "rgba(59,130,246,0.4)" },
  epic: { border: "border-purple-500/40", bg: "bg-purple-900/30", glow: "rgba(168,85,247,0.4)" },
  legendary: { border: "border-yellow-500/40", bg: "bg-yellow-900/30", glow: "rgba(234,179,8,0.5)" },
};

export default function PlayerProfileCard({
  level,
  currentXP,
  xpToNextLevel,
  progressPercent,
  title,
  titleColor,
  titleIcon,
  globalRank,
  totalUsers,
  recentBadges,
  totalBadges,
}: PlayerProfileCardProps) {
  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(139,92,246,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(234,179,8,0.06),transparent_50%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Level Badge (hexagon-style) */}
        <div className="relative flex-shrink-0">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold animate-hex-pulse"
            style={{
              background: `linear-gradient(135deg, ${titleColor}33, ${titleColor}11)`,
              border: `2px solid ${titleColor}66`,
              boxShadow: `0 0 20px ${titleColor}22`,
            }}
          >
            <span>{titleIcon}</span>
          </div>
          {/* Level number overlay */}
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold bg-gray-900 border-2"
            style={{ borderColor: titleColor, color: titleColor }}
          >
            {level}
          </div>
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 overflow-hidden">
            <span
              className="text-sm sm:text-base font-semibold shrink-0"
              style={{ color: titleColor }}
            >
              {title}
            </span>
            {globalRank > 0 && globalRank <= 3 && (
              <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
            {globalRank > 0 && (
              <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap shrink-0">
                • Rank #{globalRank}
                <span className="text-gray-600"> / {totalUsers}</span>
              </span>
            )}
          </div>

          {/* XP Progress Bar — matching profile page style exactly */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-[var(--font-geist-mono)]">
                XP: {currentXP.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                {xpToNextLevel > 0 ? `${xpToNextLevel.toLocaleString()} XP needed` : "MAX LEVEL"}
              </span>
            </div>
            {/* Reason: Matching profile XPProgressBar — h-6, purple gradient, rounded-full */}
            <div className="relative">
              <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${clampedProgress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </motion.div>
              </div>
              <p className="text-center text-xs font-bold text-white mt-2">
                {clampedProgress.toFixed(1)}% Complete
              </p>
            </div>
          </div>
        </div>

        {/* Global Rank Badge */}
        {globalRank > 0 && (
          <div className="flex-shrink-0 text-center">
            <div
              className="text-3xl font-black font-[var(--font-geist-mono)] animate-rank-glow"
              style={{
                color: titleColor,
                "--rank-color": `${titleColor}88`,
              } as React.CSSProperties}
            >
              #{globalRank}
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Global Rank
            </span>
          </div>
        )}
      </div>

      {/* Recent Badges Row */}
      {recentBadges.length > 0 && (
        <div className="relative z-10 mt-4 pt-4 border-t border-gray-700/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
              Recent Badges ({totalBadges} total)
            </span>
            <Link
              href="/profile"
              className="relative z-20 text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {recentBadges.map((badge, i) => {
              const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;
              return (
                <motion.div
                  key={badge.id}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg border overflow-hidden ${rarity.border} ${rarity.bg} animate-badge-reveal cursor-default`}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    boxShadow: `0 0 10px ${rarity.glow}`,
                  }}
                  title={`${badge.name} (${badge.rarity})`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                >
                  {/* Reason: badge.icon is a GameIconName string — render via GameIcon */}
                  <GameIcon
                    name={badge.icon as GameIconName}
                    size={24}
                    alt={badge.name}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
