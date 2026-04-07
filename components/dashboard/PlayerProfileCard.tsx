"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ChevronRight, ChevronDown, Map } from "lucide-react";
import Link from "next/link";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";

// Reason: Number of items visible in the collapsed first row before expand arrow appears
const COLLAPSED_LIMIT = 8;

interface PlayerProfileCardProps {
  name: string;
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
  journey?: {
    currentMapName: string;
    currentMapTheme: string;
    completedMilestones: number;
    totalMilestones: number;
    recentMilestones: Array<{
      id: string;
      name: string;
      icon: string;
      xp: number;
      completedAt: Date;
    }>;
  };
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
  name,
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
  journey,
}: PlayerProfileCardProps) {
  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);
  const [badgesExpanded, setBadgesExpanded] = useState(false);
  const [milestonesExpanded, setMilestonesExpanded] = useState(false);

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

      {/* Player Name — top center */}
      <h3 className="relative z-10 text-center text-lg sm:text-xl font-bold text-white mb-3 truncate">
        {name}
      </h3>

      {/* Top row: Level badge + Title/Rank + Global Rank */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
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
            <GameIcon name={titleIcon as GameIconName} size={28} alt={title} />
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold bg-gray-900 border-2"
            style={{ borderColor: titleColor, color: titleColor }}
          >
            {level}
          </div>
        </div>

        {/* Player Info — title + rank only */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
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
              <span className="text-[11px] sm:text-xs text-gray-500 whitespace-nowrap shrink-0">
                • Rank #{globalRank}
                <span className="text-gray-600"> / {totalUsers}</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Rank Badge — dynamic size + medal colors */}
        {globalRank > 0 && (
          <div className="flex-shrink-0 text-center min-w-[48px]">
            <div
              className="animate-rank-glow whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 900,
                // Reason: Dynamic font size so large ranks (e.g. #10000) still fit
                fontSize: globalRank < 10 ? 30 : globalRank < 100 ? 26 : globalRank < 1000 ? 22 : globalRank < 10000 ? 18 : 14,
                // Reason: Gold=#1, Silver=#2, Bronze=#3, White=rest
                color: globalRank === 1 ? "#FFD700" : globalRank === 2 ? "#C0C0C0" : globalRank === 3 ? "#CD7F32" : "#ffffff",
                "--rank-color": globalRank === 1
                  ? "rgba(255,215,0,0.6)"
                  : globalRank === 2
                    ? "rgba(192,192,192,0.6)"
                    : globalRank === 3
                      ? "rgba(205,127,50,0.6)"
                      : "rgba(255,255,255,0.4)",
              } as React.CSSProperties}
            >
              #{globalRank.toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">
              Global Rank
            </span>
          </div>
        )}
      </div>

      {/* XP Progress Bar — full width, aligned with journey bar */}
      <div className="relative z-10 w-full">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400 font-[var(--font-geist-mono)]">
            XP: {currentXP.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">
            {xpToNextLevel > 0 ? `${xpToNextLevel.toLocaleString()} XP needed` : "MAX LEVEL"}
          </span>
        </div>
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

      {/* Badges — show all with expandable row */}
      {recentBadges.length > 0 && (() => {
        const hasOverflow = recentBadges.length > COLLAPSED_LIMIT;
        const visibleBadges = badgesExpanded ? recentBadges : recentBadges.slice(0, COLLAPSED_LIMIT);
        return (
          <div className="relative z-10 mt-4 pt-4 border-t border-gray-700/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                  Badges ({recentBadges.length})
                </span>
                {hasOverflow && (
                  <button
                    onClick={() => setBadgesExpanded((v) => !v)}
                    className="flex items-center gap-0.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors min-h-[44px]"
                  >
                    {badgesExpanded ? "Collapse" : `+${recentBadges.length - COLLAPSED_LIMIT} more`}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${badgesExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>
              <Link
                href="/profile?tab=badges"
                className="relative z-20 text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <AnimatePresence mode="popLayout">
                {visibleBadges.map((badge, i) => {
                  const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;
                  return (
                    <motion.div
                      key={badge.id}
                      layout
                      className={`w-10 h-10 flex items-center justify-center rounded-lg border overflow-hidden ${rarity.border} ${rarity.bg} cursor-default`}
                      style={{ boxShadow: `0 0 10px ${rarity.glow}` }}
                      title={`${badge.name} (${badge.rarity})`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.25, delay: i < COLLAPSED_LIMIT ? 0 : (i - COLLAPSED_LIMIT) * 0.03 }}
                    >
                      <GameIcon name={badge.icon as GameIconName} size={24} alt={badge.name} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        );
      })()}

      {/* Recent Milestones + Journey Progress */}
      {journey && journey.totalMilestones > 0 && (
        <div className="relative z-10 mt-4 pt-4 border-t border-gray-700/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Map className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium truncate">
                Journey — {journey.currentMapName}
              </span>
            </div>
            <Link
              href="/profile?tab=journey"
              className="relative z-20 text-xs text-amber-500 hover:text-amber-400 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Map progress bar — matching XP bar style with amber color */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-[var(--font-geist-mono)]">
                {journey.completedMilestones}/{journey.totalMilestones} milestones
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {journey.currentMapTheme} map
              </span>
            </div>
            <div className="relative">
              <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 relative"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${journey.totalMilestones > 0 ? (journey.completedMilestones / journey.totalMilestones) * 100 : 0}%`,
                  }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </motion.div>
              </div>
              <p className="text-center text-xs font-bold text-white mt-2">
                {journey.totalMilestones > 0
                  ? ((journey.completedMilestones / journey.totalMilestones) * 100).toFixed(1)
                  : "0.0"}% Complete
              </p>
            </div>
          </div>

          {/* Milestones — show all with expandable row */}
          {journey.recentMilestones.length > 0 && (() => {
            const ms = journey.recentMilestones;
            const hasOverflow = ms.length > COLLAPSED_LIMIT;
            const visibleMs = milestonesExpanded ? ms : ms.slice(0, COLLAPSED_LIMIT);
            return (
              <>
                {hasOverflow && (
                  <div className="flex items-center mb-2">
                    <button
                      onClick={() => setMilestonesExpanded((v) => !v)}
                      className="flex items-center gap-0.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors min-h-[44px]"
                    >
                      {milestonesExpanded ? "Collapse" : `+${ms.length - COLLAPSED_LIMIT} more`}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${milestonesExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <AnimatePresence mode="popLayout">
                    {visibleMs.map((m, i) => (
                      <motion.div
                        key={m.id}
                        layout
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-amber-600/40 bg-amber-900/30 overflow-hidden cursor-default"
                        style={{ boxShadow: "0 0 10px rgba(217,119,6,0.3)" }}
                        title={`${m.name} (+${m.xp} XP)`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, delay: i < COLLAPSED_LIMIT ? 0 : (i - COLLAPSED_LIMIT) * 0.03 }}
                      >
                        <GameIcon name={m.icon as GameIconName} size={24} alt={m.name} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </motion.div>
  );
}
